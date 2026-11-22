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

## ERFA (derived: IAU 2000B nutation coefficient table)

- Package: ERFA 2.0.1 (Essential Routines for Fundamental Astronomy), file `src/nut00b.c`
- Authors: NumFOCUS Foundation and contributors; derived, with permission, from the IAU SOFA library
- Source: https://github.com/liberfa/erfa (tag `v2.0.1`; the copy read was the one bundled in `pyerfa` 2.0.1.5)
- Licence: BSD-3-Clause
- Used for: the 77-term IAU 2000B luni-solar nutation coefficient table in `src/engine/nutation.ts`
  (`IAU2000B_TERMS`). Only the numeric table and the structure of the series were taken; the code is
  TypeScript. ERFA is not a dependency and no ERFA code is shipped otherwise. The table is the one
  published in IERS Conventions (2003) / McCarthy & Luzum (2003). No Swiss Ephemeris source code was used.

The licence text below is the `LICENSE` file of the upstream repository, copied unchanged with `curl` from
https://raw.githubusercontent.com/liberfa/erfa/master/LICENSE. It is identical at tag `v2.0.1` and to the
`LICENSE` bundled in `pyerfa` 2.0.1.5. The file `nut00b.c` itself carries the copyright line
"Copyright (C) 2013-2023, NumFOCUS Foundation" and the same terms.

```
Copyright (C) 2013-2021, NumFOCUS Foundation.
All rights reserved.

This library is derived, with permission, from the International
Astronomical Union's "Standards of Fundamental Astronomy" library,
available from http://www.iausofa.org.

The ERFA version is intended to retain identical
functionality to the SOFA library, but made distinct through
different function and file names, as set out in the SOFA license
conditions. The SOFA original has a role as a reference standard
for the IAU and IERS, and consequently redistribution is permitted only
in its unaltered state. The ERFA version is not subject to this
restriction and therefore can be included in distributions which do not
support the concept of "read only" software.

Although the intent is to replicate the SOFA API (other than replacement of
prefix names) and results (with the exception of bugs; any that are
discovered will be fixed), SOFA is not responsible for any errors found
in this version of the library.

If you wish to acknowledge the SOFA heritage, please acknowledge that
you are using a library derived from SOFA, rather than SOFA itself.


TERMS AND CONDITIONS

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1 Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.

2 Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

3 Neither the name of the Standards Of Fundamental Astronomy Board, the
   International Astronomical Union nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
