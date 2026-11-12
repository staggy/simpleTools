# Simple Tools

Small browser utilities built with plain HTML, CSS, and JavaScript. No build step or application backend is required.

From the repository root, run:

```sh
python -m http.server 8765 --bind 127.0.0.1 --directory html
```

Open http://127.0.0.1:8765/. The `html/` directory can also be deployed to static hosting.

## Tools

Alongside the existing calculators, unit converters, checksums, and elapsed-time tool:

| Tool | Features |
| --- | --- |
| Image Converter | Batch conversion and ZIP download; dimensions/percentage resizing, aspect lock, quality, transparency, and background controls. HEIC/HEIF, TIFF, GIF, and native image inputs; PNG, JPEG, WebP, GIF, TIFF, and BMP outputs. |
| Hex Viewer & Editor | Paged hex/ASCII views, byte editing, undo/reset, offset jumps, streaming hex/text search, and modified binary downloads. |
| EXIF & Metadata | Inspect JPEG, PNG, WebP, GIF, TIFF, HEIC/HEIF, and AVIF metadata. Select individual Exif fields or metadata blocks to remove; download cleaned images or metadata reports. |
| Color Converter | HEX, RGB/RGBA, HSL, HSV, approximate CMYK, Lab, LCH, OKLab, OKLCH, XYZ D50/D65, and Display P3, including alpha. |
| Password Generator | Browser cryptographic randomness, optional random-city weather mixing, offline fallback, bulk generation, character exclusions, copy/download, and entropy estimates. |
| Unix Timestamp | Seconds/milliseconds, exact fractional-second parsing, local-time default, world time zones, UTC, and explicit daylight-saving ambiguity handling. |
| Text Diff Viewer | Aligned side-by-side views, line numbers, inline highlights, synchronized scrolling, change navigation, uploads, and whitespace/case options. |
| JSON Formatter & Validator | Strict syntax validation, error locations, indentation/minification, upload/download, duplicate-key warnings, and exact preservation of numbers and string escapes. |

The homepage includes tool search. Shared-layout pages link to the new tools and retain light/dark themes and mobile navigation.

## Processing and format details

Files stay in the browser. Image codecs are bundled locally and loaded when needed; there is no conversion API, runtime CDN dependency, or image upload. The password generator can request public weather from [Open-Meteo](https://open-meteo.com/), sending only a randomly selected city's coordinates. It always uses `crypto.getRandomValues()` and continues securely when weather is unavailable. Weather is not counted as secret entropy; the generator does not claim direct access to a physical true-random source. Passwords are not saved in browser storage.

Image conversion creates still images: the first GIF frame, first TIFF page, or primary HEIC image. HEIC output and animation preservation are not included. Conversion removes source metadata; use the metadata tool for selective removal while retaining image data. Limits: 128 MiB per input, 64 megapixels and 16,384 pixels per side, 100 files per batch. Native AVIF decoding depends on the browser.

Metadata removal preserves container layout where required. HEIC items may remain as valid empty metadata items with their contents overwritten. TIFF image-layout fields are protected; BigTIFF is unsupported. Unsafe or unsupported layouts are rejected. Removing orientation or color profiles can change image display. The viewer lists recognized metadata and warns about structures it cannot safely inspect.

Lab/LCH use D50; OKLab/OKLCH use D65. CMYK is an approximation without a printer profile. sRGB outputs are clipped for colors outside sRGB. Timestamp inputs support calendar years 0001–9999. Diff limits are 5 MiB and 20,000 lines per side, with coarser matching for large unrelated blocks. JSON limits are 10 MiB and 512 nesting levels; validation checks syntax rather than JSON Schema.

Third-party versions, licenses, and source links are in [html/vendor/image/README.md](html/vendor/image/README.md) and [html/vendor/color/README.md](html/vendor/color/README.md).

## Verification

Node.js 20+ runs the dependency-free unit/fixture tests:

```sh
npm test
```

For browser checks, install the development-only dependency and Chromium:

```sh
npm install
npx playwright install chromium
npm run test:browser
npm run test:browser:metadata
```

Those checks start their own local servers. With the development server running on port 8765, also run:

```sh
npm run test:browser:data
npm run test:browser:images
```

The image check optionally accepts `HEIC_TEST_FILE` pointing to a local HEIC sample. `SIMPLE_TOOLS_URL` overrides the development-server URL. All browser checks accept `PLAYWRIGHT_MODULE` to locate an existing installation. Shared/metadata checks accept `BROWSER_EXECUTABLE` or `BROWSER_CHANNEL`; image/data checks accept `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. `SCREENSHOT_DIR` enables screenshots in the shared check.

The `python/` directory contains the original standalone UART and telnet utilities.
