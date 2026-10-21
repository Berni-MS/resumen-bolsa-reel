// Genera la tarjeta final (1080x1920 PNG). Uso: node tools/endcard.mjs <salida.png>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { endcardInner } from '../endcard-lib.mjs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const out = path.resolve(process.argv[2] || 'endcard.png');
const base = path.resolve('node_modules/@fontsource'); const faces = [];
for (const [pkg, fam, ws] of [['big-shoulders-display', 'Big Shoulders Display', [900]], ['hanken-grotesk', 'Hanken Grotesk', [500, 700]]])
  for (const w of ws) { const f = path.join(base, pkg, 'files', `${pkg}-latin-${w}-normal.woff2`); if (fs.existsSync(f)) faces.push(`@font-face{font-family:'${fam}';font-weight:${w};src:url('data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}') format('woff2')}`); }
const html = `<!doctype html><meta charset="utf-8"><style>${faces.join('\n')}*{box-sizing:border-box}body{margin:0}.root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#0F1B33;color:#fff;font-family:'Hanken Grotesk','Helvetica Neue',Arial,sans-serif}</style><div class="root">${endcardInner()}</div>`;
const tmp = out + '.html'; fs.writeFileSync(tmp, html);
const b = await chromium.launch({ args: ['--no-sandbox'] });
const pg = await (await b.newContext({ viewport: { width: 1080, height: 1920 } })).newPage();
await pg.goto(pathToFileURL(tmp).href); await pg.evaluate(() => document.fonts.ready);
await pg.screenshot({ path: out }); await b.close(); fs.unlinkSync(tmp);
console.log('ok', out);
