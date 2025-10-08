#!/usr/bin/env node
// const { transform } = require('..');

import { readdir, readFile, readFileSync, writeFile } from 'fs';
import path from 'path';
import { Parser } from 'xml2js';


const inputFile = process.argv[2];
const outputFile = process.argv[3];

// if (!inputFile) {
//   throw new Error('inputFile is invalid');
// }

// if (!outputFile) {
//   throw new Error('outputFile is invalid');
// }



console.log('hello')
const [text] = process.argv.slice(2);

const colorContainer = new Map()

const readXml = (file) => {

  try {
    const c = readFileSync(file, 'utf-8',)
    return c
  } catch (error) {
    console.log('-readXml', error);


  }
}

const color2c = str => str?.replace(/^\#([a-fA-F0-9]{2})([a-fA-F0-9]{6})/g, (a, b, c) => `#${c}${b}`)
const gradient2def = (name, json) => {
  const gradient = json.gradient
  if (gradient) {
    const { $: meta, item } = gradient;
    if (meta['android:type'] === 'linear') {
      const stopArr = item.map(obj => {
        const { $: x } = obj;
        const offset = x['android:offset']
        const color = color2c(x['android:color'])
        return `<stop stop-color="${color}"  offset="${offset}"/>`
      })
      return `<linearGradient id="${name}" x1="${meta['android:startX']}" x2="${meta['android:endX']}" y1="${meta['android:startY']}" y2="${meta['android:endY']}" >
${stopArr.join('\n')}
</linearGradient>`

    }
  }
}

const v2svg = (json) => {
  const vector = json.vector
  if (vector) {
    console.log('vector', vector);

    const { $: meta } = vector;


    const v2str = (v) => {
      const { path, group } = v;
      let def = ''
      let content = ''
      path?.forEach(obj => {
        const { $: x } = obj;
        let color = ''
        if (x['android:fillColor']?.startsWith('@')) {
          const key = x['android:fillColor']?.split('/').at(-1).replace('$', '')
          def = colorContainer.get(key) || ''
          color = `url(#${key})`
        } else {
          color = color2c(x['android:fillColor'])
        }
        content += `\n<path d="${x['android:pathData']}" fill="${color}"/>`
      })
      if (group) {
        group?.forEach(x => {
          let attr = '';
          if (x['clip-path']) {
            x['clip-path']?.forEach((y, i) => {
              def += `\n<clipPath id="_clippath_${i}">
<path d="${y['$']['android:pathData']}"/>
</clipPath>`
            })
            attr += `clip-path="url(#_clippath_0)"`
          }
          const g = v2str(x)
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
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 ${meta['android:viewportWidth']} ${meta['android:viewportHeight']}" xmlns="http://www.w3.org/2000/svg">
${defs}${content}
</svg>`
  }

}

const baseDir = './'
const outDir = './out'
readdir(baseDir, (err, f) => {
  if (err) throw err;
  console.log('f', f);
  f.forEach((fileItem, finex) => {
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
          console.log('ddd', name, text);
          if (text) {
            writeFile(`${outDir}/${name}.svg`, text, 'utf8', () => { });
          }

        });
      }



    }

  })

  // console.log('===> ', colorContainer.entries());


})

