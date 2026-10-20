// Subtítulos grabados (ASS) con la voz en off, y utilidades de audio comunes para todos los vídeos.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const clean = s => String(s).replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' ').trim();
const ts = t => { const c = Math.max(0, Math.round(t * 100)); const h = Math.floor(c / 360000), m = Math.floor(c / 6000) % 60, s = Math.floor(c / 100) % 60; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c % 100).padStart(2, '0')}`; };

// Trozos de 2-5 palabras (máx. ~30 caracteres), cortando tras la puntuación
export function trozos(text) {
  const words = clean(text).split(' ').filter(Boolean);
  const out = []; let cur = [];
  const len = a => a.join(' ').length;
  for (const w of words) {
    if (cur.length && (len(cur) + 1 + w.length > 30 || cur.length >= 5)) { out.push(cur); cur = []; }
    cur.push(w);
    if (/[.,;:!?]$/.test(w) && cur.length >= 2) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  // un trozo suelto de 1 palabra se une al anterior si cabe
  for (let i = out.length - 1; i > 0; i--) if (out[i].length === 1 && len(out[i - 1]) + 1 + out[i][0].length <= 34) { out[i - 1].push(out[i][0]); out.splice(i, 1); }
  return out;
}
const pesoPalabra = w => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1 + (/[.!?:]$/.test(w) ? 5 : /[,;]$/.test(w) ? 3 : 0);

// segs: [{ start, dur, text }] con tiempos absolutos (s). Reparte el tiempo de cada locución por peso de palabra.
export function assDe(segs, { w = 1080, h = 1920, yBase = 1700, fontName = 'Hanken Grotesk', size = 60 } = {}) {
  const lines = [];
  for (const sg of segs) {
    const tr = trozos(sg.text);
    const pesos = tr.map(t => t.reduce((a, x) => a + pesoPalabra(x), 0));
    const total = pesos.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    tr.forEach((t, i) => {
      const t0 = sg.start + sg.dur * (acc / total); acc += pesos[i];
      const t1 = i === tr.length - 1 ? sg.start + sg.dur + 0.15 : sg.start + sg.dur * (acc / total);
      lines.push(`Dialogue: 0,${ts(t0)},${ts(t1)},Sub,,0,0,0,,${t.join(' ').replace(/[{}\\]/g, '')}`);
    });
  }
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,${fontName},${size},&H00FFFFFF,&H00FFFFFF,&H00331B0F,&H00331B0F,-1,0,0,0,100,100,0,0,3,16,0,2,90,90,${h - yBase},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join('\n')}
`;
}

// Prepara una fuente TTF para libass (Hanken Grotesk Bold de @fontsource convertida; si falla, DejaVu Sans Bold del sistema)
export function fuente(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const base = path.resolve('node_modules/@fontsource/hanken-grotesk/files/hanken-grotesk-latin-700-normal');
  for (const ext of ['woff', 'woff2']) {
    const src = `${base}.${ext}`;
    if (!fs.existsSync(src)) continue;
    try {
      const dst = path.join(dir, 'HankenGrotesk-Bold.ttf');
      execFileSync('python3', ['-c', 'import sys\nfrom fontTools.ttLib import TTFont\nf=TTFont(sys.argv[1]); f.flavor=None; f.save(sys.argv[2])', src, dst], { stdio: 'pipe' });
      if (fs.existsSync(dst) && fs.statSync(dst).size > 1000) return { dir, name: 'Hanken Grotesk' };
    } catch (e) { console.warn(`Conversión de fuente (${ext}) falló: ${String(e.stderr || e.message).slice(-120)}`); }
  }
  console.warn('AVISO: se usan los subtítulos con DejaVu Sans Bold');
  return { dir, name: 'DejaVu Sans' };
}

// Sonido de transición muy discreto (ruido rosa filtrado), generado con ffmpeg
export function whoosh(file) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anoisesrc=d=0.5:c=pink:r=44100:a=0.5', '-af', 'highpass=f=700,lowpass=f=5500,afade=t=in:d=0.18,afade=t=out:st=0.2:d=0.3,volume=0.35', file]);
  return file;
}

// Pista de música: rota entre assets/music*.mp3 según el día (con una sola pista, siempre la misma)
export function pistaMusica(seed = new Date()) {
  const dir = path.resolve('assets');
  const pistas = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^music.*\.(mp3|m4a|wav)$/i.test(f)).sort() : [];
  if (!pistas.length) return null;
  const dia = Math.floor(seed.getTime() / 86400000);
  return path.join(dir, pistas[dia % pistas.length]);
}
