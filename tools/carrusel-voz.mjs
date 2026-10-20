// Voz en off para el vídeo de un carrusel. Uso: node tools/carrusel-voz.mjs <item.json> <carpeta_voz>
// Escribe <carpeta_voz>/NN.mp3 y <carpeta_voz>/durs.txt (segundos por diapositiva, una por línea) y voz.txt (guion).
import fs from 'node:fs';
import path from 'node:path';
import { hablar, tts, vozActiva } from '../voz-lib.mjs';

const item = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const dir = path.resolve(process.argv[3]);
if (!vozActiva()) { console.log('Voz desactivada'); process.exit(0); }
fs.mkdirSync(dir, { recursive: true });

const p = s => { const h = hablar(s); return h && !/[.!?:]$/.test(h) ? h + '.' : h; };
const ORD = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis'];
function strings(o) { return typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(strings) : o && typeof o === 'object' ? Object.values(o).flatMap(strings) : []; }

function guion(sl, i, n) {
  const k = [];
  switch (sl.t) {
    case 'cover': k.push(sl.big ? p(`${String(sl.big).replace(/[.:]$/, '')}, ${sl.title || ''}`) : p(sl.title), p(sl.foot)); break;
    case 'point': if (sl.kicker) k.push(p(sl.kicker)); k.push(p(sl.head), p(sl.body), p(sl.note)); break;
    case 'cards': k.push(p(sl.head), ...(sl.cards || []).map(c => p(`${c.t}: ${c.b}`))); break;
    case 'steps': k.push(p(sl.head), ...(sl.steps || []).map((s, j) => p(`Paso ${ORD[j].toLowerCase()}: ${s.t}. ${s.b}`))); break;
    case 'stat': if (sl.kicker) k.push(p(sl.kicker)); k.push(p(sl.head), p(sl.big), p(sl.body)); break;
    case 'myth': k.push(p(`Mito: ${sl.myth}`), p(`Realidad: ${sl.reality}`)); break;
    case 'close': k.push(p(sl.head), p(sl.body), p(sl.extra), 'Contenido educativo, no es asesoramiento financiero.'); break;
    default: k.push(...strings(sl).filter(s => s.length > 2 && !/^#/.test(s)).map(p));
  }
  return k.filter(Boolean).join(' ').replace(/\s+/g, ' ');
}

const lines = [], durs = [];
for (const [i, sl] of item.slides.slice(0, 7).entries()) {
  const nn = String(i + 1).padStart(2, '0');
  const txt = guion(sl, i, item.slides.length);
  const d = tts(txt, path.join(dir, `${nn}.mp3`), 4);
  durs.push(d); lines.push(`[${nn}] ${txt}`);
}
fs.writeFileSync(path.join(dir, 'durs.txt'), durs.join('\n') + '\n');
fs.writeFileSync(path.join(dir, 'voz.txt'), lines.join('\n\n'));
console.log('Voz del carrusel: ' + durs.map(d => d.toFixed(1) + 's').join(' '));
