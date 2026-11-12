# Local image codecs

The image converter loads these files from this site only when a format needs them.
No image data is sent to a conversion service, CDN, or other remote server.
The third-party JavaScript files are unmodified release artifacts.

| File | Version | License | Upstream source |
| --- | --- | --- | --- |
| `heic-to-1.6.7.js` | heic-to 1.6.7, libheif 1.23.7 | LGPL-3.0-or-later | https://github.com/hoppergee/heic-to/tree/78345a3fcdb4a1d70d513fce2646aeff0127f7ba |
| `UTIF-3.1.0.js` | UTIF 3.1.0 | MIT | https://github.com/photopea/UTIF.js |
| `pako-1.0.11.min.js` | pako 1.0.11 | MIT and Zlib | https://github.com/nodeca/pako/tree/1.0.11 |
| `omggif-1.0.10.js` | omggif 1.0.10 | MIT | https://github.com/deanm/omggif |

License texts accompany each library, including the incorporated GNU GPL v3 text
and libheif's complete notices. The HEIC decoder is a separate, replaceable
script and runs its embedded libheif decoder in a local Web Worker. Its matching
source and build instructions are available in the pinned heic-to source above;
libheif source: https://github.com/strukturag/libheif/tree/v1.23.7. Its HEVC decoder
is libde265: https://github.com/strukturag/libde265 (LGPL-3.0-or-later).

The following exact release URLs supplied the files:

- https://cdn.jsdelivr.net/npm/heic-to@1.6.7/dist/iife/heic-to.js
- https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js
- https://cdn.jsdelivr.net/npm/pako@1.0.11/dist/pako.min.js
- https://cdn.jsdelivr.net/npm/omggif@1.0.10/omggif.js

PNG/JPEG/WebP encoding uses the browser's canvas implementation. BMP encoding,
adaptive GIF palette generation, and uncompressed ZIP packaging are implemented
in `imageConverter.js`. GIF output is a still image; animated input is flattened.
TIFF input uses the first image page and HEIC input uses the primary image.
