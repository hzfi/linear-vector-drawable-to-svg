#!/usr/bin/env node
// const { transform } = require('..');

import { readdir, existsSync, mkdirSync, readFileSync, writeFile, readdirSync } from 'fs';
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

const readXml = async (file) => {
  try {
    const content = readFileSync(file, 'utf-8')
    const parser = new Parser();
    const result = await parser.parseStringPromise(content)
    return result
  } catch (error) {
    const content = readFileSync(file, 'utf-8')
    console.error('-readXml error content: ', content);
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
  if (/^#[0-9a-fA-F]{8}$/g.test(str)) {
    const [alpha, r, g, b] = chunkArray(str.replace('#', ''), 2);
    const alphaVal = parseInt(alpha, 16) / 255
    return {
      c: '#' + [r, g, b].join(''),
      alpha: alphaVal
    }
  } else if (/^#[0-9a-fA-F]{6}$/g.test(str)) {
    const [r, g, b] = chunkArray(str.replace('#', ''), 2);
    return {
      c: '#' + [r, g, b].join(''),
    }
  } else {
    return {}
  }
}

const outputColor = (color) => {

  let currentColor = color;
  // 将颜色引用转为绝对颜色
  if (currentColor?.startsWith('@color/')) {
    const key = currentColor?.split('/').at(-1)
    const val = GLOB_CONFIG.colors.get(key);
    if (val) {
      currentColor = val
    }
  } else if (currentColor?.startsWith('?')) {
    const key = currentColor?.replace('?', '')
    const val = GLOB_CONFIG.styles.get(key);
    if (val) {
      currentColor = val
    }
  } else if (currentColor?.startsWith('@android:color/')) {
    const key = currentColor?.split('/').at(-1)
    const val = ANDROID_COLOR_CONST[key];
    if (val) {
      currentColor = val
    }
  }

  if (currentColor?.startsWith('@drawable/')) {
    // @drawable/ 视为渐变引用
    const { key, colorDef } = hasColor(currentColor)
    if (colorDef) {
      return {
        color: `url(#${key})`,
        colorDef,
        isRef: true
      }
    } else {
      return {
        color: currentColor,
        isRef: false
      }
    }
  } else if (currentColor) {
    const { c, alpha } = color2c(currentColor)
    return {
      color: c,
      alpha,
      isRef: false
    }
  }

}


const attr2Str = (attr) => Object.entries(attr).map(([k, v]) => `${k}="${v}"`).join(' ')
const gradient2def = (name, json) => {
  const gradient = json.gradient
  if (gradient) {
    const { $: meta, item } = gradient;
    let result = ''

    const stopArr = item.map(obj => {
      const { $: x } = obj;
      const offset = x[GLOB_CONFIG.ns + ':offset']
      const { c: color, alpha } = color2c(x[GLOB_CONFIG.ns + ':color'])
      if (!color) return ''
      const attr = {
        'stop-color': color
      }
      if (alpha !== undefined) {
        attr['stop-opacity'] = alpha
      }
      if (offset) {
        attr['offset'] = Number(offset)
      }
      return `${tab(3)}<stop ${attr2Str(attr)} />`
    })

    if (meta[GLOB_CONFIG.ns + ':type'] === 'linear') {
      const x1 = Number(meta[GLOB_CONFIG.ns + ':startX'])
      const x2 = Number(meta[GLOB_CONFIG.ns + ':endX'])
      const y1 = Number(meta[GLOB_CONFIG.ns + ':startY'])
      const y2 = Number(meta[GLOB_CONFIG.ns + ':endY'])
      result = `${tab(2)}<linearGradient gradientUnits="userSpaceOnUse" id="${name}" x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}" >
${stopArr.join('\n')}
${tab(2)}</linearGradient>`

    } else if (meta[GLOB_CONFIG.ns + ':type'] === 'radial') {
      const cx = Number(meta[GLOB_CONFIG.ns + ':centerX'])
      const cy = Number(meta[GLOB_CONFIG.ns + ':centerY'])
      const r = Number(meta[GLOB_CONFIG.ns + ':gradientRadius'])
      result = `${tab(2)}<radialGradient gradientUnits="userSpaceOnUse" id="${name}" cx="${cx}" cy="${cy}" r="${r}" >
${stopArr.join('\n')}
${tab(2)}</radialGradient>`

    }
    return {
      type: meta[GLOB_CONFIG.ns + ':type'],
      result
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
  const key = [...countMap].sort((a, b) => -a[1] + b[1])[0][0]
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
        if (x[GLOB_CONFIG.ns + ':height']) {
          attr.height = Number(x[GLOB_CONFIG.ns + ':height'])
        }



        const strokeColor = x[GLOB_CONFIG.ns + ':strokeColor']
        if (strokeColor) {
          const { isRef, colorDef, color, alpha } = outputColor(strokeColor)
          attr.stroke = color
          attr.fill = "none"
          if (isRef) {
            def += '\n' + colorDef
          } else if (alpha !== undefined) {
            attr['stroke-opacity'] = alpha
          }
        }


        const fillColor = x[GLOB_CONFIG.ns + ':fillColor']

        if (fillColor) {
          const { isRef, colorDef, color, alpha } = outputColor(fillColor)
          attr.fill = color
          if (isRef) {
            def += '\n' + colorDef
          } else if (alpha !== undefined) {
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

        content += `\n${tab(1 + lev * 1)}<path ${attr2Str(attr)} />`
      })
      if (group) {
        group?.forEach((x, i) => {
          const attr = {};
          if (x['clip-path']) {
            x['clip-path']?.forEach((y, j) => {
              if (!j) {
                def += `\n${tab(2)}<clipPath id="_clippath_${lev}_${i}_${j}">
${tab(3)}<path d="${y['$'][GLOB_CONFIG.ns + ':pathData']}"/>
${tab(2)}</clipPath>`
              } else {
                def += `\n${tab(2)}<clipPath id="_clippath_${lev}_${i}_${j}">
${tab(3)}<g clip-path="url(#_clippath_${lev}_${i}_${j - 1})">
${tab(4)}<path d="${y['$'][GLOB_CONFIG.ns + ':pathData']}"/>
${tab(3)}</g>
${tab(2)}</clipPath>`
              }
              attr['clip-path'] = `url(#_clippath_${lev}_${i}_${j})`
            })
          }
          if (x.$) {
            const getVal = (key, isNum = true) => {
              const r = x.$[GLOB_CONFIG.ns + ':' + key]
              if (isNum) {
                return Number(r)
              } else {
                return r
              }
            }
            const name = getVal('name', false)
            const rotation = getVal('rotation')
            const pivotX = getVal('pivotX')
            const pivotY = getVal('pivotY')
            const scaleX = getVal('scaleX')
            const scaleY = getVal('scaleY')
            const translateX = getVal('translateX')
            const translateY = getVal('translateY')
            const tf = []
            if (translateX || translateY) {
              tf.push(`translate(${translateX || 0} ${translateY || 0})`)
            }
            if (scaleX || scaleY) {
              tf.push(`scale(${scaleX || 1} ${scaleY || 1})`)
            }
            if (rotation && (pivotX || pivotY)) {
              tf.push(`rotate(${rotation},${pivotX || 0},${pivotY || 0})`)
            }
            if (name) {
              attr.name = name;
            }
            if (tf?.length) {
              attr.transform = tf.join('\n');
            }
            // transform="rotate(-10 50 100)
            //            translate(-36 45.5)
            //            skewX(40)
            //            scale(1 0.5)">
          }
          const g = v2str(x, lev + 1)
          def += g.def
          content += `\n${tab(1 + lev * 1)}<g ${attr2Str(attr)}>${g.content}
${tab(1 + lev * 1)}</g>`
        })
      }
      return {
        def,
        content
      }
    }

    const { def, content } = v2str(vector)

    const defs = def ? `\n${tab(1)}<defs>${def}
${tab(1)}</defs>` : ''
    const w = Number(meta[GLOB_CONFIG.ns + ':viewportWidth'])
    const h = Number(meta[GLOB_CONFIG.ns + ':viewportHeight'])
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${defs}${content}
</svg>`
  }

}

const baseDir = './'
let outDir = './out'

// https://developer.android.com/reference/android/graphics/Color#constants_1
// https://developer.android.com/reference/kotlin/android/R.color#constants
const ANDROID_COLOR_CONST = {
  black: '#ff000000',
  blue: '#ff0000ff',
  cyan: '#ff00ffff',
  dkgray: '#ff444444',
  gray: '#ff888888',
  green: '#ff00ff00',
  ltgray: '#ffcccccc',
  magenta: '#ffff00ff',
  red: '#ffff0000',
  transparent: '#00000000',
  white: '#ffffffff',
  yellow: '#ffffff00',
  background_dark: '#ff000000',
  background_light: '#ffffffff',
  darker_gray: '#ffaaaaaa',
  holo_blue_bright: '#ff00ddff',
  holo_blue_dark: '#ff0099cc',
  holo_blue_light: '#ff33b5e5',
  holo_green_dark: '#ff669900',
  holo_green_light: '#ff99cc00',
  holo_orange_dark: '#ffff8800',
  holo_orange_light: '#ffffbb33',
  holo_purple: '#ffaa66cc',
  holo_red_dark: '#ffcc0000',
  holo_red_light: '#ffff4444',
  tab_indicator_text: '#ff808080',
  widget_edittext_dark: '#ff000000',
}

const GLOB_CONFIG = {
  ns: 'android',
  colors: new Map(),
  styles: new Map(),
  ANDROID_COLOR_CONST,
  tab: '  ',
}

const tab = (n) => GLOB_CONFIG.tab.repeat(n)

const transformColorFromVar = (val) => {
  if (val?.startsWith('@color/')) {
    const v = GLOB_CONFIG.colors.get(val?.replace('@color/', ''))
    return v
  } else if (val?.startsWith('@android:color/')) {
    const v = ANDROID_COLOR_CONST[val?.replace('@android:color/', '')]
    return v
  }
}

const try2collectValuesColor = async () => {
  try {
    const atPath = (dir) => path.join(baseDir, '../', dir)

    const dirList = readdirSync(atPath('values'))
    // console.log('dir ', dirList);
    if (dirList.includes('colors.xml')) {
      const { resources } = await readXml(atPath('values/colors.xml'))
      if (resources.color) {
        GLOB_CONFIG.colors = new Map()
        const varColor = resources.color.filter(x => x?._?.startsWith('@'));
        const constColor = resources.color.filter(x => x?._ && !x._?.startsWith('@'));
        constColor.forEach(x => {
          GLOB_CONFIG.colors.set(x?.$?.name, x._)
        })
        varColor.forEach(x => {
          const val = transformColorFromVar(x._)
          if (val) {
            GLOB_CONFIG.colors.set(x?.$?.name, val)
          }
        })
        console.log(`Collecting colors from \`values/colors.xml\`: ${GLOB_CONFIG.colors.size} \t\t Done;`);

      }


    }
    if (dirList.includes('styles.xml')) {

      const { resources } = await readXml(atPath('values/styles.xml'))
      const list = (resources.style?.flatMap(x => x.item) || []).filter(Boolean)
      list.forEach(x => {
        const key = x?.$?.name;
        const val = x?._
        if (!GLOB_CONFIG.styles.get(key)) {
          if (/^#[0-9a-fA-F]{8}$/g.test(val)) {
            GLOB_CONFIG.styles.set(key, val)
          } else {
            const val2 = transformColorFromVar(x._)
            if (val2) {
              GLOB_CONFIG.styles.set(key, val2)
            }
          }
        }
      })
      console.log(`Collecting colors from \`values/styles.xml\`: ${GLOB_CONFIG.styles.size} \t\t Done;`);
    }
    // if (dirList.drawables) {

    // }
    // if (dirList.integers) {

    // }

  } catch (error) {

  }

}

const main = () => {
  if (checkArgs()) {
    return
  }

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  try2collectValuesColor()

  readdir(baseDir, async (err, f) => {
    if (err) throw err;
    // console.log('f', f);
    const currentListObj = f.reduce(async (p, fileItem) => {
      const fileType = fileItem.split('.').at(-1);
      const prev = await p;      
      if (fileType !== 'xml') {
        const count = prev.fileType[fileType] || 0
        prev.fileType[fileType] = count + 1
      } else {
        const name = fileItem.replace(/^\$|\.xml$/g, '')
        const result = await readXml(path.join(baseDir, fileItem));
        if (!result) return prev
        const xmlType = Object.keys(result)[0];
        
        if ('gradient' === xmlType) {
          const { type, result: gradientResult } = gradient2def(name, result) || {}
          if (gradientResult) {
            colorContainer.set(name, gradientResult)
          }
          if (type) {
            const count = prev.gradient[type] || 0
            prev.gradient[type] = count + 1
          }
        } else if ('vector' === xmlType) {
          prev.vector.push({
            type: xmlType,
            name,
            result
          })
        } else {
          // count
          const count = prev.xmlType[xmlType] || 0
          prev.xmlType[xmlType] = count + 1
        }

      }
      return prev;

    }, { fileType: {}, xmlType: {}, vector: [], gradient: {} })
    // 其他文件，只做统计
    const all = await currentListObj;

    if (all?.vector) {
      console.log('Result ===> ',);
      all.vector.forEach(x => {
        const { name, result } = x;
        const text = v2svg(result)
        // console.log('ddd', name, text);
        if (text) {
          writeFile(`${outDir}/${name}.svg`, text, 'utf8', () => { });
        }
      })
      console.log(`.XML Has been processed:`);
      console.table([
        {
          type: 'VECTOR',
          count: all?.vector?.length
        }
        , ... (Object.entries(all?.gradient).map(([type, count]) => ({ type: type.toUpperCase() + ' GRADIENT', count })))
      ]);

    }
    if (all?.fileType) {
      console.log(`Other FileType are Skipped:`, all?.fileType);
      // console.table(Object.entries(all?.fileType).map(([type, count]) => ({ type, count })));
    }
    if (all?.xmlType) {
      console.log(`Other Tag are Skipped:`, all?.xmlType);
      // console.table(Object.entries(all?.xmlType).map(([xmlTag, count]) => ({ xmlTag, count })));
    }

  })

}
main()