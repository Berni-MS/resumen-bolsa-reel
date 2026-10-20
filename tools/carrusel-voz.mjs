// Voz en off para el vídeo de un carrusel. Uso: node tools/carrusel-voz.mjs <item.json> <carpeta_voz>
// Escribe <carpeta_voz>/NN.mp3 y <carpeta_voz>/durs.txt (segundos por diapositiva, una por línea) y voz.txt (guion).
import fs from 'node:fs';
import path from 'node:path';
import { hablar, tts, vozActiva } from '../voz-lib.mjs';
import { guionesGemini } from './voz-gemini.mjs';

const item = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const dir = path.resolve(process.argv[3]);
if (!vozActiva()) { console.log('Voz desactivada'); process.exit(0); }
fs.mkdirSync(dir, { recursive: true });
try { await guionesGemini(item); } catch (e) { console.warn('Gemini no disponible:', e.message); }

const p = s => { const h = hablar(s); return h && !/[.!?:]$/.test(h) ? h + '.' : h; };
const ORD = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis'];
function strings(o) { return typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(strings) : o && typeof o === 'object' ? Object.values(o).flatMap(strings) : []; }

const ORDF = ['la primera', 'la segunda', 'la tercera', 'la cuarta', 'la quinta'];
const ORDM = ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto'];
const LEAD = { ojo: 'Ojo: ', cuidado: 'Ojo: ', 'un matiz': 'Ojo, un matiz: ', atención: 'Atención: ', 'un consejo': 'Un consejo: ', consejo: 'Un consejo: ', 'el truco': 'Y aquí está el truco: ', ejemplo: 'Veamos un ejemplo. ', 'lo básico': 'Lo primero, lo básico: ', primero: 'Lo primero: ', después: 'Después, ', 'la estafa': 'Así funciona la estafa. ' };
const ROT = ['Fíjate en esto: ', 'Otro punto importante: ', 'Y algo más: ', 'Sigamos: '];
let rot = 0;
const sinPunto = s => String(s || '').trim().replace(/[.\s]+$/, '');

function guion(sl, i, n, mythN) {
  if (sl.voz) return hablar(sl.voz); // guion de voz escrito a mano (o generado) para esta diapositiva
  const k = [];
  switch (sl.t) {
    case 'cover': {
      const big = String(sl.big || '').trim();
      const pref = /^\p{L}{3,}$/u.test(big) ? `${big}: ` : /^\d+$/.test(big) ? `${big} ` : '';
      k.push(p(`${pref}${sl.title || ''}`), p(sl.foot)); break;
    }
    case 'point': {
      const lead = LEAD[String(sl.kicker || '').trim().toLowerCase()] || ROT[rot++ % ROT.length];
      const hd = sinPunto(sl.head).replace(/\[\[|\]\]/g, ''); const h2 = /: $/.test(lead) && /^\p{Lu}\p{Ll}/u.test(hd) ? hd.charAt(0).toLowerCase() + hd.slice(1) : hd;
      k.push(p(`${lead}${h2}`), p(sl.body), p(sl.note)); break;
    }
    case 'cards': {
      const c = sl.cards || [];
      k.push(p(sl.head), p(`Hay ${c.length === 3 ? 'tres' : c.length === 2 ? 'dos' : c.length} cosas a tener en cuenta`));
      c.forEach((x, j) => k.push(p(`${j === c.length - 1 && c.length > 1 ? 'Y ' + ORDF[j] : j === 0 ? 'Empiezo por ' + ORDF[j] : 'Después, ' + ORDF[j]}: ${sinPunto(x.t)}. ${x.b}`)));
      break;
    }
    case 'steps': {
      const st = sl.steps || [];
      k.push(p(sl.head));
      st.forEach((x, j) => k.push(p(`${j === st.length - 1 && st.length > 1 ? 'Y por último' : ORDM[j]}, ${sinPunto(x.t).replace(/^./, c => c.toLowerCase())}. ${x.b}`)));
      break;
    }
    case 'stat': if (sl.kicker) k.push(p(sl.kicker)); k.push(p(sl.head), p(sl.big), p(sl.body)); break;
    case 'myth': k.push(p(`Mito número ${mythN}: ${sl.myth}`), p(`Pero la realidad es otra. ${sl.reality}`)); break;
    case 'close': {
      const ex = /^fuentes?:/i.test(String(sl.extra || '').trim()) ? 'Las fuentes aparecen en la última imagen.' : sl.extra;
      k.push(p(sl.head), p(sl.body), p(ex), 'Y recuerda: contenido educativo, no es asesoramiento financiero.'); break;
    }
    default: k.push(...strings(sl).filter(s => s.length > 2 && !/^#/.test(s)).map(p));
  }
  return k.filter(Boolean).join(' ').replace(/\s+/g, ' ');
}

const lines = [], durs = [];
let mythN = 0;
for (const [i, sl] of item.slides.slice(0, 7).entries()) {
  const nn = String(i + 1).padStart(2, '0');
  if (sl.t === 'myth') mythN++;
  const txt = guion(sl, i, item.slides.length, mythN);
  const d = tts(txt, path.join(dir, `${nn}.mp3`), 4);
  durs.push(d); lines.push(`[${nn}${sl.voz ? (sl.vozFuente === 'gemini' ? ' · IA' : ' · manual') : ' · plantilla'}] ${txt}`);
}
fs.writeFileSync(path.join(dir, 'durs.txt'), durs.join('\n') + '\n');
fs.writeFileSync(path.join(dir, 'voz.txt'), lines.join('\n\n'));
console.log('Voz del carrusel: ' + durs.map(d => d.toFixed(1) + 's').join(' '));
