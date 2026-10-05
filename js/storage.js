// localStorage wrapper. Storage can be unavailable (private browsing, blocked
// cookies), so every call is guarded and falls back gracefully.
export const storage = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Progress just won't be remembered.
    }
  }
};
