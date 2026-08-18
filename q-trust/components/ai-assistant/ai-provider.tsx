"use client"

import { createContext, useContext, useState, useCallback, useRef, ReactNode, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

interface PendingAction {
  id: string
  toolName: string
  description: string
  params: Record<string, unknown>
}

interface PersistedPendingAction extends PendingAction {
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'
  result?: unknown
  error?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
    result?: unknown
  }>
  timestamp: string
  isOptimistic?: boolean
  isStreaming?: boolean
}

interface ConversationSummary {
  _id: string
  title: string
  updatedAt: string
}

interface Conversation {
  _id: string
  title: string
  messages: Array<Omit<Message, 'id' | 'isOptimistic' | 'isStreaming'>>
  pendingActions: PersistedPendingAction[]
  status: string
}

interface ToolActivity {
  name: string
  label: string
  status: 'running' | 'done'
}

interface AIContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  toggleOpen: () => void

  conversations: ConversationSummary[]
  currentConversationId: string | null
  currentConversation: Conversation | null
  isLoadingConversation: boolean

  messages: Message[]
  pendingActions: PendingAction[]

  sendMessage: (message: string) => void
  isSending: boolean
  statusText: string
  toolActivity: ToolActivity | null

  stopGeneration: () => void
  regenerate: () => void

  executeAction: (actionId: string, approved: boolean, modifiedParams?: Record<string, unknown>) => void
  isExecuting: boolean

  deleteConversation: (id: string) => void
  isDeleting: boolean

  startNewConversation: () => void
  loadConversation: (id: string) => void
}

const AIContext = createContext<AIContextValue | null>(null)

export function useAI() {
  const ctx = useContext(AIContext)
  if (!ctx) throw new Error('useAI must be used within AIProvider')
  return ctx
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))
}

export function AIProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('ai')
  const [isOpen, setIsOpen] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)

  /**
   * `pendingMessages` holds optimistic + streaming messages for the current send.
   * They are wiped as soon as the server confirms (we then read from conversationData).
   */
  const [pendingMessages, setPendingMessages] = useState<Message[]>([])
  /** Pending actions raised by the in-flight stream that haven't been persisted into the cache yet. */
  const [transientPendingActions, setTransientPendingActions] = useState<PendingAction[]>([])
  /** Actions the user already approved/rejected this session — hide them immediately even if the server reload is still in flight. */
  const [resolvedActionIds, setResolvedActionIds] = useState<Set<string>>(new Set())

  const [isSending, setIsSending] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [toolActivity, setToolActivity] = useState<ToolActivity | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const queryClient = useQueryClient()

  const toggleOpen = useCallback(() => setIsOpen((p) => !p), [])

  const { data: conversationsData } = useQuery<{ conversations: ConversationSummary[] }>({
    queryKey: ['ai-conversations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ai-assistant/history')
      if (!res.ok) throw new Error('Failed to load conversations')
      return res.json()
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })

  const { data: conversationData, isLoading: isLoadingConversation } = useQuery<Conversation>({
    queryKey: ['ai-conversation', currentConversationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ai-assistant/history?conversationId=${currentConversationId}`)
      if (!res.ok) throw new Error('Failed to load conversation')
      return res.json()
    },
    enabled: !!currentConversationId,
    staleTime: 10_000,
  })

  /**
   * Cancels any in-flight stream and clears all transient UI state.
   * Call before switching conversations or starting a new one.
   */
  const cancelInFlight = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort() } catch { /* ignore */ }
      abortRef.current = null
    }
    setIsSending(false)
    setIsExecuting(false)
    setStatusText('')
    setToolActivity(null)
    setPendingMessages([])
    setTransientPendingActions([])
  }, [])

  /**
   * Core SSE stream consumer. Used by both sendMessage and regenerate/executeAction.
   * Handles all event types and updates UI state in real time.
   */
  const consumeStream = useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      opts: {
        optimisticUserMessage?: Message
        streamingMsgId: string
        onConvId?: (id: string) => void
        onDone?: () => void
      }
    ) => {
      const { optimisticUserMessage, streamingMsgId, onConvId, onDone } = opts

      const initialPending: Message[] = []
      if (optimisticUserMessage) initialPending.push(optimisticUserMessage)
      initialPending.push({
        id: streamingMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      })
      setPendingMessages(initialPending)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || t('connectionError'))
        }

        if (!res.headers.get('Content-Type')?.includes('text/event-stream')) {
          const data = await res.json()
          if (data.conversationId && onConvId) onConvId(data.conversationId)
          throw new Error(data.message || t('unexpectedResponse'))
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error(t('noStream'))

        const decoder = new TextDecoder()
        let buffer = ''
        let accumulated = ''
        let resolvedConvId: string | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue

            let event: { type: string; [k: string]: unknown }
            try {
              event = JSON.parse(jsonStr)
            } catch {
              continue
            }

            switch (event.type) {
              case 'conv_id':
                if (event.conversationId && typeof event.conversationId === 'string') {
                  resolvedConvId = event.conversationId
                  onConvId?.(event.conversationId)
                }
                break

              case 'text':
                accumulated += (event.content as string) || ''
                setPendingMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamingMsgId ? { ...m, content: accumulated } : m
                  )
                )
                setStatusText('')
                setToolActivity(null)
                break

              case 'tool':
                setToolActivity({
                  name: event.name as string,
                  label: event.label as string,
                  status: event.status as 'running' | 'done',
                })
                if (event.status === 'running') {
                  setStatusText(`${event.label}...`)
                } else if (event.status === 'done') {
                  setStatusText('')
                }
                break

              case 'status':
                setStatusText((event.text as string) || '')
                break

              case 'done': {
                if (Array.isArray(event.pendingActions) && event.pendingActions.length > 0) {
                  setTransientPendingActions((prev) => [
                    ...prev,
                    ...(event.pendingActions as PendingAction[]),
                  ])
                }
                const convToInvalidate = resolvedConvId || (body.conversationId as string | null)
                queryClient.invalidateQueries({ queryKey: ['ai-conversations'] })
                if (convToInvalidate) {
                  await queryClient.invalidateQueries({ queryKey: ['ai-conversation', convToInvalidate] })
                }
                setPendingMessages([])
                setStatusText('')
                setToolActivity(null)
                onDone?.()
                return
              }

              case 'error': {
                const errMessage = (event.message as string) || t('unknownError')
                const convToInvalidate = resolvedConvId || (body.conversationId as string | null)
                queryClient.invalidateQueries({ queryKey: ['ai-conversations'] })
                if (convToInvalidate) {
                  await queryClient.invalidateQueries({ queryKey: ['ai-conversation', convToInvalidate] })
                }
                setPendingMessages([])
                setStatusText('')
                setToolActivity(null)
                throw new Error(errMessage)
              }
            }
          }
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null
      }
    },
    [queryClient, t]
  )

  const sendMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim()
      if (!trimmed || isSending) return

      setIsSending(true)
      setStatusText(t('thinking'))
      setToolActivity(null)

      const convIdAtSend = currentConversationId
      const optimisticUserMessage: Message = {
        id: newId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
        isOptimistic: true,
      }
      const streamingMsgId = newId()

      try {
        await consumeStream(
          '/api/admin/ai-assistant/chat',
          { conversationId: convIdAtSend, message: trimmed },
          {
            optimisticUserMessage,
            streamingMsgId,
            onConvId: (id) => {
              if (!convIdAtSend && id) setCurrentConversationId(id)
            },
          }
        )
      } catch (err) {
        if (!isAbortError(err)) {
          const errMsg = err instanceof Error ? err.message : t('unknownError')
          setPendingMessages([
            optimisticUserMessage,
            {
              id: newId(),
              role: 'assistant',
              content: t('errorMessage', { error: errMsg }),
              timestamp: new Date().toISOString(),
              isOptimistic: true,
            },
          ])
        }
      } finally {
        setIsSending(false)
        setStatusText('')
        setToolActivity(null)
      }
    },
    [currentConversationId, isSending, consumeStream, t]
  )

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort() } catch { /* ignore */ }
      abortRef.current = null
    }
    setIsSending(false)
    setIsExecuting(false)
    setStatusText('')
    setToolActivity(null)
    if (currentConversationId) {
      queryClient.invalidateQueries({ queryKey: ['ai-conversation', currentConversationId] })
    }
    setPendingMessages([])
  }, [currentConversationId, queryClient])

  const regenerate = useCallback(async () => {
    if (!currentConversationId || isSending) return
    setIsSending(true)
    setStatusText(t('regenerating'))
    setToolActivity(null)

    const streamingMsgId = newId()

    try {
      await consumeStream(
        '/api/admin/ai-assistant/chat',
        { conversationId: currentConversationId, regenerate: true },
        { streamingMsgId }
      )
    } catch (err) {
      if (!isAbortError(err)) {
        const errMsg = err instanceof Error ? err.message : t('unknownError')
        setPendingMessages([
          {
            id: newId(),
            role: 'assistant',
            content: t('regenerateError', { error: errMsg }),
            timestamp: new Date().toISOString(),
            isOptimistic: true,
          },
        ])
      }
    } finally {
      setIsSending(false)
      setStatusText('')
      setToolActivity(null)
    }
  }, [currentConversationId, isSending, consumeStream, t])

  const executeAction = useCallback(
    async (actionId: string, approved: boolean, modifiedParams?: Record<string, unknown>) => {
      if (!currentConversationId || isExecuting || isSending) return

      setIsExecuting(true)
      setIsSending(true)
      setStatusText(approved ? t('executing') : t('actionRejected'))
      setToolActivity(null)
      setResolvedActionIds((prev) => new Set(prev).add(actionId))
      setTransientPendingActions((prev) => prev.filter((a) => a.id !== actionId))

      const streamingMsgId = newId()

      try {
        await consumeStream(
          '/api/admin/ai-assistant/execute',
          {
            conversationId: currentConversationId,
            actionId,
            approved,
            modifiedParams,
          },
          { streamingMsgId }
        )
      } catch (err) {
        if (!isAbortError(err)) {
          const errMsg = err instanceof Error ? err.message : t('unknownError')
          setPendingMessages([
            {
              id: newId(),
              role: 'assistant',
              content: t('executeError', { error: errMsg }),
              timestamp: new Date().toISOString(),
              isOptimistic: true,
            },
          ])
        }
      } finally {
        setIsExecuting(false)
        setIsSending(false)
        setStatusText('')
        setToolActivity(null)
      }
    },
    [currentConversationId, isExecuting, isSending, consumeStream, t]
  )

  const deleteMutation = useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/admin/ai-assistant/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || t('deleteError'))
      }
      return res.json()
    },
    onSuccess: (_, deletedId) => {
      if (currentConversationId === deletedId) {
        cancelInFlight()
        setCurrentConversationId(null)
      }
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] })
      queryClient.removeQueries({ queryKey: ['ai-conversation', deletedId] })
    },
  })

  const deleteConversation = useCallback(
    (id: string) => {
      deleteMutation.mutate(id)
    },
    [deleteMutation]
  )

  const startNewConversation = useCallback(() => {
    cancelInFlight()
    setCurrentConversationId(null)
    setResolvedActionIds(new Set())
  }, [cancelInFlight])

  const loadConversation = useCallback((id: string) => {
    if (id === currentConversationId) return
    cancelInFlight()
    setCurrentConversationId(id)
    setResolvedActionIds(new Set())
  }, [cancelInFlight, currentConversationId])

  /**
   * Final message list = persisted server messages + any optimistic/streaming ones
   * that aren't yet reflected in the server cache. We key by stable `id` so
   * legitimate duplicate user messages are preserved.
   */
  const messages = useMemo<Message[]>(() => {
    const serverMessages: Message[] = (conversationData?.messages || [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
      .map((m, idx) => ({
        id: `server-${idx}-${new Date(m.timestamp).getTime()}`,
        role: m.role,
        content: m.content,
        timestamp:
          typeof m.timestamp === 'string'
            ? m.timestamp
            : new Date(m.timestamp).toISOString(),
      }))

    return [...serverMessages, ...pendingMessages]
  }, [conversationData, pendingMessages])

  const pendingActions = useMemo<PendingAction[]>(() => {
    const fromServer: PendingAction[] = (conversationData?.pendingActions || [])
      .filter((a) => a.status === 'pending' && !resolvedActionIds.has(a.id))
      .map((a) => ({
        id: a.id,
        toolName: a.toolName,
        description: a.description,
        params: a.params,
      }))

    const seen = new Set(fromServer.map((a) => a.id))
    const fromStream = transientPendingActions.filter(
      (a) => !seen.has(a.id) && !resolvedActionIds.has(a.id)
    )
    return [...fromServer, ...fromStream]
  }, [conversationData, transientPendingActions, resolvedActionIds])

  const value: AIContextValue = {
    isOpen,
    setIsOpen,
    toggleOpen,
    conversations: conversationsData?.conversations || [],
    currentConversationId,
    currentConversation: conversationData || null,
    isLoadingConversation,
    messages,
    pendingActions,
    sendMessage,
    isSending,
    statusText,
    toolActivity,
    stopGeneration,
    regenerate,
    executeAction,
    isExecuting,
    deleteConversation,
    isDeleting: deleteMutation.isPending,
    startNewConversation,
    loadConversation,
  }

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>
}
