// Global polyfill for browser environment
if (typeof global === 'undefined') {
  if (typeof window !== 'undefined') {
    window.global = window;
  }
}
