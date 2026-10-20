// Utilidades comunes de voz en off (edge-tts, voz de Álvaro). Si algo falla, quien llama genera el vídeo sin voz.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const VOICE = process.env.VOZ_VOICE || 'es-ES-AlvaroNeural';
export const vozActiva = () => String(process.env.VOZ ?? 'true') !== 'false';

const PRONUNCIABLES = { IBEX: 'Íbex', TIN: 'tin', NASDAQ: 'Nasdaq', DOW: 'Dow', BIZUM: 'Bizum', SEPA: 'Sepa', OTAN: 'Otan', EURIBOR: 'Euríbor', PIN: 'pin', IPC: 'I P C' };
// Pasa un texto de pantalla a texto que suene bien hablado
// Pronunciación de nombres ingleses frecuentes (ampliable)
const DICC = { sandisk: 'Sándisk', datadog: 'Dátadog', palantir: 'Palantír', nvidia: 'Envídia', honeywell: 'Jóniguel', broadcom: 'Brodcom', netflix: 'Nétflix', tesla: 'Tesla', meta: 'Meta', amazon: 'Ámazon', alphabet: 'Álfabet', microsoft: 'Máicrosoft', apple: 'Ápel', walmart: 'Guólmart', intel: 'Íntel', oracle: 'Órakel', salesforce: 'Séilsfors', uber: 'Úber', airbnb: 'Érbienbi', paypal: 'Péipal', moderna: 'Moderna', pfizer: 'Fáizer', coinbase: 'Cóinbeis', snowflake: 'Snóufleik', crowdstrike: 'Cráudstraik', micron: 'Máicron', qualcomm: 'Cuálcom', starbucks: 'Stárbocs', mcdonalds: 'Macdónalds', visa: 'Visa', mastercard: 'Máster card' };
export function hablar(t) {
  let s = String(t ?? '').replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/\b(\w+)\b/g, (m, w) => DICC[w.toLowerCase()] || m);
  s = s.replace(/S&P/g, 'ese y pe').replace(/&/g, ' y ');
  s = s.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2'); // 1.000 -> 1000
  s = s.replace(/([+−\-–])\s?(\d)/g, (m, sg, d) => (sg === '+' ? 'más ' : 'menos ') + d);
  s = s.replace(/(\d)\s?%/g, '$1 por ciento').replace(/%/g, ' por ciento');
  s = s.replace(/(\d)\s?€/g, '$1 euros').replace(/€/g, ' euros').replace(/\$/g, ' dólares');
  s = s.replace(/(\d)\s?x\b/gi, '$1 veces').replace(/×/g, ' por ');
  s = s.replace(/euros\/mes/g, 'euros al mes').replace(/euros\/año/g, 'euros al año');
  s = s.replace(/→/g, ', ').replace(/[▲▼•·]/g, ' ');
  s = s.replace(/\b([A-ZÁÉÍÓÚÑ]{2,6})\b/g, (m, w) => PRONUNCIABLES[w] || w.split('').join(' '));
  return s.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
}

export const probe = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

export function tts(text, file, rate = 6) {
  const tf = path.join(os.tmpdir(), `voz-${process.pid}-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(tf, text);
  let err = '';
  for (let i = 0; i < 3; i++) {
    try {
      fs.rmSync(file, { force: true });
      execFileSync('edge-tts', ['--voice', VOICE, `--rate=+${Math.round(rate)}%`, '--file', tf, '--write-media', file], { stdio: 'pipe' });
      if (fs.existsSync(file) && fs.statSync(file).size > 1000) { fs.rmSync(tf, { force: true }); return probe(file); }
    } catch (e) { err = String(e.stderr || e.message).slice(-200); console.warn(`edge-tts intento ${i + 1} falló: ${err}`); }
  }
  fs.rmSync(tf, { force: true });
  throw new Error('edge-tts no generó audio: ' + err);
}

// Genera la voz y la acelera lo justo (máx. +35 %, y como último recurso atempo) para que quepa en `slot` segundos
export function ttsFit(text, file, slot) {
  let d = tts(text, file, 6);
  if (d <= slot) return d;
  d = tts(text, file, Math.min(35, Math.ceil((d / slot * 1.06 - 1) * 100)));
  if (d <= slot) return d;
  const f = Math.min(1.3, d / slot), tmp = file + '.t.mp3';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-filter:a', `atempo=${f.toFixed(3)}`, tmp]);
  fs.renameSync(tmp, file);
  return probe(file);
}

// Mezcla: música (entrada musicIdx) bajando mientras habla la voz; voces = [{ idx, start }]
export function mezcla({ musicIdx, voices, total, musicVol = 0.5, fadeOut = 1.8 }) {
  const parts = voices.map((v, i) => `[${v.idx}:a]adelay=${Math.round(v.start * 1000)}|${Math.round(v.start * 1000)},volume=1.7[s${i}]`);
  parts.push(voices.length > 1 ? `${voices.map((_, i) => `[s${i}]`).join('')}amix=inputs=${voices.length}:normalize=0,asplit=2[v][k]` : '[s0]asplit=2[v][k]');
  parts.push(`[${musicIdx}:a]volume=${musicVol},afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(0, total - fadeOut)}:d=${fadeOut}[m]`);
  parts.push('[m][k]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md]');
  parts.push('[md][v]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]');
  return parts.join(';');
}
