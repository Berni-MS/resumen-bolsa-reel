// Historias de datos (PNG 1080x1920): luz de mañana y «Tu dinero hoy».
// Uso: node render-datos.mjs <datos.json> <salida.png>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { nf, pct } from './lib-datos.mjs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const item = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outFile = path.resolve(process.argv[3] || 'story.png');
const INK = '#0F1B33', GREEN = '#35D07F', RED = '#FF5247', MUTED = '#9FB0CC', CARD = '#16264A', SOFT = '#DCE5F5';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const S = n => `calc(${n}px*var(--s))`;
const base = path.resolve('node_modules/@fontsource');
const faces = [];
for (const [pkg, fam, ws] of [['big-shoulders-display', 'Big Shoulders Display', [800, 900]], ['hanken-grotesk', 'Hanken Grotesk', [500, 700]]])
  for (const w of ws) { const f = path.join(base, pkg, 'files', `${pkg}-latin-${w}-normal.woff2`); if (fs.existsSync(f)) faces.push(`@font-face{font-family:'${fam}';font-weight:${w};src:url('data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}') format('woff2');}`); }

let header, body, footer;
if (item.kind === 'luz') {
  const mx = Math.max(...item.bars.map(b => b.p));
  const col = c => (c === 'low' ? GREEN : c === 'high' ? RED : MUTED);
  const bars = item.bars.map(b => `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%"><div style="width:100%;height:${Math.max(4, (b.p / mx) * 100)}%;background:${col(b.c)};border-radius:6px 6px 0 0"></div></div>`).join('');
  const ticks = item.bars.map((b, i) => `<div style="flex:1;text-align:center;font-size:${S(26)};font-weight:700;color:${MUTED}">${['00', '06', '12', '18'].includes(b.h) ? Number(b.h) : ''}</div>`).join('');
  header = 'Luz de mañana';
  body = `<div class="d" style="font-size:${S(190)};line-height:1">La luz <span style="color:${GREEN}">mañana</span></div>
<div style="font-size:${S(46)};font-weight:700;color:${MUTED}">${esc(item.label)} · precio por hora</div>
<div style="background:${CARD};border-radius:28px;padding:${S(30)} ${S(30)} ${S(18)}"><div style="display:flex;align-items:flex-end;gap:${S(6)};height:${S(380)}">${bars}</div><div style="display:flex;gap:${S(6)};margin-top:${S(8)}">${ticks}</div><div style="display:flex;gap:${S(26)};margin-top:${S(8)};font-size:${S(28)};font-weight:700;color:${MUTED}"><span style="color:${GREEN}">■ más barata</span><span style="color:${RED}">■ más cara</span></div></div>
<div style="background:${CARD};border-radius:28px;padding:${S(26)} ${S(38)}"><div style="font-size:${S(32)};font-weight:700;color:${MUTED}">Las 3 horas seguidas más baratas</div><div style="display:flex;align-items:baseline;gap:${S(24)}"><span class="d" style="font-size:${S(96)};color:${GREEN}">${item.cheap.from}–${item.cheap.to}</span><span style="font-size:${S(40)};font-weight:700">${nf(item.cheap.avg, 3)} €/kWh</span></div></div>
<div style="background:${CARD};border-radius:28px;padding:${S(26)} ${S(38)}"><div style="font-size:${S(32)};font-weight:700;color:${MUTED}">La hora más cara</div><div style="display:flex;align-items:baseline;gap:${S(24)}"><span class="d" style="font-size:${S(96)};color:${RED}">${item.max.h}</span><span style="font-size:${S(40)};font-weight:700">${nf(item.max.p, 3)} €/kWh</span></div></div>
<div style="background:${CARD};border-radius:28px;padding:${S(26)} ${S(38)};font-size:${S(40)};font-weight:700;line-height:1.25">Media del día: ${nf(item.avg, 3)} €/kWh${item.delta != null ? `<div style="font-size:${S(34)};font-weight:500;color:${MUTED}">${nf(Math.abs(item.delta), 0)} % ${item.delta <= 0 ? 'más barata' : 'más cara'} que hoy</div>` : ''}</div>`;
  footer = 'Precio PVPC (tarifa regulada) · Fuente: Red Eléctrica · No aplica si tienes precio fijo';
} else {
  header = 'Tu dinero hoy';
  const rows = item.rows.map(r => `<div style="background:${CARD};border-radius:28px;padding:${S(24)} ${S(38)};display:flex;align-items:center;justify-content:space-between;gap:${S(24)}">
<div><div style="font-size:${S(48)};font-weight:700">${esc(r.name)}</div><div style="font-size:${S(30)};color:${MUTED}">${esc(r.note)}</div></div>
<div style="text-align:right"><div class="d" style="font-size:${S(84)};line-height:1">${esc(r.value)}</div><div style="font-size:${S(30)};color:${MUTED}">${esc(r.unit)}</div></div>
<div style="width:${S(230)};white-space:nowrap;text-align:right;font-size:${S(46)};font-weight:700;color:${r.ch >= 0 ? GREEN : RED}">${r.ch >= 0 ? '▲' : '▼'} ${esc(pct(r.ch).replace(/^[+−]/, ''))}</div></div>`).join('');
  body = `<div class="d" style="font-size:${S(190)};line-height:1">Tu dinero <span style="color:${GREEN}">hoy</span></div>
<div style="font-size:${S(46)};font-weight:700;color:${MUTED}">${esc(item.label)} · datos a las ${esc(item.time)}</div>${rows}`;
  footer = 'Fuentes: BCE, Yahoo Finance, CoinGecko · Datos informativos, pueden tener retraso · No es asesoramiento';
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${faces.join('\n')}
*{box-sizing:border-box}body{margin:0}:root{--s:1}
.root{width:1080px;height:1920px;background:${INK};color:#fff;font-family:'Hanken Grotesk','Helvetica Neue',Arial,sans-serif;padding:250px 80px 330px;display:flex;flex-direction:column;gap:24px;overflow:hidden}
.d{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-weight:900}
#mid{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:${S(24)};overflow:hidden}
</style></head><body><div class="root">
<div style="font-size:36px;font-weight:700;color:${MUTED}">@tuamigodelasfinanzas · ${esc(header)}</div>
<div id="mid">${body}</div>
<div style="font-size:28px;font-weight:700;color:${MUTED}">${esc(footer)}</div>
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
if (s < 0.5) console.warn('AVISO: el contenido no cabe');
await page.screenshot({ path: outFile, type: 'png' });
await browser.close();
console.log('Historia generada, escala', s.toFixed(2));
