/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const script = join(process.cwd(), 'scripts/check-no-demo.sh')
const dirs: string[] = []

function build(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'no-demo-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'assets'))
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  return dir
}

const run = (dir: string) => spawnSync('bash', [script, dir], { encoding: 'utf8' }).status

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('scripts/check-no-demo.sh', () => {
  it('passes on a clean build', () => {
    expect(run(build({ 'index.html': '<div id="root"></div>', 'assets/app.js': 'console.log(1)' }))).toBe(0)
  })

  it.each(['[MSW]', 'shop-react-demo-overrides', 'mockServiceWorker', 'Vyzkoušejte okrajové stavy'])(
    'fails when a file contains %s',
    (pattern) => {
      expect(run(build({ 'assets/app.js': `x("${pattern}")` }))).toBe(1)
    },
  )

  it('fails when 404.html is present', () => {
    expect(run(build({ '404.html': '<html></html>' }))).toBe(1)
  })
})
