import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api/client'

// A 404 will not change on retry, so it surfaces at once.
export const shouldRetry = (failureCount: number, error: unknown): boolean =>
  !(error instanceof ApiError && error.status === 404) && failureCount < 3

export const createQueryClient = (retry: typeof shouldRetry | false = shouldRetry) =>
  new QueryClient({ defaultOptions: { queries: { retry } } })
