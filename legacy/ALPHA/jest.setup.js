/**
 * Jest setup file - adds polyfills and global configuration for tests
 */

// Polyfill for structuredClone (Node.js < 17)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
  };
}
