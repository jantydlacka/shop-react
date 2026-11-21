import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api/client'

// Only a lost connection or a server error can change on retry; a 4xx or an invalid body cannot.
export const shouldRetry = (failureCount: number, error: unknown): boolean =>
  error instanceof ApiError && (error.status === null || error.status >= 500) && failureCount < 3

export const createQueryClient = (retry: typeof shouldRetry | false = shouldRetry) =>
  new QueryClient({ defaultOptions: { queries: { retry } } })
