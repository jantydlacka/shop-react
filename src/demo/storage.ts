// Web Storage can throw (blocked, quota); the demo then works without persistence.

type Store = {
  get: (key: string) => string | null
  set: (key: string, value: string) => void
  remove: (key: string) => void
}

function guarded(storage: () => Storage): Store {
  return {
    get: (key) => {
      try {
        return storage().getItem(key)
      } catch {
        return null
      }
    },
    set: (key, value) => {
      try {
        storage().setItem(key, value)
      } catch {
        // ignored: see above
      }
    },
    remove: (key) => {
      try {
        storage().removeItem(key)
      } catch {
        // ignored: see above
      }
    },
  }
}

// Lives as long as the cart (localStorage): catalogue overrides and placed orders.
export const persistent = guarded(() => localStorage)
// Per tab: the armed scenario and the panel state.
export const session = guarded(() => sessionStorage)
