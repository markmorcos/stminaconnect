// Runs before jest-expo's preset setup.
// jest-expo (SDK 54) installs lazy getters on global for various WinterCG/Web
// polyfills (URL, structuredClone, __ExpoImportMetaRegistry, etc.). The first
// access of any of these triggers a `require()` which Jest's runtime rejects
// with "outside of test scope" because access happens during setup. We
// pre-define each global with a non-configurable stub so `installGlobal`
// detects an existing non-configurable descriptor and short-circuits.

const stubs = {
  TextDecoder: globalThis.TextDecoder,
  TextDecoderStream: globalThis.TextDecoderStream,
  TextEncoderStream: globalThis.TextEncoderStream,
  URL: globalThis.URL,
  URLSearchParams: globalThis.URLSearchParams,
  structuredClone: globalThis.structuredClone,
  __ExpoImportMetaRegistry: { register() {}, get() {} },
};

for (const [name, value] of Object.entries(stubs)) {
  if (value === undefined) continue;
  Object.defineProperty(globalThis, name, {
    value,
    configurable: false,
    enumerable: true,
    writable: false,
  });
}
