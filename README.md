# ClearFrame

A local-first metadata scanner and selective cleaner for JPEG, PNG, and WebP images.

## Interface

A minimal charcoal interface with a single upload area, per-photo cleaning controls, and a separate Photo details tab. Optional credential and display settings expand on demand. Keyboard navigation and reduced-motion preferences are supported.

Use **Try a sample** to explore the workflow with a local illustration and explicitly fictional metadata. Serve the directory over HTTP for the sample button to work.

## Inspect and clean

- View available decoded EXIF, GPS, camera/lens, exposure, date, author, copyright, IPTC, XMP, thumbnail, and ICC tags, alongside basic file information.
- Inventory JPEG application/comment segments, PNG ancillary chunks, WebP metadata/unknown chunks, and trailing data. Unknown or proprietary blocks are listed even when their contents cannot be decoded.
- Select individual metadata blocks, **Select all**, or **Deselect all** for the current image. Selections persist when switching images.
- Download one image or export the batch as a ZIP using each image's selections. Duplicate filenames receive numbered prefixes in ZIP exports.
- Color/display metadata and detected credentials are kept by default. Essential image, transparency, animation, and JPEG Adobe color-transform data are preserved.

Cleaning operates on whole blocks, not individual EXIF tags. Removing an EXIF block removes all its tags, including GPS, orientation, and embedded thumbnails. Removing orientation or color profiles can change display even though encoded pixels are not recompressed. Removing credentials discards provenance; any metadata edit may invalidate a signature. Credentials are not cryptographically verified.

The scanner does not promise to decode every proprietary tag or detect data hidden in image pixels. Dimensions, encoded image content, file-system dates, and visible content are not removable metadata. Formats beyond JPEG, PNG, and WebP are not supported.

## Privacy

Files are processed entirely in the browser and are never uploaded. The pinned exifr 7.1.3 decoder is vendored locally with its license. JSZip and fonts are loaded externally; these requests do not contain selected image data.

## Run locally

Open `index.html` in a browser or serve this directory with any static file server:

```sh
python3 -m http.server 8080
```

## Tests

```sh
npm ci
npm test
```

The tests cover metadata inventories, selection persistence and exports, malformed containers, progressive JPEG scans, compressed PNG text, EXIF decoding, WebP sizes/flags, and safe rendering of embedded text. Test-only dependencies are not needed to run the app.

Container references: [PNG specification](https://www.w3.org/TR/png-3/), [WebP specification](https://developers.google.com/speed/webp/docs/riff_container), [exifr](https://github.com/MikeKovarik/exifr).
