// Historia de aviso de un carrusel nuevo (PNG 1080x1920) con su portada.
// Uso: node render-teaser.mjs <portada.jpg> "<título>" <salida.png>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const cover = fs.readFileSync(path.resolve(process.argv[2])).toString('base64');
const label = process.argv[3] || '';
const outFile = path.resolve(process.argv[4] || 'teaser.png');
const INK = '#0F1B33', GREEN = '#35D07F', MUTED = '#9FB0CC', CARD = '#16264A';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const base = path.resolve('node_modules/@fontsource');
const faces = [];
for (const [pkg, fam, ws] of [['big-shoulders-display', 'Big Shoulders Display', [800, 900]], ['hanken-grotesk', 'Hanken Grotesk', [500, 700]]])
  for (const w of ws) { const f = path.join(base, pkg, 'files', `${pkg}-latin-${w}-normal.woff2`); if (fs.existsSync(f)) faces.push(`@font-face{font-family:'${fam}';font-weight:${w};src:url('data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}') format('woff2');}`); }
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${faces.join('\n')}
*{box-sizing:border-box}body{margin:0}
.root{width:1080px;height:1920px;background:${INK};color:#fff;font-family:'Hanken Grotesk','Helvetica Neue',Arial,sans-serif;padding:260px 80px 360px;display:flex;flex-direction:column;align-items:center;gap:30px;overflow:hidden}
.d{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-weight:900}
</style></head><body><div class="root">
<div style="align-self:flex-start;font-size:36px;font-weight:700;color:${MUTED}">@tuamigodelasfinanzas${label ? ' · ' + esc(label) : ''}</div>
<div class="d" style="align-self:flex-start;font-size:150px;line-height:1">Nuevo <span style="color:${GREEN}">carrusel</span></div>
<img src="data:image/jpeg;base64,${cover}" style="width:640px;height:800px;object-fit:cover;border-radius:28px;box-shadow:0 0 0 4px ${CARD}">
<div style="background:${CARD};border-radius:28px;padding:30px 40px;font-size:44px;font-weight:700;line-height:1.25;text-align:center;width:100%">Ya está en el perfil 👆<div style="font-size:34px;font-weight:500;color:${MUTED};margin-top:8px">Desliza y guárdalo para tenerlo a mano.</div></div>
</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts && document.fonts.ready);
const over = await page.evaluate(() => document.querySelector('.root').scrollHeight > 1920 + 1);
if (over) console.warn('AVISO: el contenido de la historia no cabe');
await page.screenshot({ path: outFile, type: 'png' });
await browser.close();
console.log('Historia de aviso generada');
