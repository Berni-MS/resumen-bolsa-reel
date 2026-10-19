// Historia «Hoy en los mercados» (PNG 1080x1920) a partir del JSON de build-calendar.mjs --day
// Uso: node render-story.mjs <day.json> <salida.png>
import fs from 'node:fs';
import { storySeconds } from './story-dur.mjs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const item = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outFile = path.resolve(process.argv[3] || 'story.png');
const INK = '#0F1B33', GREEN = '#35D07F', RED = '#FF5247', MUTED = '#9FB0CC', CARD = '#16264A', SOFT = '#DCE5F5';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const base = path.resolve('node_modules/@fontsource');
const faces = [];
for (const [pkg, fam, ws] of [['big-shoulders-display', 'Big Shoulders Display', [800, 900]], ['hanken-grotesk', 'Hanken Grotesk', [500, 700]]])
  for (const w of ws) { const f = path.join(base, pkg, 'files', `${pkg}-latin-${w}-normal.woff2`); if (fs.existsSync(f)) faces.push(`@font-face{font-family:'${fam}';font-weight:${w};src:url('data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}') format('woff2');}`); }
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${faces.join('\n')}
*{box-sizing:border-box}body{margin:0}:root{--s:1}
.root{width:1080px;height:1920px;background:${INK};color:#fff;font-family:'Hanken Grotesk','Helvetica Neue',Arial,sans-serif;padding:260px 80px 360px;display:flex;flex-direction:column;gap:28px;overflow:hidden}
.d{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-weight:900}
#mid{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:calc(26px*var(--s));overflow:hidden}
</style></head><body><div class="root">
<div style="font-size:36px;font-weight:700;color:${MUTED}">@tuamigodelasfinanzas · ${esc(item.pregunta ? 'Pregunta de la semana' : item.label)}</div>
<div id="mid">
${item.pregunta ? `<div class="d" style="font-size:calc(200px*var(--s));line-height:1.08">${esc(item.pregunta)}</div>
<div style="background:${CARD};border-radius:28px;padding:calc(34px*var(--s)) calc(40px*var(--s));font-size:calc(46px*var(--s));font-weight:700;line-height:1.25">Respóndeme por mensaje directo 💬<div style="font-size:calc(36px*var(--s));font-weight:500;color:${MUTED};margin-top:10px">Elegiré tus dudas para los próximos contenidos.</div></div>` : `<div class="d" style="font-size:calc(190px*var(--s));line-height:1.08">Hoy en los <span style="color:${GREEN}">mercados</span></div>
${item.quiet ? `<div style="font-size:calc(42px*var(--s));font-weight:700;color:${MUTED};line-height:1.25">Hoy no hay citas importantes en el calendario. Lo próximo:</div>` : ''}
${item.rows.map(r => `<div style="background:${CARD};border-radius:28px;padding:calc(34px*var(--s)) calc(40px*var(--s))">
  <div style="display:flex;align-items:baseline;gap:24px"><span class="d" style="font-size:calc(76px*var(--s));color:${r.k >= 3 ? RED : GREEN}">${esc(r.t || 'Hoy')}</span><span style="font-size:calc(44px*var(--s));font-weight:700;line-height:1.15">${esc(r.n)}</span></div>
  ${r.b ? `<div style="font-size:calc(34px*var(--s));line-height:1.3;color:${MUTED};margin-top:10px">${esc(r.b)}</div>` : ''}</div>`).join('')}`}
</div>
<div style="font-size:32px;font-weight:700;color:${MUTED}">${item.pregunta ? 'Contenido informativo, no es asesoramiento financiero' : 'Hora de Madrid · Contenido informativo, no es asesoramiento financiero'}</div>
</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts && document.fonts.ready);
let s = 1;
for (; s >= 0.5; s -= 0.05) {
  await page.evaluate(v => document.documentElement.style.setProperty('--s', v), s.toFixed(2));
  if (!(await page.evaluate(() => { const m = document.getElementById('mid'); return m.scrollHeight > m.clientHeight + 1; }))) break;
}
await page.screenshot({ path: outFile, type: 'png' });
const { words, seconds } = storySeconds(await page.evaluate(() => document.querySelector('.root').innerText));
fs.writeFileSync(outFile.replace(/\.png$/, '.dur'), String(seconds));
console.log(`Texto: ${words} palabras → duración recomendada ${seconds} s`);
await browser.close();
console.log('Historia generada, escala', s.toFixed(2));
