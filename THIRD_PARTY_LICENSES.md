# Third-party licences

## astronomy-engine

- Package: `astronomy-engine` 2.1.19 (the version in `package-lock.json`)
- Author: Don Cross
- Source: https://github.com/cosinekitty/astronomy
- Licence: MIT
- Used for: Sun, Moon and planet positions, nutation, obliquity, sidereal time, sunrise (see `docs/licensing.md`)

The licence text below is the `LICENSE` file of the upstream repository at tag `v2.1.19`, copied unchanged.
The npm package ships no separate `LICENSE` file, so it was checked against the licence comment at the top of
`node_modules/astronomy-engine/astronomy.js`: the text is identical, including the copyright line
(2019-2023). The `master` branch of the upstream repository only extends the year range to 2019-2025.

```
MIT License

Copyright (c) 2019-2023 Don Cross <cosinekitty@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Material Web (vendored, front end only)

- Package: `@material/web` 2.5.0, bundled with esbuild 0.28.2 into one classic script
- Author: Google LLC
- Source: https://github.com/material-components/material-web
- Licence: Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0)
- File: `public/vendor/material-web-2.5.0.js` (static asset, not an npm dependency; the Worker does not import it)
- Used for: the Material Design 3 components on `public/index.html` (`md-*` elements)

## Material Symbols (inline SVG paths)

- Package: `@material-symbols/svg-400` 0.48.2 (Outlined)
- Author: Google LLC
- Source: https://github.com/google/material-design-icons
- Licence: Apache License 2.0
- Used for: the icons inlined in `public/index.html`

## Roboto (font files)

- Package: `@fontsource/roboto` 5.3.0, files `roboto-latin-{400,500,700}-normal.woff2`
- Author: Christian Robertson / Google
- Licence: SIL Open Font License 1.1 (https://openfontlicense.org)
- Files: `public/fonts/Roboto-{400,500,700}.woff2`
