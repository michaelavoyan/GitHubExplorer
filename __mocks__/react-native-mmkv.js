/**
 * Manual jest mock for `react-native-mmkv`, per that package's own testing
 * guidance (no native binding is available in the jest/RN-preset
 * environment). In-memory only; each `new MMKV(...)` call gets its own
 * isolated store, matching the id-scoping the real library provides.
 * Applied automatically by Jest for any test importing `react-native-mmkv`
 * (root `__mocks__/` adjacent to `node_modules`), no explicit jest.mock()
 * call required in test files.
 */
class MMKV {
  constructor() {
    this.store = new Map();
  }
  getString(key) {
    return this.store.get(key);
  }
  set(key, value) {
    this.store.set(key, String(value));
  }
  delete(key) {
    this.store.delete(key);
  }
  contains(key) {
    return this.store.has(key);
  }
  getAllKeys() {
    return Array.from(this.store.keys());
  }
  clearAll() {
    this.store.clear();
  }
}

module.exports = { MMKV };
