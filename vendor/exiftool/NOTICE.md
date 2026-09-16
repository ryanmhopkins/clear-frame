# ExifTool browser engine

Vendored from `@colorhythm/exiftool-wasm@1.0.4`:
https://github.com/colorhythm/exiftool-wasm

`index.mjs` is the unchanged `dist/esm/index.js` renamed for explicit ES module loading.
`zeroperl-mqcadjqm.wasm` is unchanged. The wrapper is Apache-2.0 (LICENSE).
The WASM package includes ExifTool 13.59 by Phil Harvey and the zeroperl Perl runtime.
ExifTool and Perl are available under the Perl Artistic License (ARTISTIC-PERL).
Upstream source: https://github.com/exiftool/exiftool and https://github.com/colorhythm/zeroperl.

The engine is fetched from this site's own origin only when an extended photo is added.
It runs in a module worker. Images never leave the browser.
