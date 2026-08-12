"use client"

import { ReactNode } from 'react'
import { AIProvider } from './ai-provider'

export function AdminAIWrapper({ children }: { children: ReactNode }) {
  return <AIProvider>{children}</AIProvider>
}
