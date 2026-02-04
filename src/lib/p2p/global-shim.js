/**
 * Browser-compatible global shim for Node.js libraries
 * This file is loaded before any Node.js-dependent libraries
 */

// Define global for browser environment
if (typeof global === 'undefined') {
  if (typeof window !== 'undefined') {
    window.global = window;
  }
}

// Polyfill process.env for libraries that use it
if (typeof process === 'undefined') {
  if (typeof window !== 'undefined') {
    window.process = {
      env: {},
      version: '',
      nextTick: function(fn) { setTimeout(fn, 0); },
      platform: 'browser',
      arch: 'web'
    };
  }
}

// Export for webpack ProvidePlugin
module.exports = {
  globalPolyfill: function() {
    if (typeof global === 'undefined') {
      if (typeof window !== 'undefined') {
        window.global = window;
      }
    }
  }
};
