// Vídeo vertical (1080x1920) de un carrusel para TikTok: zoom suave, subtítulos, barra de progreso, voz en off,
// música con ducking, sonido de transición y volumen normalizado.
// Uso: node tools/carrusel-video.mjs <carpeta con 01.jpg..07.jpg> <salida.mp4> <carpeta_voz>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assDe, fuente, whoosh, pistaMusica } from '../subs-lib.mjs';

const [dirImgs, out, dirVoz] = process.argv.slice(2);
const imgs = fs.readdirSync(dirImgs).filter(f => /^0[1-7]\.jpg$/.test(f)).sort().map(f => path.join(dirImgs, f));
const N = imgs.length; if (N < 2) throw new Error('Faltan diapositivas');
const vz = dirVoz && fs.existsSync(path.join(dirVoz, 'voz.json')) ? JSON.parse(fs.readFileSync(path.join(dirVoz, 'voz.json'), 'utf8')) : null;
const SUBS = process.env.SUBS === 'true';
const MIN = 4, FADE = 0.5, FPS = 30;
const dur = imgs.map((_, i) => vz ? Math.max(MIN, (vz.durs[i] || 0) + 0.8) : 5);
const starts = []; let acc = 0;
dur.forEach((d, i) => { starts.push(i === 0 ? 0 : acc - FADE); acc = i === 0 ? d : acc + d - FADE; });
const TOTAL = acc;

const music = pistaMusica() || path.resolve('assets/music.mp3');
const tmp = fs.mkdtempSync('cv-');
const args = ['-y'];
imgs.forEach(f => args.push('-i', f));                       // 0..N-1
args.push('-stream_loop', '-1', '-i', music);                // N
args.push('-f', 'lavfi', '-i', `color=c=0x35D07F:s=1080x12:r=${FPS}`); // N+1 barra de progreso
const wh = whoosh(path.join(tmp, 'whoosh.wav')); args.push('-i', wh); // N+2
const IV = N + 3;
if (vz) for (let i = 0; i < N; i++) args.push('-i', path.join(dirVoz, `${String(i + 1).padStart(2, '0')}.mp3`)); // N+3..

let f = '';
imgs.forEach((_, i) => {
  const F = Math.round(dur[i] * FPS);
  f += `[${i}:v]scale=1944:-1,zoompan=z='1+0.05*on/${F}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${F}:s=${SUBS ? '918x1148' : '972x1215'}:fps=${FPS},pad=1080:1920:${SUBS ? '81:240' : '54:130'}:color=0x0F1B33,setsar=1,format=yuv420p[v${i}];`;
});
let prev = 'v0';
for (let i = 1; i < N; i++) { f += `[${prev}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${starts[i].toFixed(3)}[x${i}];`; prev = `x${i}`; }
f += `[${prev}][${N + 1}:v]overlay=x='-w+w*t/${TOTAL.toFixed(3)}':y=1908:shortest=1[pv];`;
prev = 'pv';

let ass = null;
if (vz && SUBS) {
  const fu = fuente(path.join(tmp, 'fonts'));
  const segs = vz.textos.map((t, i) => ({ start: starts[i] + 0.25, dur: vz.durs[i], text: t }));
  ass = path.join(tmp, 'subs.ass');
  fs.writeFileSync(ass, assDe(segs, { yBase: 1520, fontName: fu.name }));
  f += `[${prev}]ass='${ass}':fontsdir='${fu.dir}'[vs];`;
  prev = 'vs';
}

// audio
const a = [];
a.push(`[${N}:a]volume=0.5,afade=t=in:d=0.5,afade=t=out:st=${(TOTAL - 1.5).toFixed(2)}:d=1.5[m]`);
const whParts = starts.slice(1).map((s, i) => `[w${i}]`);
a.push(`[${N + 2}:a]asplit=${N - 1}${whParts.join('')}`);
starts.slice(1).forEach((s, i) => a.push(`[w${i}]adelay=${Math.round(Math.max(0, s - 0.05) * 1000)}|${Math.round(Math.max(0, s - 0.05) * 1000)}[ww${i}]`));
const wmix = `${starts.slice(1).map((_, i) => `[ww${i}]`).join('')}amix=inputs=${N - 1}:normalize=0[wh]`;
if (vz) {
  const vs = [];
  for (let i = 0; i < N; i++) { const ms = Math.round((starts[i] + 0.25) * 1000); a.push(`[${IV + i}:a]adelay=${ms}|${ms},volume=1.7[s${i}]`); vs.push(`[s${i}]`); }
  a.push(`${vs.join('')}amix=inputs=${N}:normalize=0,asplit=2[v][k]`);
  a.push('[m][k]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md]');
  a.push(wmix);
  a.push('[md][v][wh]amix=inputs=3:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]');
} else {
  a.push(wmix);
  a.push('[m][wh]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]');
}
f += a.join(';');

args.push('-filter_complex', f, '-map', `[${prev}]`, '-map', '[a]', '-t', TOTAL.toFixed(2),
  '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '128k', '-movflags', '+faststart', out);
try { execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', fs.openSync('ffmpeg-carrusel.log', 'w')] }); }
catch (e) { console.error('::warning::ffmpeg falló: ' + fs.readFileSync('ffmpeg-carrusel.log', 'utf8').slice(-600).replace(/\n/g, ' ')); throw e; }
finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`Vídeo listo: ${out} (${TOTAL.toFixed(1)} s)`);
