import { expect, test } from 'vitest'
import { ApiError } from './api/client'
import { shouldRetry } from './queryClient'

test('does not retry a 404', () => {
  expect(shouldRetry(0, new ApiError('x', 404))).toBe(false)
  expect(shouldRetry(0, new ApiError('x', 500))).toBe(true)
  expect(shouldRetry(0, new ApiError('x', null))).toBe(true)
  expect(shouldRetry(3, new ApiError('x', 500))).toBe(false)
})

test('retries only network errors and server errors', () => {
  expect(shouldRetry(0, new ApiError('Response does not match the schema', 200))).toBe(false)
  expect(shouldRetry(0, new ApiError('Invalid JSON in response', 200))).toBe(false)
  expect(shouldRetry(0, new ApiError('x', 422))).toBe(false)
  expect(shouldRetry(0, new ApiError('x', 503))).toBe(true)
  expect(shouldRetry(2, new ApiError('x', null))).toBe(true)
  expect(shouldRetry(3, new ApiError('x', null))).toBe(false)
  expect(shouldRetry(0, new TypeError('x'))).toBe(false)
})
