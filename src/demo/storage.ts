// sessionStorage can throw (blocked, quota); the demo then works without persistence.

export function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // ignored: see above
  }
}

export function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignored: see above
  }
}
