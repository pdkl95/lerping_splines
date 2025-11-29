# LERPing Splines

Generating a
[Bézier curve](https://en.wikipedia.org/wiki/B%C3%A9zier_curve)
only requires stacking
[linear interpolations](https://en.wikipedia.org/wiki/Linear_interpolation)
(lerp).

## Features

* Interactive curve rendering, with each lerp visualized.

* Bézier curves can be order 1 through 8

* Generates matching pseudocode.

## Usage

Try it live on GitHub:

[https://pdkl95.github.io/lerping_splines/](https://pdkl95.github.io/lerping_splines/)


Or, check out the repository (or
[download a snapshot](https://github.com/pdkl95/lerping_splines/archive/refs/heads/main.zip))
and open `lerping_splines.html` in a browser.

## Building

Building is _only_ necessary if you make changes to `main.coffee`! The
compiled `main.js` is already included.

Tf you really do want to build from the CoffeeScript source, note that
this was written using
[CoffeeScript version 1.12.7](http://coffeescript.org/v1/)!

## License

LERPing Splines is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

LERPing Splines is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a [copy](LICENSE) of the GNU General Public License
along with LERPing Splines.  If not, see <https://www.gnu.org/licenses/>.
