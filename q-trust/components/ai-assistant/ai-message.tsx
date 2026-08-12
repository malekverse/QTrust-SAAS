"use client"

import { cn } from '@/lib/utils'
import { Bot, User } from 'lucide-react'

interface AIMessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export function AIMessage({ role, content, timestamp }: AIMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex gap-2 mb-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm'
        )}
      >
        <div className="whitespace-pre-wrap break-words">{content}</div>
        {timestamp && (
          <div
            className={cn(
              'text-[10px] mt-1 opacity-60',
              isUser ? 'text-left' : 'text-right'
            )}
          >
            {new Date(timestamp).toLocaleTimeString('ar-TN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>
    </div>
  )
}
