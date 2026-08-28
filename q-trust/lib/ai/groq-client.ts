import Groq from 'groq-sdk'

let groqInstance: Groq | null = null

export function getGroqClient(): Groq {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set')
    }
    groqInstance = new Groq({ apiKey })
  }
  return groqInstance
}

export const AI_MODEL = 'openai/gpt-oss-120b'
export const AI_MODEL_FAST = 'openai/gpt-oss-20b'

export const AI_CONFIG = {
  temperature: 0.3,
  max_tokens_tool_round: 1536,
  max_tokens_final: 2048,
  top_p: 0.9,
} as const
