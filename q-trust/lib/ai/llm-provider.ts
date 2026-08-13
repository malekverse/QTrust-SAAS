import type Groq from 'groq-sdk'
import { getGroqClient, AI_MODEL, AI_MODEL_FAST, AI_CONFIG } from './groq-client'

export { AI_MODEL, AI_MODEL_FAST, AI_CONFIG }

// Derive the params/messages types from the client's own create() signature so
// we don't depend on a specific exported type name (it varies across SDK versions).
type CreateParams = Parameters<ReturnType<typeof getGroqClient>['chat']['completions']['create']>[0]
export type ChatMessages = CreateParams['messages']
type ChatTools = Groq.Chat.Completions.ChatCompletionTool[]

// The streamed-chunk shape the routes rely on. Kept local (not the SDK's
// ChatCompletionChunk) so `usage` — populated by include_usage, which the SDK
// types omit — is visible without casts at every call site.
export interface LlmStreamChunk {
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null
  choices: Array<{
    delta?: {
      content?: string
      tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>
    }
    finish_reason?: string | null
  }>
}

export interface StreamChatOptions {
  messages: ChatMessages
  tools?: ChatTools
  maxTokens: number
}

// The single point the app talks to the LLM vendor for streaming completions.
// Swapping Groq for another OpenAI-compatible host, or changing the model, is a
// change in THIS file only — not across chat/route.ts and execute/route.ts.
export async function streamChat(opts: StreamChatOptions): Promise<AsyncIterable<LlmStreamChunk>> {
  const groq = getGroqClient()
  // Built as a variable (not an inline literal) so `stream_options` — valid at
  // the Groq API but absent from the SDK's param types — isn't rejected by the
  // excess-property check.
  const body = {
    model: AI_MODEL,
    messages: opts.messages,
    ...(opts.tools ? { tools: opts.tools, tool_choice: 'auto' as const, parallel_tool_calls: false } : {}),
    temperature: AI_CONFIG.temperature,
    max_tokens: opts.maxTokens,
    top_p: AI_CONFIG.top_p,
    stream: true as const,
    stream_options: { include_usage: true },
  }
  const stream = await groq.chat.completions.create(body)
  return stream as unknown as AsyncIterable<LlmStreamChunk>
}

export interface FastChatOptions {
  messages: ChatMessages
  maxTokens: number
  temperature?: number
}

// Non-streaming completion on the fast/cheap model (e.g. conversation titles).
export async function createFastChat(opts: FastChatOptions): Promise<string | null> {
  const groq = getGroqClient()
  const completion = await groq.chat.completions.create({
    model: AI_MODEL_FAST,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens,
  })
  return completion.choices[0]?.message?.content?.trim() ?? null
}
