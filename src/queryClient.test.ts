import { expect, test } from 'vitest'
import { ApiError } from './api/client'
import { shouldRetry } from './queryClient'

test('does not retry a 404', () => {
  expect(shouldRetry(0, new ApiError('x', 404))).toBe(false)
  expect(shouldRetry(0, new ApiError('x', 500))).toBe(true)
  expect(shouldRetry(0, new ApiError('x', null))).toBe(true)
  expect(shouldRetry(3, new ApiError('x', 500))).toBe(false)
})
