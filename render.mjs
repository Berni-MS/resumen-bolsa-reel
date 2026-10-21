// Genera las 8 pantallas (PNG 1080x1920) y un vídeo MP4 vertical para Instagram Reels.
// Uso: node render.mjs data.json out
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { vozBolsa } from './voz-bolsa.mjs';
import { endcardInner, CIERRE_VOZ } from './endcard-lib.mjs';
import { assDe, fuente, whoosh, pistaMusica } from './subs-lib.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const dataFile = process.argv[2] || 'data.json';
const outDir = path.resolve(process.argv[3] || 'out');
// Duración por diapositiva (s): resumen 5, cuatro rankings de 5 y los factores 8 → 33 s en total (cabe también en una historia, máx. 60 s)
const DUR = { '01-variacion': 5, '08-factores': 8, '09-cierre': 4 };
const SECONDS_PER_SLIDE = Number(process.env.SECONDS_PER_SLIDE || 5);
const VOZDUR = {};
const durOf = n => VOZDUR[n] ?? (process.env.SECONDS_PER_SLIDE ? SECONDS_PER_SLIDE : (DUR[n] ?? SECONDS_PER_SLIDE));
const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

// Zona segura de Instagram: arriba ~440 px (cabecera de la cuenta), abajo ~380 px (texto/botones), derecha ~130 px (botones)
const SAFE_TOP = 440, SAFE_L = 70, SAFE_R = 130;
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
        faces.push(`@font-face{font-family:'${family}';font-weight:${w};src:url('data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}') format('woff2');}`);
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
    const big = !!i.big;
    const w = Math.min(100, Math.abs(i.chg) / maxScale * 100).toFixed(1);
    const detail = i.pts ? `${num(i.close, 0)} puntos (antes ${num(i.prev, 0)})` : `${usd(i.close)} (antes ${usd(i.prev)})`;
    return `<div style="position:relative;height:${big ? 226 : 128}px;padding:0 30px 14px;background:${up ? GREEN : RED};color:${INK};display:flex;align-items:center;justify-content:space-between;overflow:hidden;">
      <div><div class="d" style="font-size:${big ? 138 : 70}px;line-height:.9">${esc(i.ticker)}</div><div style="font-size:${big ? 32 : 24}px;font-weight:700">${esc(i.name)}</div></div>
      <div style="text-align:right"><div class="d" style="font-size:${big ? 128 : 74}px;line-height:.85">${pct(i.chg)}</div>
      ${big ? `<div style="font-size:26px;font-weight:500;margin-top:10px">${detail}</div>` : ''}</div>
      <div style="position:absolute;left:0;bottom:0;width:100%;height:${big ? 14 : 10}px;background:rgba(15,27,51,.22)"><div style="width:${w}%;height:${big ? 14 : 10}px;background:${INK}"></div></div>
    </div>`;
  }).join('<div style="height:14px"></div>');
  const note = allUp || allDown ? 'La barra mide el cambio frente a un máximo de 3 %.' : 'La barra mide el cambio frente a un máximo de 3 %. Verde sube, rojo baja.';
  return page(INK, '#fff', `<div style="padding:${SAFE_TOP}px ${SAFE_R}px 0 ${SAFE_L}px">
    <div style="font-size:62px;font-weight:700;color:${GREEN};line-height:1.05">${esc(d.closeLabel || 'Cierre de la sesión')}</div>
    <div style="font-size:48px;font-weight:700;color:#fff;line-height:1.1;margin-top:6px">${esc(d.dateLabel.replace(/ de \d{4}$/, ''))}</div>
    <div class="d" style="font-size:104px;line-height:1.05;margin-top:10px;max-height:230px;overflow:hidden">${esc(d.headline)}</div>
    <div style="margin-top:22px">${slabs}</div>
    <div style="margin-top:22px;font-size:25px;font-weight:500;color:${MUTED};line-height:1.3">${note} Variación respecto al cierre de la sesión anterior.</div>
  </div>`);
}

// ---------- pantallas 2-7: top 5 ----------
const INDEX_NAME = { SPY: 'S&P 500 (SPY)', QQQ: 'Nasdaq 100 (QQQ)', DIA: 'Dow Jones (DIA)', IBEX: 'IBEX 35' };
function tape() {
  return `<div style="margin-top:22px;height:56px;background:${INK};color:#fff;display:flex;align-items:center;padding-left:24px;gap:28px;font-size:28px;font-weight:700;white-space:nowrap">${
    d.indices.filter(i => !d.hasIbex || ['SPY', 'IBEX', 'QQQ'].includes(i.ticker)).map(i => `<span><span style="color:${i.chg >= 0 ? GREEN : RED}">${i.chg >= 0 ? '▲' : '▼'}</span> ${esc(i.ticker)} ${pct(i.chg)}</span>`).join('')}</div>`;
}
function slideTop(idx, kind) {
  const rows = d.lists[idx][kind];
  const gain = kind === 'gainers';
  const max = Math.max(...rows.map(r => Math.abs(r.chg))) || 1;
  const html = rows.map((r, n) => `<div style="position:relative;height:148px;border-top:3px solid ${INK};display:flex;align-items:center;padding-bottom:10px">
      <div class="d" style="width:84px;font-size:68px">${n + 1}º</div>
      <div style="flex:1;min-width:0"><div class="d" style="font-size:84px;line-height:.9">${esc(r.ticker)}</div>
      <div style="font-size:27px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</div></div>
      <div class="d" style="font-size:90px;line-height:1">${pct(r.chg)}</div>
      <div style="position:absolute;left:0;bottom:0;width:100%;height:10px;background:rgba(15,27,51,.2)"><div style="width:${(Math.abs(r.chg) / max * 100).toFixed(1)}%;height:10px;background:${INK}"></div></div>
    </div>`).join('');
  return page(gain ? GREEN : RED, INK, `<div style="padding:${SAFE_TOP}px ${SAFE_R}px 0 ${SAFE_L}px">
    <div class="d" style="font-size:112px;line-height:.9">Top 5 ${gain ? 'subidas' : 'bajadas'}</div>
    <div style="display:inline-block;background:${INK};color:${gain ? GREEN : RED};font-size:64px;font-weight:700;line-height:1;padding:14px 32px;margin-top:16px">${esc(INDEX_NAME[idx])}</div>
    <div style="margin-top:26px">${html}</div>${tape()}</div>`);
}

// ---------- pantalla 8: factores ----------
function slideFactors() {
  const blocks = d.factors.slice(0, 4).map(f => {
    const up = f.dir === 'up';
    return `<div style="display:flex;gap:22px;align-items:flex-start;background:${up ? GREEN : RED};color:${INK};padding:14px 26px;height:200px;overflow:hidden">
      <div style="font-size:56px;line-height:1">${up ? '▲' : '▼'}</div>
      <div style="min-width:0"><div class="d" style="font-size:54px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.title)}</div>
      <div style="font-size:32px;font-weight:700;line-height:1.18;margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(f.text)}</div></div></div>`;
  }).join('<div style="height:12px"></div>');
  return page(INK, '#fff', `<div style="padding:${SAFE_TOP}px ${SAFE_R}px 0 ${SAFE_L}px">
    <div class="d" style="font-size:98px;line-height:.9">Qué movió la bolsa</div>
    <div style="font-size:54px;font-weight:700;color:${GREEN};margin-top:10px;line-height:1.1">${esc((d.closeLabel || 'Cierre') + ' · ' + d.sessionLabel.replace(/^Sesión del /, ''))}</div>
    <div style="margin-top:20px">${blocks}</div>
    <div style="margin-top:14px;font-size:22px;font-weight:500;color:${MUTED};line-height:1.3">Cotizaciones: Polygon.io${d.hasIbex ? ' y Yahoo Finance (IBEX)' : ''}. Contenido informativo, no es asesoramiento financiero.</div></div>`);
}

const SECOND = d.lists.IBEX ? 'IBEX' : 'QQQ'; // segundo ranking: IBEX 35 (o Nasdaq 100 si faltan datos del IBEX)
const slides = [
  ['01-variacion', slideOverview()],
  ['02-spy-subidas', slideTop('SPY', 'gainers')],
  ['03-spy-bajadas', slideTop('SPY', 'losers')],
  [`04-${SECOND.toLowerCase()}-subidas`, slideTop(SECOND, 'gainers')],
  [`05-${SECOND.toLowerCase()}-bajadas`, slideTop(SECOND, 'losers')],
  ['08-factores', slideFactors()],
  ['09-cierre', page(INK, '#fff', endcardInner({ INK, GREEN, MUTED, DISPLAY, sub: 'El resumen de la bolsa, cada mañana.' }))],
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

// ---------- voz en off (opcional: VOZ=true) ----------
const VOICE = process.env.VOZ_VOICE || 'es-ES-AlvaroNeural';
const probe = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const SUBS = process.env.SUBS === 'true'; // subtítulos grabados: desactivados por ahora
const voces = []; // { file, name }
const guionTxt = {};
if (process.env.VOZ === 'true') {
  try {
    const iso = process.env.VOZ_FECHA || d.isoDate;
    const guion = vozBolsa(d, iso);
    guion['09-cierre'] = CIERRE_VOZ;
    fs.writeFileSync(path.join(outDir, 'voz.txt'), slides.map(([n]) => guion[n] ? `[${n}] ${guion[n]}` : '').filter(Boolean).join('\n\n'));
    for (const [n] of slides) {
      const txt = guion[n]; if (!txt) continue; guionTxt[n] = txt;
      const f = path.join(outDir, `voz-${n}.mp3`); const tf = path.join(outDir, `voz-${n}.txt`);
      fs.writeFileSync(tf, txt);
      let ok = false;
      for (let i = 0; i < 3 && !ok; i++) {
        try { execFileSync('edge-tts', ['--voice', VOICE, '--rate=+5%', '--file', tf, '--write-media', f], { stdio: 'pipe' }); ok = fs.existsSync(f) && fs.statSync(f).size > 1000; }
        catch (e) { console.warn(`edge-tts intento ${i + 1} (${n}) falló: ${String(e.stderr || e.message).slice(-200)}`); }
      }
      if (!ok) throw new Error(`sin voz para ${n}`);
      voces.push({ file: f, name: n, dur: probe(f) });
    }
    for (const v of voces) VOZDUR[v.name] = Math.max(durOf(v.name), Math.round((v.dur + 1.1) * 10) / 10);
  } catch (e) { console.warn('AVISO: se genera el vídeo SIN voz:', e.message); voces.length = 0; for (const k in VOZDUR) delete VOZDUR[k]; }
}

// ---------- vídeo ----------
const list = path.join(outDir, 'list.txt');
fs.writeFileSync(list, slides.map(([n]) => `file '${n}.png'\nduration ${durOf(n)}`).join('\n') + `\nfile '${slides.at(-1)[0]}.png'\n`);
const total = slides.reduce((a, [n]) => a + durOf(n), 0);
const music = pistaMusica('bolsa') || path.resolve('assets/music.mp3');
const hasMusic = fs.existsSync(music);
const args = ['-y', '-f', 'concat', '-safe', '0', '-i', list];
if (hasMusic) args.push('-stream_loop', '-1', '-i', music);
else args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
let mapAudio = '1:a', mapVideo = '0:v';
if (voces.length && hasMusic) {
  let t = 0; const starts = {};
  for (const [n] of slides) { starts[n] = t; t += durOf(n); }
  const tmp = fs.mkdtempSync('bs-');
  args.push('-f', 'lavfi', '-i', `color=c=0x35D07F:s=1080x12:r=30`, '-i', whoosh(path.join(tmp, 'wh.wav')));   // 2 barra, 3 whoosh
  for (const v of voces) args.push('-i', v.file); // 4..
  const V0 = 4, nW = slides.length - 1;
  const vf = voces.map((v, i) => `[${i + V0}:a]adelay=${Math.round((starts[v.name] + 0.5) * 1000)}|${Math.round((starts[v.name] + 0.5) * 1000)},volume=1.7[s${i}]`);
  const vmix = voces.length > 1 ? `${voces.map((_, i) => `[s${i}]`).join('')}amix=inputs=${voces.length}:normalize=0,asplit=2[v][k]` : '[s0]asplit=2[v][k]';
  const wst = slides.slice(1).map(([n]) => Math.max(0, Math.round((starts[n] - 0.05) * 1000)));
  const wf = [`[3:a]asplit=${nW}${wst.map((_, i) => `[w${i}]`).join('')}`, ...wst.map((ms, i) => `[w${i}]adelay=${ms}|${ms}[ww${i}]`), `${wst.map((_, i) => `[ww${i}]`).join('')}amix=inputs=${nW}:normalize=0[wh]`];
  // subtítulos (sobre la zona libre inferior) + barra de progreso
  const fu = fuente(path.join(tmp, 'fonts'));
  const clean = s => s.replace(/ese y pe quinientos/gi, 'S&P 500').replace(/ese y pe/gi, 'S&P').replace(/ por ciento/g, ' %').replace(/\bnasdaq cien\b/gi, 'Nasdaq 100');
  const segs = voces.map(v => ({ start: starts[v.name] + 0.5, dur: v.dur, text: clean(guionTxt[v.name]) }));
  const ass = path.join(tmp, 'subs.ass'); fs.writeFileSync(ass, assDe(segs, { yBase: 1520, fontName: fu.name }));
  const fc = [...vf, vmix, ...wf,
    `[1:a]volume=0.5,afade=t=in:st=0:d=0.5,afade=t=out:st=${total - 1.8}:d=1.8[m]`,
    `[m][k]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md]`,
    `[md][v][wh]amix=inputs=3:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
    `[0:v]fps=30,${SUBS ? 'scale=886:1574,pad=1080:1920:97:100:color=0x0F1B33,' : ''}format=yuv420p[b]`,
    `[b][2:v]overlay=x='-w+w*t/${total}':y=1908:shortest=1[pv]`,
    SUBS ? `[pv]ass='${ass}':fontsdir='${fu.dir}'[vs]` : `[pv]null[vs]`].join(';');
  args.push('-filter_complex', fc);
  mapAudio = '[a]'; mapVideo = '[vs]';
  process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });
} else args.push('-vf', 'fps=30,format=yuv420p');
args.push('-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart');
if (hasMusic && !voces.length) args.push('-af', `volume=0.55,afade=t=in:st=0:d=0.5,afade=t=out:st=${total - 1.8}:d=1.8`);
args.push('-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '128k', '-map', mapVideo, '-map', mapAudio, '-t', String(total), path.join(outDir, 'reel.mp4'));
try { execFileSync('ffmpeg', args, { stdio: 'inherit' }); }
catch (e) {
  if (!voces.length) throw e;
  console.warn('AVISO: falló el montaje con voz/subtítulos; se genera con música sola:', e.message);
  const a2 = ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-stream_loop', '-1', '-i', music, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart',
    '-af', `volume=0.55,afade=t=in:st=0:d=0.5,afade=t=out:st=${total - 1.8}:d=1.8`, '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '128k', '-map', '0:v', '-map', '1:a', '-t', String(total), path.join(outDir, 'reel.mp4')];
  execFileSync('ffmpeg', a2, { stdio: 'inherit' });
}
for (const v of voces) { fs.unlinkSync(v.file); try { fs.unlinkSync(v.file.replace('.mp3', '.txt')); } catch {} }
fs.unlinkSync(list);
fs.writeFileSync(path.join(outDir, 'caption.txt'), d.caption || '');
console.log('Vídeo listo:', path.join(outDir, 'reel.mp4'));
