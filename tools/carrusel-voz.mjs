// Voz en off para el vídeo de un carrusel. Uso: node tools/carrusel-voz.mjs <item.json> <carpeta_voz>
// Escribe <carpeta_voz>/NN.mp3 y <carpeta_voz>/durs.txt (segundos por diapositiva, una por línea) y voz.txt (guion).
import fs from 'node:fs';
import path from 'node:path';
import { hablar, tts, vozActiva, VOZ_RATE } from '../voz-lib.mjs';
import { guionesGemini } from './voz-gemini.mjs';
import { pickKey } from '../cta.mjs';

const item = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const dir = path.resolve(process.argv[3]);
if (!vozActiva()) { console.log('Voz desactivada'); process.exit(0); }
fs.mkdirSync(dir, { recursive: true });
try { await guionesGemini(item); } catch (e) { console.warn('Gemini no disponible:', e.message); }

const p = s => { const h = String(s ?? '').replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' ').trim(); return h && !/[.!?:]$/.test(h) ? h + '.' : h; };
const ORD = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis'];
function strings(o) { return typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(strings) : o && typeof o === 'object' ? Object.values(o).flatMap(strings) : []; }

const ORDF = ['la primera', 'la segunda', 'la tercera', 'la cuarta', 'la quinta'];
const ORDM = ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto'];
const LEAD = { ojo: 'Ojo: ', cuidado: 'Ojo: ', 'un matiz': 'Ojo, un matiz: ', atención: 'Atención: ', 'un consejo': 'Un consejo: ', consejo: 'Un consejo: ', 'el truco': 'Y aquí está el truco: ', ejemplo: 'Veamos un ejemplo. ', 'lo básico': 'Lo primero, lo básico: ', primero: 'Lo primero: ', después: 'Después, ', 'la estafa': 'Así funciona la estafa. ' };
const ROT = ['Fíjate en esto: ', 'Otro punto importante: ', 'Y algo más: ', 'Sigamos: '];
let soft = 0;
const SOFT = ['', 'Y ', 'Además, ', '', 'Y también '];
const junta = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a.at(-1) : (a[0] || '');
const sinPunto = s => String(s || '').trim().replace(/[.\s]+$/, '');

function guion(sl, i, n, mythN) {
  if (sl.voz) return String(sl.voz).replace(/\s+/g, ' ').trim(); // guion de voz escrito a mano (o generado) para esta diapositiva
  const k = [];
  switch (sl.t) {
    case 'cover': {
      const big = String(sl.big || '').trim();
      const pref = /^\p{L}{3,}$/u.test(big) ? `${big}: ` : /^\d+$/.test(big) ? `${big} ` : '';
      k.push(p(`${pref}${sl.title || ''}`), p(sl.foot)); break;
    }
    case 'point': {
      const hd = sinPunto(sl.head).replace(/\[\[|\]\]/g, '');
      const con = SOFT[soft++ % SOFT.length];
      const h2 = con && /^\p{Lu}\p{Ll}/u.test(hd) ? hd.charAt(0).toLowerCase() + hd.slice(1) : hd;
      k.push(p(`${con}${h2}`), p(sl.body), p(sl.note)); break;
    }
    case 'cards': {
      const lista = (sl.cards || []).map(x => sinPunto(x.t).replace(/^./, ch => ch.toLowerCase()));
      k.push(p(`${sinPunto(sl.head)}: ${junta(lista)}`)); break;
    }
    case 'steps': {
      const lista = (sl.steps || []).map(x => sinPunto(x.t).replace(/^./, ch => ch.toLowerCase()));
      k.push(p(`${sinPunto(sl.head)}: ${junta(lista)}`)); break;
    }
    case 'stat': k.push(p(sl.head), p(sl.big), p(sl.body)); break;
    case 'myth': k.push(p(`${['Hay quien cree que', 'Otros piensan que', 'También se dice que', 'Y se oye mucho que'][(mythN - 1) % 4]} ${String(sl.myth).replace(/[«»"]/g, '').replace(/^./, ch => ch.toLowerCase())}`), p(`Pero ${String(sl.reality).replace(/^./, ch => ch.toLowerCase())}`)); break;
    case 'close': {
      const ex = /^fuentes?:/i.test(String(sl.extra || '').trim()) ? 'Las fuentes aparecen en la última imagen.' : sl.extra;
      k.push(p(sl.head), p(sl.body), p(ex), 'Y recuerda: contenido educativo, no es asesoramiento financiero.'); break;
    }
    default: k.push(...strings(sl).filter(s => s.length > 2 && !/^#/.test(s)).map(p));
  }
  return recorta(k.filter(Boolean).join(' ').replace(/\s+/g, ' '), sl.t === 'close' ? 34 : 28);
}
function recorta(txt, max) {
  if (txt.split(' ').length <= max) return txt;
  const fr = txt.split(/(?<=[.!?])\s+/); let out = '';
  for (const f of fr) { if ((out + ' ' + f).trim().split(' ').length > max && out) break; out = (out + ' ' + f).trim(); }
  return out;
}

const lines = [], durs = [];
let mythN = 0;
const slides = item.slides.slice(0, 7);
const textos = slides.map((sl, i) => { if (sl.t === 'myth') mythN++; return guion(sl, i, item.slides.length, mythN); });
// Llamada a comentar la palabra clave de la guía del tema (antes de la frase legal final)
{
  const key = pickKey(String(item.id || '').split('-')[0], item.id || '').toLowerCase();
  const cta = `Si quieres la guía gratis, comenta ${key}.`;
  const L = textos.length - 1, fr = textos[L].split(/(?<=[.!?])\s+/).filter(Boolean);
  const k = fr.findIndex(s => /asesoramiento/i.test(s));
  if (k >= 0) fr.splice(k, 0, cta); else fr.push(cta);
  textos[L] = fr.join(' ');
}
const MAXV = 54, durSlide = v => Math.max(4, v + 0.8);
const total = ds => ds.reduce((a, v) => a + durSlide(v), 0) - 0.5 * (ds.length - 1);
const rate = VOZ_RATE; // ritmo único: la voz no se acelera nunca; si no cabe, se recorta
const sintetizar = () => textos.map((t, i) => tts(hablar(t), path.join(dir, `${String(i + 1).padStart(2, '0')}.mp3`), rate));
let ds = sintetizar();
for (let intento = 0; total(ds) > MAXV && intento < 14; intento++) {
  { // después, se quita la última frase de la diapositiva más larga (sin tocar gancho ni cierre)
    const j = ds.map((v, i) => [v, i]).filter(([, i]) => i > 0 && i < ds.length - 1 && (textos[i].split(/(?<=[.!?])\s+/).length > 1)).sort((x, y) => y[0] - x[0])[0]?.[1];
    if (j === undefined) break;
    const fr = textos[j].split(/(?<=[.!?])\s+/);
    textos[j] = fr.slice(0, -1).join(' ');
  }
  ds = sintetizar();
}
console.log(`Duración estimada del vídeo: ${total(ds).toFixed(1)} s (tope ${MAXV} s, ritmo +${rate} %)`);
slides.forEach((sl, i) => { const nn = String(i + 1).padStart(2, '0'); durs.push(ds[i]); lines.push(`[${nn}${sl.voz ? (sl.vozFuente === 'gemini' ? ' · IA' : ' · manual') : ' · plantilla'}] ${textos[i]}`); });
fs.writeFileSync(path.join(dir, 'durs.txt'), durs.join('\n') + '\n');
fs.writeFileSync(path.join(dir, 'voz.json'), JSON.stringify({ textos, durs }));
fs.writeFileSync(path.join(dir, 'voz.txt'), lines.join('\n\n') + `\n\n(duración estimada: ${total(ds).toFixed(0)} s)`);
console.log('Voz del carrusel: ' + durs.map(d => d.toFixed(1) + 's').join(' '));
