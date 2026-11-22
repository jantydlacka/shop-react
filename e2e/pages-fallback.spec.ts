import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// Playwright requires the destructured first argument.
// eslint-disable-next-line no-empty-pattern
test('demo build ships a 404.html identical to index.html', ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'file check, runs once')
  const index = readFileSync('dist-demo/index.html')
  const fallback = readFileSync('dist-demo/404.html')
  expect(fallback.equals(index)).toBe(true)
})
