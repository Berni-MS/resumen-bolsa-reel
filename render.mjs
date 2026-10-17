// Genera las 8 pantallas (PNG 1080x1920) y un vídeo MP4 vertical para Instagram Reels.
// Uso: node render.mjs data.json out
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const dataFile = process.argv[2] || 'data.json';
const outDir = path.resolve(process.argv[3] || 'out');
const SECONDS_PER_SLIDE = Number(process.env.SECONDS_PER_SLIDE || 3);
const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const INK = '#0F1B33', GREEN = '#35D07F', RED = '#FF5247', MUTED = '#9FB0CC';

// ---------- formato español ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (x, dec = 2) => Math.abs(x).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct = x => (x < 0 ? '−' : x > 0 ? '+' : '') + num(x) + ' %';
const usd = x => num(x) + ' $';

// ---------- fuentes ----------
function fontFace() {
  const base = path.resolve('node_modules/@fontsource');
  const faces = [];
  const add = (pkg, family, weights) => {
    for (const w of weights) {
      const f = path.join(base, pkg, 'files', `${pkg}-latin-${w}-normal.woff2`);
      if (fs.existsSync(f)) {
        faces.push(`@font-face{font-family:'${family}';font-weight:${w};src:url('${pathToFileURL(f).href}') format('woff2');}`);
      }
    }
  };
  add('big-shoulders-display', 'Big Shoulders Display', [700, 800, 900]);
  add('hanken-grotesk', 'Hanken Grotesk', [500, 700]);
  if (!faces.length) console.warn('AVISO: no se encontraron las fuentes; se usa una fuente provisional.');
  return faces.join('\n');
}
const DISPLAY = `'Big Shoulders Display','Arial Narrow','Liberation Sans Narrow',sans-serif`;
const BODY = `'Hanken Grotesk','Helvetica Neue',Arial,sans-serif`;

const page = (bg, fg, inner) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
${fontFace()}
*{box-sizing:border-box}
body{margin:0}
.root{position:relative;width:1080px;height:1920px;overflow:hidden;background:${bg};color:${fg};font-family:${BODY}}
.d{font-family:${DISPLAY};font-weight:900}
</style></head><body><div class="root">${inner}</div></body></html>`;

// ---------- pantalla 1: variación diaria ----------
function slideOverview() {
  const maxScale = 3; // la barra mide el % frente a un máximo de 3 %
  const allUp = d.indices.every(i => i.chg > 0), allDown = d.indices.every(i => i.chg < 0);
  const slabs = d.indices.map(i => {
    const up = i.chg >= 0;
    const w = Math.min(100, Math.abs(i.chg) / maxScale * 100).toFixed(1);
    return `<div style="position:relative;height:250px;padding:0 36px 18px;background:${up ? GREEN : RED};color:${INK};display:flex;align-items:center;justify-content:space-between;overflow:hidden">
      <div><div class="d" style="font-size:128px;line-height:.9">${esc(i.ticker)}</div><div style="font-size:32px;font-weight:700">${esc(i.name)}</div></div>
      <div style="text-align:right"><div class="d" style="font-size:132px;line-height:.85">${pct(i.chg)}</div>
      <div style="font-size:28px;font-weight:500;margin-top:14px">${usd(i.close)} (antes ${usd(i.prev)})</div></div>
      <div style="position:absolute;left:0;bottom:0;width:100%;height:18px;background:rgba(15,27,51,.22)"><div style="width:${w}%;height:18px;background:${INK}"></div></div>
    </div>`;
  }).join('<div style="height:20px"></div>');
  const note = allUp || allDown ? 'La barra mide el cambio frente a un máximo de 3 %.' : 'La barra mide el cambio frente a un máximo de 3 %. Verde sube, rojo baja.';
  return page(INK, '#fff', `<div style="padding:290px 120px 0 80px">
    <div style="font-size:44px;font-weight:700;color:${MUTED}">${esc(d.dateLabel)}</div>
    <div class="d" style="font-size:150px;line-height:.9;margin-top:16px">${esc(d.headline)}</div>
    <div style="margin-top:52px">${slabs}</div>
    <div style="margin-top:36px;font-size:30px;font-weight:500;color:${MUTED};line-height:1.3">${note} Variación respecto al cierre de la sesión anterior.</div>
  </div>`);
}

// ---------- pantallas 2-7: top 5 ----------
const INDEX_NAME = { SPY: 'S&P 500 (SPY)', QQQ: 'Nasdaq 100 (QQQ)', DIA: 'Dow Jones (DIA)' };
function tape() {
  return `<div style="position:absolute;left:0;top:1520px;width:1080px;height:64px;background:${INK};color:#fff;display:flex;align-items:center;padding-left:80px;gap:36px;font-size:30px;font-weight:700;white-space:nowrap">${
    d.indices.map(i => `<span><span style="color:${i.chg >= 0 ? GREEN : RED}">${i.chg >= 0 ? '▲' : '▼'}</span> ${esc(i.ticker)} ${pct(i.chg)}</span>`).join('')}</div>`;
}
function slideTop(idx, kind) {
  const rows = d.lists[idx][kind];
  const gain = kind === 'gainers';
  const max = Math.max(...rows.map(r => Math.abs(r.chg))) || 1;
  const html = rows.map((r, n) => `<div style="position:relative;height:176px;border-top:3px solid ${INK};display:flex;align-items:center;padding-bottom:12px">
      <div class="d" style="width:100px;font-size:84px">${n + 1}º</div>
      <div style="flex:1;min-width:0"><div class="d" style="font-size:104px;line-height:.9">${esc(r.ticker)}</div>
      <div style="font-size:32px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</div></div>
      <div class="d" style="font-size:112px;line-height:1">${pct(r.chg)}</div>
      <div style="position:absolute;left:0;bottom:0;width:100%;height:12px;background:rgba(15,27,51,.2)"><div style="width:${(Math.abs(r.chg) / max * 100).toFixed(1)}%;height:12px;background:${INK}"></div></div>
    </div>`).join('');
  return page(gain ? GREEN : RED, INK, `<div style="padding:250px 120px 0 80px">
    <div class="d" style="font-size:150px;line-height:.9">Top 5 ${gain ? 'subidas' : 'bajadas'}</div>
    <div style="font-size:48px;font-weight:700;margin-top:14px">${esc(INDEX_NAME[idx])}</div>
    <div style="margin-top:40px">${html}</div></div>${tape()}`);
}

// ---------- pantalla 8: factores ----------
function slideFactors() {
  const blocks = d.factors.slice(0, 4).map(f => {
    const up = f.dir === 'up';
    return `<div style="display:flex;gap:28px;align-items:flex-start;background:${up ? GREEN : RED};color:${INK};padding:22px 32px;height:200px;overflow:hidden">
      <div style="font-size:72px;line-height:1">${up ? '▲' : '▼'}</div>
      <div style="min-width:0"><div class="d" style="font-size:56px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.title)}</div>
      <div style="font-size:30px;font-weight:700;line-height:1.22;margin-top:8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(f.text)}</div></div></div>`;
  }).join('<div style="height:20px"></div>');
  return page(INK, '#fff', `<div style="padding:250px 120px 0 80px">
    <div class="d" style="font-size:150px;line-height:.9">Qué movió la bolsa</div>
    <div style="font-size:44px;font-weight:700;color:${MUTED};margin-top:14px">${esc(d.sessionLabel)}</div>
    <div style="margin-top:44px">${blocks}</div></div>
    <div style="position:absolute;left:80px;top:1530px;width:880px;font-size:26px;font-weight:500;color:${MUTED};line-height:1.3">Cotizaciones: Polygon.io. Contenido informativo, no es asesoramiento financiero.</div>`);
}

const slides = [
  ['01-variacion', slideOverview()],
  ['02-spy-subidas', slideTop('SPY', 'gainers')],
  ['03-spy-bajadas', slideTop('SPY', 'losers')],
  ['04-qqq-subidas', slideTop('QQQ', 'gainers')],
  ['05-qqq-bajadas', slideTop('QQQ', 'losers')],
  ['06-dia-subidas', slideTop('DIA', 'gainers')],
  ['07-dia-bajadas', slideTop('DIA', 'losers')],
  ['08-factores', slideFactors()],
];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
for (const [name, html] of slides) {
  const f = path.join(outDir, `${name}.html`);
  fs.writeFileSync(f, html);
  await pg.goto(pathToFileURL(f).href);
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: path.join(outDir, `${name}.png`) });
  fs.unlinkSync(f);
  console.log('ok', name);
}
await browser.close();

// ---------- vídeo ----------
const list = path.join(outDir, 'list.txt');
fs.writeFileSync(list, slides.map(([n]) => `file '${n}.png'\nduration ${SECONDS_PER_SLIDE}`).join('\n') + `\nfile '${slides.at(-1)[0]}.png'\n`);
execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list,
  '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
  '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '128k', '-shortest', '-t', String(SECONDS_PER_SLIDE * slides.length),
  path.join(outDir, 'reel.mp4')], { stdio: 'inherit' });
fs.unlinkSync(list);
fs.writeFileSync(path.join(outDir, 'caption.txt'), d.caption || '');
console.log('Vídeo listo:', path.join(outDir, 'reel.mp4'));
