// Reel «En 30 segundos»: vídeo vertical de 30 s con texto animado, 1080x1920.
// Uso: node render-30s.mjs <item.json> <carpeta_salida>
// item.json: { date, mood: up|down|neutral, hook, scenes:[{kicker,text,big?}] (4), caption, source, tags? }
// Marcar una frase clave con [[frase]] para resaltarla en color.
import fs from 'node:fs';
import { ctaBlock } from './cta.mjs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { hablar, ttsFit, mezcla, vozActiva } from './voz-lib.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const item = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = path.resolve(process.argv[3] || 'out');
const FPS = Number(process.env.CAP_FPS || 24);
const STILL_ONLY = process.env.STILL_ONLY; // p. ej. "0,5,12,20,28" para sacar fotogramas sueltos
fs.mkdirSync(outDir, { recursive: true });

const INK = '#0F1B33', GREEN = '#35D07F', RED = '#FF5247', MUTED = '#9FB0CC', CARD = '#16264A';
const ACC = item.mood === 'down' ? RED : item.mood === 'neutral' ? '#7FB5FF' : GREEN;
const SAFE_TOP = 430, SAFE_BOTTOM = 400, SAFE_L = 70, SAFE_R = 140;

// ---- validación ----
if (!item.hook || !Array.isArray(item.scenes) || item.scenes.length < 3 || item.scenes.length > 5) throw new Error('Guion inválido: falta hook o escenas (3 a 5).');
const scenes = item.scenes.slice(0, 4);
const TOTAL = 30, HOOK_DUR = 4, OUTRO_DUR = 4;
const SCENE_DUR = (TOTAL - HOOK_DUR - OUTRO_DUR) / scenes.length;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// [[frase]] -> palabras resaltadas
function words(text) {
  const out = []; let hi = false;
  for (const tok of String(text).split(/(\[\[|\]\])/)) {
    if (tok === '[[') { hi = true; continue; }
    if (tok === ']]') { hi = false; continue; }
    for (const w of tok.split(/\s+/).filter(Boolean)) out.push(`<span class="w${hi ? ' hi' : ''}">${esc(w)}</span>`);
  }
  return out.join(' ');
}

function fontFace() {
  const base = path.resolve('node_modules/@fontsource');
  const faces = [];
  const add = (pkg, family, ws) => { for (const w of ws) {
    const f = path.join(base, pkg, 'files', `${pkg}-latin-${w}-normal.woff2`);
    if (fs.existsSync(f)) faces.push(`@font-face{font-family:'${family}';font-weight:${w};src:url('${pathToFileURL(f).href}') format('woff2');}`);
  } };
  add('big-shoulders-display', 'Big Shoulders Display', [800, 900]);
  add('hanken-grotesk', 'Hanken Grotesk', [500, 700]);
  if (!faces.length) console.warn('AVISO: sin fuentes de marca; se usa fuente provisional.');
  return faces.join('\n');
}

const sceneHtml = (cls, inner) => `<div class="sc ${cls}">${inner}</div>`;
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
${fontFace()}
*{box-sizing:border-box;margin:0}
body{background:${INK}}
.root{position:relative;width:1080px;height:1920px;overflow:hidden;background:${INK};color:#fff;font-family:'Hanken Grotesk','Helvetica Neue',Arial,sans-serif}
.d{font-family:'Big Shoulders Display','Arial Narrow','Liberation Sans Narrow',sans-serif;font-weight:900}
.top{position:absolute;left:${SAFE_L}px;right:${SAFE_R}px;top:${SAFE_TOP - 150}px;display:flex;justify-content:space-between;align-items:center}
.badge{background:${ACC};color:${INK};font-size:34px;font-weight:700;padding:10px 22px;letter-spacing:.5px}
.count{font-size:46px}
.bar{position:absolute;left:${SAFE_L}px;right:${SAFE_R}px;top:${SAFE_TOP - 60}px;height:10px;background:${CARD}}
.bar i{display:block;height:10px;width:0;background:${ACC}}
.sc{position:absolute;left:${SAFE_L}px;right:${SAFE_R}px;top:${SAFE_TOP}px;bottom:${SAFE_BOTTOM}px;display:flex;flex-direction:column;justify-content:center;opacity:0}
.kick{display:inline-block;align-self:flex-start;background:${CARD};color:${ACC};font-size:40px;font-weight:700;padding:12px 24px;margin-bottom:34px;border-left:10px solid ${ACC}}
.big{font-size:260px;line-height:.95;margin-bottom:26px;color:${ACC};white-space:nowrap}
.txt{font-size:120px;line-height:1.14;font-family:'Big Shoulders Display','Arial Narrow','Liberation Sans Narrow',sans-serif;font-weight:900;overflow:hidden}
.hook .txt{font-size:170px}
.hook .big{font-size:300px;margin-bottom:14px}
.w{display:inline-block;opacity:0;margin-right:.22em}
.hi{color:${ACC}}
.small{font-size:30px;font-weight:500;color:${MUTED};line-height:1.35;margin-top:30px}
.handle{font-size:72px;color:${ACC};margin-top:28px}
.logo{position:absolute;left:${SAFE_L}px;bottom:${SAFE_BOTTOM + 10}px;font-size:30px;font-weight:700;color:${MUTED}}
</style></head><body><div class="root">
<div class="top"><span class="badge">${esc(item.badge || 'EN 30 SEGUNDOS')}</span><span class="count d" id="count">30</span></div>
<div class="bar"><i id="prog"></i></div>
${sceneHtml('hook', `<div class="kick" id="hk">${esc(item.date_label || 'Hoy en bolsa')}</div>${item.hook_big ? `<div class="big d">${esc(item.hook_big)}</div>` : ''}<div class="txt" data-fit>${words(item.hook)}</div><div class="handle d" style="font-size:56px;margin-top:40px">@tuamigodelasfinanzas</div>`)}
${scenes.map((s, i) => sceneHtml('body', `<div class="kick">${esc(s.kicker)}</div>${s.big ? `<div class="big d">${esc(s.big)}</div>` : ''}<div class="txt" data-fit>${words(s.text)}</div>`)).join('\n')}
${sceneHtml('outro', `<div class="kick">${esc(item.outro_kick || '¿Lo entendiste?')}</div><div class="txt" data-fit>${words(item.outro_txt || (item.badge ? 'La semana que viene, [[otro consejo]]' : 'Mañana, [[otro]] en 30 segundos'))}</div><div class="handle d">@tuamigodelasfinanzas</div><div class="small">Fuente: ${esc(item.source || 'medios financieros')}. Contenido informativo y educativo; no es asesoramiento financiero.</div>`)}
</div></body></html>`;

const f = path.join(outDir, 'reel.html');
fs.writeFileSync(f, html);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const pg = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
await pg.goto(pathToFileURL(f).href);
await pg.evaluate(() => document.fonts.ready);

// ajuste de tamaño: que cada texto quepa en su caja
const shrunk = await pg.evaluate(() => {
  const logs = [];
  document.querySelectorAll('.sc').forEach((sc, i) => {
    const t = sc.querySelector('[data-fit]');
    let size = parseFloat(getComputedStyle(t).fontSize);
    const room = () => sc.clientHeight - 20 - [...sc.children].filter(c => c !== t).reduce((a, c) => a + c.offsetHeight + parseFloat(getComputedStyle(c).marginBottom) + parseFloat(getComputedStyle(c).marginTop), 0);
    let n = 0;
    while ((t.scrollHeight > room() || t.scrollWidth > t.clientWidth + 1) && size > 40 && n++ < 80) { size -= 4; t.style.fontSize = size + 'px'; }
    if (size < 70) logs.push(`Escena ${i}: texto muy largo (tamaño ${size}px)`);
  });
  return logs;
});
shrunk.forEach(l => console.warn('AVISO:', l));

// línea de tiempo
await pg.evaluate(({ HOOK, SCENE, N, OUT, TOTAL }) => {
  const ease = p => 1 - Math.pow(1 - p, 3);
  const scs = [...document.querySelectorAll('.sc')];
  const starts = scs.map((_, i) => i === 0 ? 0 : i <= N ? HOOK + (i - 1) * SCENE : HOOK + N * SCENE);
  const ends = scs.map((_, i) => i === 0 ? HOOK : i <= N ? HOOK + i * SCENE : TOTAL);
  window.setT = t => {
    scs.forEach((sc, i) => {
      const lt = t - starts[i], dur = ends[i] - starts[i];
      const on = lt >= 0 && lt < dur;
      const fadeOut = i === scs.length - 1 ? 1 : Math.min(1, Math.max(0, (dur - lt) / 0.25));
      sc.style.opacity = on ? fadeOut : 0;
      const step = i === 0 ? 0.11 : 0.085;
      const off = i === 0 ? -10 : 0.15; // el gancho está COMPLETO desde el primer fotograma (portada y primeros segundos fijos)
      sc.querySelectorAll('.w').forEach((w, k) => {
        const p = Math.min(1, Math.max(0, (lt - (k * step + off)) / 0.28));
        w.style.opacity = on ? p : 0;
        w.style.transform = `translateY(${(1 - ease(p)) * 40}px) scale(${0.9 + 0.1 * ease(p)})`;
      });
      const extra = sc.querySelectorAll('.kick,.big,.handle,.small');
      extra.forEach(e => { const p = i === 0 ? 1 : Math.min(1, Math.max(0, (lt + 0.2) / 0.3)); e.style.opacity = on ? p : 0; });
    });
    document.getElementById('prog').style.width = (t / TOTAL * 100) + '%';
    document.getElementById('count').textContent = String(Math.max(0, Math.ceil(TOTAL - t)));
  };
}, { HOOK: HOOK_DUR, SCENE: SCENE_DUR, N: scenes.length, OUT: OUTRO_DUR, TOTAL });

const shot = async t => { await pg.evaluate(t => window.setT(t), t); return pg.screenshot({ type: 'jpeg', quality: 92 }); };

if (STILL_ONLY) {
  for (const s of STILL_ONLY.split(',').map(Number)) fs.writeFileSync(path.join(outDir, `still-${String(s).padStart(2, '0')}.jpg`), await shot(s));
  await browser.close(); fs.unlinkSync(f); process.exit(0);
}

// ---- voz en off: gancho, cada escena y cierre, ajustados a su hueco de la línea de tiempo ----
const voces = [];
if (vozActiva()) {
  try {
    const conBig = (big, txt) => (big && !/\d/.test(String(txt)) ? `${hablar(txt)}: ${hablar(big)}.` : `${hablar(txt)}.`).replace(/\.\.$/, '.');
    const guion = [
      { start: 0.25, slot: HOOK_DUR - 0.5, text: item.voz_hook || conBig(item.hook_big, item.hook) },
      ...scenes.map((s, i) => ({ start: HOOK_DUR + i * SCENE_DUR + 0.25, slot: SCENE_DUR - 0.5, text: s.voz || conBig(s.big, s.text) })),
      { start: HOOK_DUR + scenes.length * SCENE_DUR + 0.25, slot: OUTRO_DUR - 0.8, text: item.voz_outro || (item.badge ? 'La semana que viene, otro consejo para tu bolsillo. Sígueme para no perdértelo.' : 'Mañana, otro en treinta segundos. Sígueme para no perdértelo.') },
    ];
    for (const [i, g] of guion.entries()) {
      const file = path.join(outDir, `voz-${i}.mp3`);
      const dur = ttsFit(g.text, file, g.slot);
      voces.push({ file, start: g.start, dur, text: g.text });
    }
    fs.writeFileSync(path.join(outDir, 'voz.txt'), voces.map((v, i) => `[${i === 0 ? 'gancho' : i <= scenes.length ? 'escena ' + i : 'cierre'}] ${v.text}`).join('\n\n'));
  } catch (e) { console.warn('AVISO: se genera el vídeo SIN voz:', e.message); voces.length = 0; }
}

// vídeo: fotogramas a CAP_FPS enviados a ffmpeg
const music = path.resolve('assets/music.mp3');
const hasMusic = fs.existsSync(music);
const args = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
if (hasMusic) args.push('-stream_loop', '-1', '-i', music); else args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
let mapAudio = '1:a';
if (voces.length && hasMusic) {
  for (const v of voces) args.push('-i', v.file);
  args.push('-filter_complex', mezcla({ musicIdx: 1, voices: voces.map((v, i) => ({ idx: i + 2, start: v.start })), total: TOTAL }));
  mapAudio = '[a]';
}
args.push('-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart');
if (hasMusic && !voces.length) args.push('-af', `volume=0.55,afade=t=in:st=0:d=0.5,afade=t=out:st=${TOTAL - 1.8}:d=1.8`);
args.push('-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '128k', '-map', '0:v', '-map', mapAudio, '-t', String(TOTAL), path.join(outDir, 'reel.mp4'));
const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => { ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg terminó con código ' + c))); });
for (let n = 0; n < TOTAL * FPS; n++) {
  const buf = await shot(n / FPS);
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
}
ff.stdin.end();
await done;
for (const v of voces) fs.rmSync(v.file, { force: true });
await browser.close();
fs.unlinkSync(f);

// pie del Reel
const tags = (item.tags && item.tags.length ? item.tags : ['#bolsa', '#inversion', '#finanzas', '#aprenderbolsa']).slice(0, 3);
const caption = `${item.caption}\n\n${ctaBlock(item.caption, item.cta_kind || (item.badge ? 'consejo' : 'bolsa'))}\n\nFuente: ${item.source || 'medios financieros'}.\n\nContenido informativo y educativo. No es asesoramiento financiero ni una recomendación de compra o venta.\n\n${[...new Set([...tags, '#tuamigodelasfinanzas'])].join(' ')}`;
if (caption.length > 2200) throw new Error('El pie supera 2.200 caracteres');
fs.writeFileSync(path.join(outDir, 'caption.txt'), caption);
console.log('Vídeo listo:', path.join(outDir, 'reel.mp4'));
