# LVD2SVG

## Environment

`Node.js v24.0.2`

## `L`inear / radial gradient `V`ector `D`rawable `To` `SVG` converter

linear-gradient or radial-gradient android vector drawable to SVG converter.

## Usage

```bash
npm i lvd2svg -g
cd drawable
lvd2svg
```

Specify the output directory; the default is `./out`. Example:

```bash
cd drawable
lvd2svg -o ./outfile
```

## Support Tag

`<path>` `<group>` `<gradient>`

References：

- [VectorDrawable](https://developer.android.com/reference/android/graphics/drawable/VectorDrawable)
- [SVG Path](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/path)
