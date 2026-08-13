import { z } from 'zod'
import { AI_TOOLS } from './tools'

// Per-tool argument validation. Rather than hand-maintain ~40 parallel Zod
// schemas, we derive them from the same JSON-Schema `parameters` the tools are
// already declared with (the single source of truth in tools.ts) — so a new
// tool is covered automatically. Validated args are parsed BEFORE executeTool,
// so a malformed LLM tool-call can't slip an out-of-schema value into Mongoose,
// and unknown keys are stripped (Zod object default).

type JsonSchemaNode = {
  type?: string
  enum?: unknown[]
  items?: JsonSchemaNode
  properties?: Record<string, JsonSchemaNode>
  required?: string[]
}

function nodeToZod(node: JsonSchemaNode): z.ZodTypeAny {
  // String enums first (applies to plain fields and array item types).
  if (Array.isArray(node.enum)) {
    const vals = node.enum.filter((v): v is string => typeof v === 'string')
    if (vals.length > 0) return z.enum(vals as [string, ...string[]])
  }
  switch (node.type) {
    case 'string':
      return z.string()
    case 'integer':
    case 'number':
      return z.number()
    case 'boolean':
      return z.boolean()
    case 'array':
      return z.array(node.items ? nodeToZod(node.items) : z.unknown())
    case 'object':
      return objectToZod(node)
    default:
      return z.unknown()
  }
}

function objectToZod(node: JsonSchemaNode): z.ZodTypeAny {
  const props = node.properties ?? {}
  const required = new Set(node.required ?? [])
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, sub] of Object.entries(props)) {
    const base = nodeToZod(sub)
    shape[key] = required.has(key) ? base : base.optional()
  }
  return z.object(shape) // unknown keys are stripped by default
}

const TOOL_ARG_SCHEMAS: Map<string, z.ZodTypeAny> = new Map(
  AI_TOOLS.flatMap((t) => {
    if (!t.function) return []
    const params = (t.function.parameters as JsonSchemaNode | undefined) ?? {
      type: 'object',
      properties: {},
    }
    return [[t.function.name, objectToZod(params)] as const]
  })
)

export function validateToolArgs(
  toolName: string,
  args: unknown
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const schema = TOOL_ARG_SCHEMAS.get(toolName)
  // Unknown tool name: let executeTool return its own "unknown tool" error.
  if (!schema) return { ok: true, data: (args ?? {}) as Record<string, unknown> }

  const parsed = schema.safeParse(args ?? {})
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path?.join('.')
    return {
      ok: false,
      error: `معطيات غير صالحة للأداة ${toolName}${field ? ` (الحقل: ${field})` : ''}: ${issue?.message ?? 'خطأ في التحقق'}`,
    }
  }
  return { ok: true, data: parsed.data as Record<string, unknown> }
}
