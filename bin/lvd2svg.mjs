#!/usr/bin/env node
// const { transform } = require('..');

import { readdir, existsSync, mkdirSync, readFileSync, writeFile } from 'fs';
import path from 'path';
import { Parser } from 'xml2js';;
import packageJson from '../package.json'  with { type: "json" };


const checkArgs = () => {
  if (process.argv.includes('-o')) {
    const outputIndex = process.argv.findIndex(x=>x==='-o' )
    const dir = process.argv[ outputIndex + 1 ]
    if ( dir ) {
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
    console.log('-readXml', error);


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
      const offset = x['android:offset']
      const { c: color, alpha } = color2c(x['android:color'])
      return `<stop stop-color="${color}"  stop-opacity="${alpha}"  offset="${Number(offset)}"/>`
    })

    if (meta['android:type'] === 'linear') {
      const x1 = Number(meta['android:startX'])
      const x2 = Number(meta['android:endX'])
      const y1 = Number(meta['android:startY'])
      const y2 = Number(meta['android:endY'])
      return `<linearGradient id="${name}" x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}" >
${stopArr.join('\n')}
</linearGradient>`

    }
    if (meta['android:type'] === 'radial') {
      const cx = Number(meta['android:centerX'])
      const cy = Number(meta['android:centerY'])
      const r = Number(meta['android:gradientRadius'])
      return `<radialGradient id="${name}" cx="${cx}" cy="${cy}" r="${r}" >
${stopArr.join('\n')}
</radialGradient>`

    }
  }
}

const v2svg = (json) => {
  const vector = json.vector
  if (vector) {
    console.log('vector', vector);

    const { $: meta } = vector;


    const v2str = (v, lev = 0) => {
      const { path, group } = v;
      let def = ''
      let content = ''
      path?.forEach((obj) => {
        const { $: x } = obj;
        const attr = {
          d: x['android:pathData']
        };

        if (x['android:name']) {
          attr.id = x['android:name']
        }
        if (x['android:width']) {
          attr.width = Number(x['android:width'])
        }
        if (x['android:width']) {
          attr.width = Number(x['android:width'])
        }

        if (x['android:strokeColor']?.startsWith('@')) {
          const key = x['android:strokeColor']?.split('/').at(-1).replace('$', '')
          def += '\n' + colorContainer.get(key) || ''
          attr.stroke = `url(#${key})`
          attr.fill = "none"
        } else if (x['android:strokeColor']) {
          const { c, alpha } = color2c(x['android:strokeColor'])
          attr.stroke = c
          attr['stroke-opacity'] = alpha
          attr.fill = "none"
        }


        if (x['android:fillColor']?.startsWith('@')) {
          const key = x['android:fillColor']?.split('/').at(-1).replace('$', '')
          def += colorContainer.get(key) || ''
          attr.fill = `url(#${key})`
        } else if (x['android:fillColor']) {
          const { c, alpha } = color2c(x['android:fillColor'])
          attr.fill = c
          attr['fill-opacity'] = alpha
        }


        if (x['android:strokeWidth']) {
          attr['stroke-width'] = x['android:strokeWidth']
        }
        if (x['android:strokeAlpha']) {
          attr['stroke-opacity'] = x['android:strokeAlpha']
        }
        if (x['android:fillAlpha']) {
          attr['fill-opacity'] = Number(x['android:fillAlpha'])
        }

        if (x['android:strokeLineCap']) {
          attr['stroke-linecap'] = x['android:strokeLineCap']
        }
        if (x['android:strokeLineJoin']) {
          attr['stroke-linejoin'] = x['android:strokeLineJoin']
        }
        if (x['android:strokeMiterLimit']) {
          attr['stroke-miterlimit'] = Number(x['android:strokeMiterLimit'])
        }


        if (x['android:fillType']) {
          attr['fill-rule'] = x['android:fillType']?.toLowerCase()
        }

        const attrStr = Object.entries(attr).map(([k, v]) => `${k}="${v}"`).join(' ')
        content += `\n<path ${attrStr}/>`
      })
      if (group) {
        group?.forEach((x, i) => {
          let attr = '';
          if (x['clip-path']) {
            x['clip-path']?.forEach((y, j) => {
              def += `\n<clipPath id="_clippath_${lev}_${i}_${j}">
<path d="${y['$']['android:pathData']}"/>
</clipPath>`
              attr += `clip-path="url(#_clippath_${lev}_${i}_${j})"`
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
    const w = Number(meta['android:viewportWidth'])
    const h = Number(meta['android:viewportHeight'])
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
${defs}${content}
</svg>`
  }

}

const baseDir = './'
let outDir = './out'

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