/**
 * Gives tests a working `localStorage`.
 *
 * Vitest's jsdom environment copies window property descriptors onto
 * `globalThis`, which leaves jsdom's `localStorage` getter unbound: it reads a
 * backing field that is not there and yields `undefined` (and on an opaque
 * origin, jsdom throws outright). Code under test that persists anything needs
 * a real implementation, so install one when the environment has none.
 */
const hasWorkingStorage = (): boolean => {
  try {
    return Boolean(globalThis.localStorage)
  } catch {
    return false
  }
}

if (!hasWorkingStorage()) {
  const store = new Map<string, string>()

  const storage: Storage = {
    get length() {
      return store.size
    },
    clear: () => {
      store.clear()
    },
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(key, String(value))
    }
  }

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage
  })
}
