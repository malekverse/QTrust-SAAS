import { NextRequest } from 'next/server'

export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export function parsePagination(
  request: NextRequest | URL | URLSearchParams,
  defaults?: { limit?: number; maxLimit?: number }
): PaginationParams {
  const maxLimit = defaults?.maxLimit ?? MAX_LIMIT
  const defaultLimit = defaults?.limit ?? DEFAULT_LIMIT

  const sp =
    request instanceof URLSearchParams
      ? request
      : request instanceof URL
        ? request.searchParams
        : new URL(request.url).searchParams

  const page = Math.max(1, Math.floor(Number(sp.get('page') || 1)))
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(sp.get('limit') || defaultLimit))))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      pages: Math.ceil(total / params.limit),
    },
  }
}
