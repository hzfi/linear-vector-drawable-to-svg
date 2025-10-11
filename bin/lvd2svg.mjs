#!/usr/bin/env node
// const { transform } = require('..');

import { readdir, existsSync, mkdirSync, readFileSync, writeFile } from 'fs';
import path from 'path';
import { Parser } from 'xml2js';;
import packageJson from '../package.json'  with { type: "json" };


const checkArgs = () => {
  if (process.argv.includes('-o')) {
    const outputIndex = process.argv.findIndex(x => x === '-o')
    const dir = process.argv[outputIndex + 1]
    if (dir) {
      outDir = dir
    }
  }

  if (process.argv.includes('-h') || process.argv.includes('--help')) {
    const str = `
Usage: lvd2svg [options]

Options:
  -o\t\t\t specify the output directory, default is ./out
  -h, --help\t\t print help
  -v, --version\t\t print lvd2svg version
`
    console.log(str);

    return true
  }


  if (process.argv.includes('-v') || process.argv.includes('--version')) {
    console.log(`
lvd2svg:
version: ${packageJson.version}
`);
    return true
  }

}

// if (!inputFile) {
//   throw new Error('inputFile is invalid');
// }

// if (!outputFile) {
//   throw new Error('outputFile is invalid');
// }



// const [text] = process.argv.slice(2);

const colorContainer = new Map()

const readXml = (file) => {

  try {
    const c = readFileSync(file, 'utf-8',)
    return c
  } catch (error) {
    console.log('-readXml error: ', error);


  }
}

function chunkArray(arr, chunkSize) {
  const result = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize));
  }
  return result;
}

//  `#${c}${b}`
// const color2c = str => str?.replace(/^\#([a-fA-F0-9]{2})([a-fA-F0-9]{6})/g, (a, b, c) => `#${c}`)
// const color2c = str => {
//   const [alpha, r, g, b] = chunkArray(str.replace('#', ''), 2);
//   const c = [r, g, b].map(x => parseInt(x, 16)).join(', ')
//   const alphaVal = parseInt(alpha, 16) / 255
//   return `rgba(${c}, ${alphaVal})`
// }
const color2c = str => {
  if (!/^#[0-9a-fA-F]{8}$/g.test(str)) {
    return {}
  }
  const [alpha, r, g, b] = chunkArray(str.replace('#', ''), 2);
  const alphaVal = parseInt(alpha, 16) / 255
  return {
    c: '#' + [r, g, b].join(''),
    alpha: alphaVal
  }
}
const gradient2def = (name, json) => {
  const gradient = json.gradient
  if (gradient) {
    const { $: meta, item } = gradient;

    const stopArr = item.map(obj => {
      const { $: x } = obj;
      const offset = x[GLOB_CONFIG.ns + ':offset']
      const { c: color, alpha } = color2c(x[GLOB_CONFIG.ns + ':color'])
      if (!color) return ''
      return `<stop stop-color="${color}"  stop-opacity="${alpha}"  offset="${Number(offset)}"/>`
    })

    if (meta[GLOB_CONFIG.ns + ':type'] === 'linear') {
      const x1 = Number(meta[GLOB_CONFIG.ns + ':startX'])
      const x2 = Number(meta[GLOB_CONFIG.ns + ':endX'])
      const y1 = Number(meta[GLOB_CONFIG.ns + ':startY'])
      const y2 = Number(meta[GLOB_CONFIG.ns + ':endY'])
      return `<linearGradient id="${name}" x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}" >
${stopArr.join('\n')}
</linearGradient>`

    }
    if (meta[GLOB_CONFIG.ns + ':type'] === 'radial') {
      const cx = Number(meta[GLOB_CONFIG.ns + ':centerX'])
      const cy = Number(meta[GLOB_CONFIG.ns + ':centerY'])
      const r = Number(meta[GLOB_CONFIG.ns + ':gradientRadius'])
      return `<radialGradient id="${name}" cx="${cx}" cy="${cy}" r="${r}" >
${stopArr.join('\n')}
</radialGradient>`

    }
  }
}

const hasColor = (val) => {
  const key = val?.split('/').at(-1).replace('$', '')
  const colorDef = colorContainer.get(key)
  if (!colorDef) {
    return { key }
  }
  return { key, colorDef }
}

const getMajoritykey = (arr) => {
  const countMap = arr.reduce((p, c) => { p.has(c) ? p.set(c, p.get(c) + 1) : p.set(c, 1); return p }, new Map())
  const key = [...countMap].map(([a, b]) => [b, a])[0][1]
  return key

}


const v2svg = (json) => {
  const vector = json.vector
  if (vector) {
    // console.log('vector', vector);

    const { $: meta } = vector;
    const metaKeyArr = Object.keys(meta).map(x => x.split(':')[0])
    const globalKey = getMajoritykey(metaKeyArr)
    GLOB_CONFIG.ns = globalKey;
    // console.log('GLOB_CONFIG.ns', GLOB_CONFIG);

    const v2str = (v, lev = 0) => {
      const { path, group } = v;
      let def = ''
      let content = ''
      path?.forEach((obj) => {
        const { $: x } = obj;

        const attr = {
          d: x[GLOB_CONFIG.ns + ':pathData']
        };

        if (x[GLOB_CONFIG.ns + ':name']) {
          attr.id = x[GLOB_CONFIG.ns + ':name']
        }
        if (x[GLOB_CONFIG.ns + ':width']) {
          attr.width = Number(x[GLOB_CONFIG.ns + ':width'])
        }
        if (x[GLOB_CONFIG.ns + ':width']) {
          attr.width = Number(x[GLOB_CONFIG.ns + ':width'])
        }

        const strokeColor = x[GLOB_CONFIG.ns + ':strokeColor']

        if (strokeColor?.startsWith('@') || strokeColor?.startsWith('?')) {
          const { key, colorDef } = hasColor(strokeColor)
          if (colorDef) {
            def += '\n' + colorDef
            attr.stroke = `url(#${key})`
            attr.fill = "none"
          } else {
            attr.stroke = key
          }
        } else if (strokeColor) {
          const { c, alpha } = color2c(strokeColor)
          if (c) {
            attr.stroke = c
            attr['stroke-opacity'] = alpha
            attr.fill = "none"
          }
        }



        const fillColor = x[GLOB_CONFIG.ns + ':fillColor']
        if (fillColor?.startsWith('@') || fillColor?.startsWith('?')) {
          const { key, colorDef } = hasColor(fillColor)
          if (colorDef) {
            def += '\n' + colorDef
            attr.fill = `url(#${key})`
          } else {
            attr.fill = key
          }
        } else if (fillColor) {
          const { c, alpha } = color2c(fillColor)
          if (c) {
            attr.fill = c
            attr['fill-opacity'] = alpha
          }
        }


        if (x[GLOB_CONFIG.ns + ':strokeWidth']) {
          attr['stroke-width'] = x[GLOB_CONFIG.ns + ':strokeWidth']
        }
        if (x[GLOB_CONFIG.ns + ':strokeAlpha']) {
          attr['stroke-opacity'] = x[GLOB_CONFIG.ns + ':strokeAlpha']
        }
        if (x[GLOB_CONFIG.ns + ':fillAlpha']) {
          attr['fill-opacity'] = Number(x[GLOB_CONFIG.ns + ':fillAlpha'])
        }

        if (x[GLOB_CONFIG.ns + ':strokeLineCap']) {
          attr['stroke-linecap'] = x[GLOB_CONFIG.ns + ':strokeLineCap']
        }
        if (x[GLOB_CONFIG.ns + ':strokeLineJoin']) {
          attr['stroke-linejoin'] = x[GLOB_CONFIG.ns + ':strokeLineJoin']
        }
        if (x[GLOB_CONFIG.ns + ':strokeMiterLimit']) {
          attr['stroke-miterlimit'] = Number(x[GLOB_CONFIG.ns + ':strokeMiterLimit'])
        }


        if (x[GLOB_CONFIG.ns + ':fillType']) {
          attr['fill-rule'] = x[GLOB_CONFIG.ns + ':fillType']?.toLowerCase()
        }

        const attrStr = Object.entries(attr).map(([k, v]) => `${k}="${v}"`).join(' ')
        content += `\n<path ${attrStr}/>`
      })
      if (group) {
        group?.forEach((x, i) => {
          let attr = '';
          if (x['clip-path']) {
            x['clip-path']?.forEach((y, j) => {
              if (!j) {
                def += `\n<clipPath id="_clippath_${lev}_${i}_${j}">
<path d="${y['$'][GLOB_CONFIG.ns + ':pathData']}"/>
</clipPath>`
              } else {
                def += `\n<clipPath id="_clippath_${lev}_${i}_${j}">
<g clip-path="url(#_clippath_${lev}_${i}_${j - 1})">
<path d="${y['$'][GLOB_CONFIG.ns + ':pathData']}"/>
</g>
</clipPath>`
              }
              attr = `clip-path="url(#_clippath_${lev}_${i}_${j})"`
            })
          }
          const g = v2str(x, lev + 1)
          def += g.def
          content += `\n<g ${attr}>${g.content}\n</g>`
        })
      }
      return {
        def,
        content
      }
    }

    const { def, content } = v2str(vector)

    const defs = def ? `<defs>${def} </defs>` : ''
    const w = Number(meta[GLOB_CONFIG.ns + ':viewportWidth'])
    const h = Number(meta[GLOB_CONFIG.ns + ':viewportHeight'])
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
${defs}${content}
</svg>`
  }

}

const baseDir = './'
let outDir = './out'

const GLOB_CONFIG = {
  ns: 'android'
}
const main = () => {
  if (checkArgs()) {
    return
  }

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  readdir(baseDir, (err, f) => {
    if (err) throw err;
    // console.log('f', f);
    f.sort().forEach((fileItem, finex) => {
      if (fileItem?.endsWith('.xml')) {

        const name = fileItem.replace(/^\$|\.xml$/g, '')
        // 颜色
        if (fileItem?.startsWith('$')) {
          const content = readXml(path.join(baseDir, fileItem))
          const parser = new Parser();
          parser.parseString(content, (err, result) => {
            if (err) {
              console.error(err);
              return;
            }
            const j = gradient2def(name, result)
            colorContainer.set(name, j)
          });
        } else {
          const content = readXml(path.join(baseDir, fileItem))
          const parser = new Parser();
          parser.parseString(content, (err, result) => {
            if (err) {
              console.error(err);
              return;
            }
            const text = v2svg(result)
            // console.log('ddd', name, text);
            if (text) {
              writeFile(`${outDir}/${name}.svg`, text, 'utf8', () => { });
            }

          });
        }



      }

    })

    // console.log('===> ', colorContainer.entries());


  })

}
main()