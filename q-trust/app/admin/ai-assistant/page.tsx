"use client"

import { useState, useRef, useEffect, KeyboardEvent, useMemo } from "react"
import { useTranslations } from "next-intl"
import { useAI } from "@/components/ai-assistant/ai-provider"
import { AIActionCard } from "@/components/ai-assistant/ai-action-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Send,
  Plus,
  Loader2,
  MessageSquare,
  Bot,
  Sparkles,
  GraduationCap,
  Users,
  Calendar,
  ClipboardCheck,
  CreditCard,
  BarChart3,
  DoorOpen,
  Zap,
  Brain,
  Shield,
  MessagesSquare,
  User,
  Trash2,
  Search,
  Square,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react"

const CAPABILITY_KEYS = [
  {
    icon: GraduationCap,
    titleKey: "capStudentsTitle",
    descKey: "capStudentsDesc",
    exKeys: ["capStudentsEx1", "capStudentsEx2", "capStudentsEx3"],
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: Users,
    titleKey: "capTeachersTitle",
    descKey: "capTeachersDesc",
    exKeys: ["capTeachersEx1", "capTeachersEx2", "capTeachersEx3"],
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: Calendar,
    titleKey: "capSessionsTitle",
    descKey: "capSessionsDesc",
    exKeys: ["capSessionsEx1", "capSessionsEx2", "capSessionsEx3"],
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: ClipboardCheck,
    titleKey: "capAttendanceTitle",
    descKey: "capAttendanceDesc",
    exKeys: ["capAttendanceEx1", "capAttendanceEx2", "capAttendanceEx3"],
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: CreditCard,
    titleKey: "capPaymentsTitle",
    descKey: "capPaymentsDesc",
    exKeys: ["capPaymentsEx1", "capPaymentsEx2", "capPaymentsEx3"],
    color: "from-pink-500 to-rose-600",
  },
  {
    icon: DoorOpen,
    titleKey: "capRoomsTitle",
    descKey: "capRoomsDesc",
    exKeys: ["capRoomsEx1", "capRoomsEx2", "capRoomsEx3"],
    color: "from-cyan-500 to-sky-600",
  },
]

const QUICK_PROMPT_KEYS = [
  { key: "qpStudentCount", icon: GraduationCap },
  { key: "qpTodayAttendance", icon: ClipboardCheck },
  { key: "qpWeeklySchedule", icon: Calendar },
  { key: "qpConflicts", icon: BarChart3 },
  { key: "qpMonthlyPayments", icon: CreditCard },
  { key: "qpPendingClaims", icon: MessagesSquare },
  { key: "qpCreateSession", icon: Plus },
  { key: "qpAddStudent", icon: GraduationCap },
]

function useFormatConvDate() {
  const t = useTranslations("admin.aiAssistant")

  return (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return t("timeNow")
    if (diffMins < 60) return t("timeMinutes", { count: diffMins })
    if (diffHours < 24) return t("timeHours", { count: diffHours })
    if (diffDays < 7) return t("timeDays", { count: diffDays })
    return date.toLocaleDateString("ar-TN", { day: "numeric", month: "short" })
  }
}

export default function AIAssistantPage() {
  const t = useTranslations("admin.aiAssistant")
  const formatConvDate = useFormatConvDate()

  const {
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
    conversations,
    startNewConversation,
    loadConversation,
    deleteConversation,
    isDeleting,
    currentConversationId,
    isLoadingConversation,
  } = useAI()

  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottomRef = useRef(true)

  const capabilityCards = useMemo(() =>
    CAPABILITY_KEYS.map((cap) => ({
      icon: cap.icon,
      title: t(cap.titleKey),
      description: t(cap.descKey),
      examples: cap.exKeys.map((k) => t(k)),
      color: cap.color,
    })),
    [t]
  )

  const quickPrompts = useMemo(() =>
    QUICK_PROMPT_KEYS.map((qp) => ({
      text: t(qp.key),
      icon: qp.icon,
    })),
    [t]
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /** Track whether the user has scrolled up; if so, stop auto-scroll-to-bottom hijacking. */
  useEffect(() => {
    const container = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null
    if (!container) return
    const onScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      stickToBottomRef.current = distanceFromBottom < 80
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (stickToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, pendingActions, statusText])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isSending) return
    setInput("")
    stickToBottomRef.current = true
    sendMessage(text)
  }

  const handleStop = () => {
    stopGeneration()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickPrompt = (text: string) => {
    if (isSending) return
    stickToBottomRef.current = true
    sendMessage(text)
  }

  const displayMessages = messages.filter(
    (m) => (m.role === "user" || m.role === "assistant") && m.content?.trim()
  )

  const hasMessages = displayMessages.length > 0
  const lastAssistantIndex = (() => {
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      if (displayMessages[i].role === 'assistant') return i
    }
    return -1
  })()

  return (
    <div className="flex flex-row-reverse gap-4 h-[calc(100vh-7rem)] max-h-[calc(100vh-7rem)]">
      {/* Conversations Sidebar */}
      <div className="hidden lg:flex flex-col w-80 shrink-0">
        <Card className="flex flex-col h-full overflow-hidden border-border/60">
          <div className="p-3 border-b bg-linear-to-l from-emerald-600 to-teal-700">
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] text-white/80 hover:text-white hover:bg-white/10 gap-1"
                onClick={startNewConversation}
              >
                <Plus className="w-3 h-3" />
                {t("new")}
              </Button>
              <div className="flex items-center gap-2 text-white">
                <span className="font-semibold text-sm">{t("conversations")}</span>
                <MessagesSquare className="w-4 h-4 text-white/70" />
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {conversations.length === 0 && !currentConversationId ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                  <MessageSquare className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {t("noPreviousConversations")}
                </p>
                <p className="text-[11px] text-muted-foreground/50 mt-1">
                  {t("startConversationHint")}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {currentConversationId && !conversations.some((c) => c._id === currentConversationId) && (
                  <div className="flex items-start rounded-lg border-s-[3px] border-s-primary bg-muted/50 px-2.5 py-2 dark:bg-muted/30">
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-[13px] font-semibold leading-relaxed text-foreground">
                        {isSending ? t("conversing") : t("newConversation")}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{t("now")}</p>
                    </div>
                  </div>
                )}
                {conversations.map((conv) => {
                  const isActive = currentConversationId === conv._id
                  const isDefaultTitle = !conv.title?.trim() || conv.title === t("newConversation")
                  const title = isDefaultTitle ? t("ongoingConversation") : conv.title.trim()
                  return (
                    <div
                      key={conv._id}
                      className={cn(
                        "group flex flex-row-reverse items-start rounded-lg border-s-[3px] transition-colors duration-150",
                        isActive
                          ? "border-s-primary bg-muted/50 dark:bg-muted/30"
                          : "border-s-transparent hover:bg-muted/40 dark:hover:bg-muted/20"
                      )}
                    >
                      <button
                        className="min-w-0 flex-1 px-2.5 py-2 text-right"
                        onClick={() => loadConversation(conv._id)}
                      >
                        <p
                          className={cn(
                            "line-clamp-2 text-[13px] leading-relaxed text-foreground",
                            isActive ? "font-semibold" : "font-medium"
                          )}
                          dir="auto"
                          title={title}
                        >
                          {title}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatConvDate(conv.updatedAt)}
                        </p>
                      </button>
                      <button
                        className="mx-0.5 mt-1.5 shrink-0 rounded-md p-1.5 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(t("confirmDeleteConversation"))) {
                            deleteConversation(conv._id)
                          }
                        }}
                        disabled={isDeleting}
                        title={t("deleteConversation")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>

          {conversations.length > 0 && (
            <div className="p-2 border-t">
              <Button
                size="sm"
                variant="ghost"
                className="w-full h-8 text-[11px] text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 gap-1.5"
                onClick={() => {
                  if (confirm(t("confirmDeleteAll"))) {
                    conversations.forEach((c) => deleteConversation(c._id))
                  }
                }}
                disabled={isDeleting}
              >
                <Trash2 className="w-3 h-3" />
                {t("deleteAll")}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden border-border/60">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-linear-to-r from-emerald-600 via-teal-600 to-emerald-700" dir="ltr">
        <div className="flex items-center gap-1 ml-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-white/70 hover:text-white hover:bg-white/10 gap-1 lg:hidden"
              onClick={startNewConversation}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isSending ? "bg-amber-300 animate-pulse" : "bg-emerald-300"
            )} title={isSending ? t("working") : t("connected")} />
          </div>
          <div className="flex items-center gap-6">
            <div>
              <h2 className="font-bold text-white text-[15px] leading-none">
                {t("assistantName")}
              </h2>
              {isSending && statusText ? (
                <p className="text-[11px] text-emerald-200 mt-1 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {statusText}
                </p>
              ) : (
                <p className="text-[11px] text-white/50 mt-1">
                  {t("poweredByAI")}
                </p>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        {/* Messages / Welcome Area */}
        <ScrollArea className="flex-1" ref={scrollContainerRef}>
          <div className="p-4 md:p-6">
            {isLoadingConversation && !hasMessages ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t("loadingConversation")}
                  </p>
                </div>
              </div>
            ) : !hasMessages && !isSending && pendingActions.length === 0 ? (
              <div className="max-w-3xl mx-auto">
                {/* Hero */}
                <div className="text-center mb-8 pt-4">
                  <div className="relative inline-block mb-5">
                    <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center shadow-xl shadow-emerald-500/20">
                      <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center border-2 border-background">
                      <Zap className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">
                    {t("greeting")}
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {t("introText")}
                  </p>
                </div>

                {/* Feature badges */}
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                  {[
                    { icon: Brain, label: t("advancedAI") },
                    { icon: Shield, label: t("approvalRequired") },
                    { icon: Zap, label: t("instantExecution") },
                  ].map((badge) => (
                    <div
                      key={badge.label}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 text-xs text-muted-foreground border border-border/50"
                    >
                      <badge.icon className="w-3 h-3" />
                      {badge.label}
                    </div>
                  ))}
                </div>

                {/* Quick Prompts */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
                    {t("quickStart")}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt.text}
                        onClick={() => handleQuickPrompt(prompt.text)}
                        disabled={isSending}
                        className="group flex items-center gap-2 p-3 rounded-xl border border-border/60 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all duration-200 text-right disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <prompt.icon className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 transition-colors shrink-0" />
                        <span className="text-xs text-foreground/80 group-hover:text-foreground leading-tight">
                          {prompt.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Capability Cards */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
                    {t("whatICando")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {capabilityCards.map((cap) => (
                      <div
                        key={cap.title}
                        className="group rounded-xl border border-border/60 p-4 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-lg bg-linear-to-br flex items-center justify-center",
                              cap.color
                            )}
                          >
                            <cap.icon className="w-4 h-4 text-white" />
                          </div>
                          <h4 className="font-semibold text-sm">{cap.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                          {cap.description}
                        </p>
                        <div className="space-y-1">
                          {cap.examples.map((ex) => (
                            <button
                              key={ex}
                              onClick={() => handleQuickPrompt(ex)}
                              disabled={isSending}
                              className="block w-full text-right text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline cursor-pointer transition-colors disabled:opacity-50"
                            >
                              &laquo; {ex}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Chat Messages */
              <div className="max-w-3xl mx-auto space-y-1">
                {displayMessages.map((msg, i) => {
                  const isLastAssistant = i === lastAssistantIndex
                  return (
                    <ChatMessage
                      key={msg.id}
                      role={msg.role as "user" | "assistant"}
                      content={msg.content}
                      timestamp={msg.timestamp}
                      isStreaming={msg.isStreaming}
                      onRegenerate={isLastAssistant && !isSending ? regenerate : undefined}
                    />
                  )
                })}

                {pendingActions.map((action) => (
                  <div key={action.id} className="max-w-lg mr-10">
                    <AIActionCard
                      actionId={action.id}
                      toolName={action.toolName}
                      description={action.description}
                      params={action.params}
                      onApprove={(id, modifiedParams) => executeAction(id, true, modifiedParams)}
                      onReject={(id) => executeAction(id, false)}
                      isExecuting={isExecuting}
                    />
                  </div>
                ))}

                {/* Typing indicator: only shown if the streaming bubble has no text yet */}
                {isSending && !displayMessages.some((m) => m.isStreaming && m.content) && (
                  <div className="flex gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-md">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="max-w-[75%]">
                      {toolActivity?.status === 'running' ? (
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border border-border/40">
                          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                            <Search className="w-4 h-4 text-emerald-500 animate-pulse" />
                            <span>{toolActivity.label}...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border border-border/40">
                          <div className="flex gap-1.5">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t bg-background/80 backdrop-blur-sm p-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3">
              {isSending ? (
                <Button
                  size="icon"
                  className="h-11 w-11 rounded-xl bg-linear-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg shadow-red-500/20 shrink-0 transition-all duration-200"
                  onClick={handleStop}
                  title={t("stopGeneration")}
                >
                  <Square className="w-5 h-5 fill-current" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-11 w-11 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 shrink-0 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/30"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  title={t("send")}
                >
                  <Send className="w-5 h-5" />
                </Button>
              )}
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isSending ? t("assistantTyping") : t("typingPlaceholder")}
                  disabled={isSending}
                  className="w-full resize-none rounded-xl border border-input bg-muted/30 px-5 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-muted-foreground/60 min-h-[48px] max-h-[160px] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  rows={1}
                  dir="rtl"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
              {t("disclaimer")}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function ChatMessage({
  role,
  content,
  timestamp,
  isStreaming,
  onRegenerate,
}: {
  role: "user" | "assistant"
  content: string
  timestamp?: string
  isStreaming?: boolean
  onRegenerate?: () => void
}) {
  const isUser = role === "user"
  const [copied, setCopied] = useState(false)
  const t = useTranslations("admin.aiAssistant")

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div className={cn("group flex gap-3 mb-4", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-md",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-linear-to-br from-emerald-500 to-teal-600 text-white"
        )}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>
      <div className="max-w-[75%] flex flex-col">
        <div
          className={cn(
            "rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm border border-border/40"
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap wrap-break-word">{content}</div>
          ) : (
            <div className="ai-markdown" dir="auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-emerald-500 rounded-sm animate-pulse align-middle mr-0.5" />
              )}
            </div>
          )}
          {timestamp && !isStreaming && (
            <div className={cn("text-[10px] mt-2 opacity-50", isUser ? "text-left" : "text-right")}>
              {new Date(timestamp).toLocaleTimeString("ar-TN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>

        {/* Hover-revealed assistant actions */}
        {!isUser && !isStreaming && content.trim() && (
          <div className={cn(
            "flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity",
            "text-muted-foreground"
          )}>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md hover:bg-muted hover:text-foreground transition-colors"
              title={t("copyText")}
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copied ? t("copied") : t("copyText")}
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md hover:bg-muted hover:text-foreground transition-colors"
                title={t("regenerate")}
              >
                <RotateCcw className="w-3 h-3" />
                {t("regenerate")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
