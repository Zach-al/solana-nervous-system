// ── SOLNET Stable Storage ──────────────────────────────────
// Provides a crash-proof storage bridge for Hermes stability.

export const MemoryStorage = {
  getItem: (name: string) => {
    const val = global.__SOLNET_MEM_STORAGE?.[name];
    return val !== undefined ? val : null;
  },
  setItem: (name: string, value: string) => {
    if (!global.__SOLNET_MEM_STORAGE) global.__SOLNET_MEM_STORAGE = {};
    global.__SOLNET_MEM_STORAGE[name] = value;
  },
  removeItem: (name: string) => {
    if (global.__SOLNET_MEM_STORAGE) {
      delete global.__SOLNET_MEM_STORAGE[name];
    }
  },
};

/**
 * Note: For production persistence of sensitive data, 
 * always use expo-secure-store. This MemoryStorage is 
 * for non-crashing UI state (Node activity, history).
 */
