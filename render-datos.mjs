// Historias de datos (PNG 1080x1920): luz de mañana y «Los mercados hoy».
// Uso: node render-datos.mjs <datos.json> <salida.png>
import fs from 'node:fs';
import { storySeconds } from './story-dur.mjs';
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
} else if (item.kind === 'carburantes') {
  header = 'Carburantes';
  const chip = ch => ch == null ? '' : `<span style="font-size:${S(36)};font-weight:700;color:${ch <= 0 ? GREEN : RED}">${ch <= 0 ? '▼' : '▲'} ${esc(nf(Math.abs(ch), 1))} % ${item.daysAgo === 7 ? 'en la semana' : `en ${item.daysAgo} días`}</span>`;
  const fuel = (name, f) => `<div style="flex:1;background:${CARD};border-radius:28px;padding:${S(26)} ${S(32)}"><div style="font-size:${S(36)};font-weight:700;color:${MUTED}">${name}</div><div class="d" style="font-size:${S(120)};line-height:1.05">${esc(nf(f.avg, 3))}</div><div style="font-size:${S(30)};color:${MUTED}">€ por litro</div>${chip(f.ch)}<div style="margin-top:${S(10)};font-size:${S(34)};font-weight:700">Depósito de 50 L: ${esc(nf(f.tank, 0))} €</div></div>`;
  const list = (title, arr, c) => `<div style="background:${CARD};border-radius:28px;padding:${S(24)} ${S(38)}"><div style="font-size:${S(32)};font-weight:700;color:${MUTED};margin-bottom:${S(6)}">${title}</div>${arr.map(r => `<div style="display:flex;justify-content:space-between;font-size:${S(44)};font-weight:700;line-height:1.35"><span>${esc(r.name)}</span><span style="color:${c}">${esc(nf(r.g, 3))} €/l</span></div>`).join('')}</div>`;
  body = `<div class="d" style="font-size:${S(170)};line-height:1">Gasolina y <span style="color:${GREEN}">diésel</span></div>
<div style="font-size:${S(44)};font-weight:700;color:${MUTED}">Precio medio en España · ${esc(item.label)}</div>
<div style="display:flex;gap:${S(24)}">${fuel('Gasolina 95', item.g)}${fuel('Diésel', item.d)}</div>
${list('Gasolina 95 · provincias más baratas', item.cheap, GREEN)}${list('Gasolina 95 · provincias más caras', item.dear, RED)}
<div style="background:${CARD};border-radius:28px;padding:${S(24)} ${S(38)};font-size:${S(38)};font-weight:700;line-height:1.3">Llenar 50 L en ${esc(item.cheap[0].name)} en vez de en ${esc(item.dear[0].name)} son <span style="color:${GREEN}">${esc(nf(item.saving, 0))} € menos</span></div>`;
  footer = 'Media de estaciones de la Península y Baleares · Fuente: Ministerio para la Transición Ecológica';
} else if (item.kind === 'euribor') {
  header = 'Euríbor';
  const dpp = (a, b) => a - b;
  const chip = (label, other) => other == null ? '' : `<div style="font-size:${S(38)};font-weight:700;color:${dpp(item.value, other) <= 0 ? GREEN : RED}">${dpp(item.value, other) <= 0 ? '▼' : '▲'} ${esc(nf(Math.abs(dpp(item.value, other)), 2))} puntos <span style="color:${MUTED};font-weight:500">${label} (${esc(nf(other, 3))} %)</span></div>`;
  const m = item.mortgage;
  body = `<div class="d" style="font-size:${S(190)};line-height:1">El <span style="color:${GREEN}">Euríbor</span></div>
<div style="font-size:${S(46)};font-weight:700;color:${MUTED}">Media de ${esc(item.label)} · a 12 meses</div>
<div style="background:${CARD};border-radius:28px;padding:${S(30)} ${S(38)}"><div class="d" style="font-size:${S(250)};line-height:1">${esc(nf(item.value, 3))} %</div>${chip('frente al mes anterior', item.prev)}${chip('frente a hace un año', item.yago)}</div>
${m.before != null ? `<div style="background:${CARD};border-radius:28px;padding:${S(30)} ${S(38)}"><div style="font-size:${S(32)};font-weight:700;color:${MUTED}">Ejemplo: hipoteca variable de ${esc(nf(m.capital, 0))} € a ${m.years} años (Euríbor + ${m.spread} %)</div><div style="display:flex;align-items:baseline;gap:${S(24)}"><span class="d" style="font-size:${S(120)};color:${m.diff <= 0 ? GREEN : RED}">${m.diff <= 0 ? '−' : '+'}${esc(nf(Math.abs(m.diff), 0))} €</span><span style="font-size:${S(40)};font-weight:700">al mes que hace un año</span></div><div style="font-size:${S(34)};color:${MUTED}">Cuota de ${esc(nf(m.now, 0))} € hoy · ${esc(nf(m.before, 0))} € entonces</div></div>` : `<div style="background:${CARD};border-radius:28px;padding:${S(30)} ${S(38)};font-size:${S(40)};font-weight:700">Cuota de ejemplo (${esc(nf(m.capital, 0))} € a ${m.years} años, Euríbor + ${m.spread} %): ${esc(nf(m.now, 0))} € al mes</div>`}`;
  footer = 'Euríbor a 12 meses, media mensual · Fuente: BCE · Ejemplo orientativo; tu banco revisa en su fecha · No es asesoramiento';
} else if (item.kind === 'ipc') {
  header = 'Inflación';
  const hundred = 100 * (1 + item.annual / 100);
  const arrow = (v, p) => p == null ? '' : `<div style="font-size:${S(38)};font-weight:700;color:${v <= p ? GREEN : RED}">${v <= p ? '▼' : '▲'} <span style="color:${MUTED};font-weight:500">${v <= p ? 'baja' : 'sube'} desde ${esc(nf(p, 1))} %${item.prevMonth ? ' en ' + esc(item.prevMonth) : ''}</span></div>`;
  const rows = item.groups.map(g => `<div style="display:flex;align-items:center;justify-content:space-between;background:${CARD};border-radius:28px;padding:${S(20)} ${S(38)}"><span style="font-size:${S(44)};font-weight:700">${esc(g.name)}</span><span style="font-size:${S(52)};font-weight:700;color:${g.v >= item.annual ? RED : GREEN}">${g.v >= 0 ? '' : '−'}${esc(nf(Math.abs(g.v), 1))} %</span></div>`).join('');
  body = `<div class="d" style="font-size:${S(190)};line-height:1">La <span style="color:${GREEN}">inflación</span></div>
<div style="font-size:${S(46)};font-weight:700;color:${MUTED}">IPC de ${esc(item.month)} · variación en 12 meses</div>
<div style="background:${CARD};border-radius:28px;padding:${S(30)} ${S(38)}"><div class="d" style="font-size:${S(250)};line-height:1">${esc(nf(item.annual, 1))} %</div>${arrow(item.annual, item.annualPrev)}<div style="font-size:${S(36)};color:${MUTED}">${item.monthly >= 0 ? '+' : '−'}${esc(nf(Math.abs(item.monthly), 1))} % respecto al mes anterior</div></div>
<div style="background:${CARD};border-radius:28px;padding:${S(26)} ${S(38)};font-size:${S(42)};font-weight:700;line-height:1.3">Lo que hace un año costaba 100 €, hoy cuesta <span style="color:${item.annual > 0 ? RED : GREEN}">${esc(nf(hundred, 2))} €</span></div>
<div style="font-size:${S(34)};font-weight:700;color:${MUTED}">Cuánto ha subido cada cosa en un año</div>${rows}`;
  footer = 'Tasa anual del IPC, base 2025 · Fuente: INE · En rojo, lo que sube más que la media';
} else if (item.kind === 'calc') {
  header = 'Calculadora de la semana';
  const rows = item.rows.map(r => `<div style="background:${CARD};border-radius:28px;padding:${S(24)} ${S(38)}"><div style="font-size:${S(36)};font-weight:700;color:${MUTED}">${esc(r.a)}</div><div class="d" style="font-size:${S(100)};line-height:1.05;color:${item.bad ? RED : GREEN}">${esc(r.b)}</div><div style="font-size:${S(32)};color:${SOFT}">${esc(r.c)}</div></div>`).join('');
  body = `<div class="d" style="font-size:${S(170)};line-height:1">${esc(item.title)} <span style="color:${GREEN}">${esc(item.accent)}</span></div>
<div style="font-size:${S(44)};font-weight:700;color:${MUTED};line-height:1.25">${esc(item.q)}</div>${rows}
<div style="font-size:${S(32)};color:${MUTED}">${esc(item.note)}</div>
<div style="background:${CARD};border-radius:28px;padding:${S(26)} ${S(38)};font-size:${S(40)};font-weight:700;line-height:1.3">Cuéntame tu caso por mensaje 💬<div style="font-size:${S(32)};font-weight:500;color:${MUTED};margin-top:${S(6)}">Y guárdala para cuando la necesites.</div></div>`;
  footer = item.footer;
} else {
  header = 'Los mercados hoy';
  const rows = item.rows.map(r => `<div style="background:${CARD};border-radius:28px;padding:${S(24)} ${S(38)};display:flex;align-items:center;justify-content:space-between;gap:${S(24)}">
<div><div style="font-size:${S(48)};font-weight:700">${esc(r.name)}</div><div style="font-size:${S(30)};color:${MUTED}">${esc(r.note)}</div></div>
<div style="text-align:right"><div class="d" style="font-size:${S(84)};line-height:1">${esc(r.value)}</div><div style="font-size:${S(30)};color:${MUTED}">${esc(r.unit)}</div></div>
<div style="width:${S(230)};white-space:nowrap;text-align:right;font-size:${S(46)};font-weight:700;color:${r.ch >= 0 ? GREEN : RED}">${r.ch >= 0 ? '▲' : '▼'} ${esc(pct(r.ch).replace(/^[+−]/, ''))}</div></div>`).join('');
  body = `<div class="d" style="font-size:${S(175)};line-height:1">Los mercados <span style="color:${GREEN}">hoy</span></div>
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
const { words, seconds } = storySeconds(await page.evaluate(() => document.querySelector('.root').innerText));
fs.writeFileSync(outFile.replace(/\.png$/, '.dur'), String(seconds));
console.log(`Texto: ${words} palabras → duración recomendada ${seconds} s`);
await browser.close();
console.log('Historia generada, escala', s.toFixed(2));
