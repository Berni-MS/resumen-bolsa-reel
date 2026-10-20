// Elige el carrusel que toca esta semana (sin estado: depende solo de la fecha).
// Uso: node select-carousel.mjs <edu|mitos|ahorro|vida> <item.json> [indice]
import fs from 'node:fs';
import { isExpired } from './tools/vigilante.mjs';

const kind = process.argv[2];
const dst = process.argv[3];
const forced = process.argv[4];
if (!['edu', 'mitos', 'ahorro', 'vida', 'vivienda', 'estafas', 'renta', 'bienvenida', 'tramites', 'ipc', 'euribor'].includes(kind)) throw new Error('kind debe ser edu, mitos, ahorro, vida, vivienda, estafas, renta, bienvenida o tramites');
const dir = `queue/${kind}`;
const base = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));
// Orden por interés (data/orden-carruseles.json): lo fijado se queda en su hueco y el resto sigue la prioridad
function ordenar(base, kind) {
  let cfg; try { cfg = JSON.parse(fs.readFileSync(new URL('./data/orden-carruseles.json', import.meta.url), 'utf8'))[kind]; } catch { cfg = null; }
  if (!cfg) return base;
  const short = it => String(it.id).replace(new RegExp(`^${kind}-`), '');
  const out = new Array(base.length).fill(null), used = new Set();
  for (const [id, pos] of Object.entries(cfg.posiciones || {})) { const it = base.find(x => short(x) === id); if (it && pos < out.length && !out[pos]) { out[pos] = it; used.add(it); } }
  const rest = [];
  for (const id of cfg.prioridad || []) { const it = base.find(x => short(x) === id); if (it && !used.has(it)) { rest.push(it); used.add(it); } }
  for (const it of base) if (!used.has(it)) rest.push(it);
  let k = 0; for (let i = 0; i < out.length; i++) if (!out[i]) out[i] = rest[k++];
  return out;
}
const queue = ordenar(base, kind);

// Semana 0 = lunes 19/10/2026; la fecha se toma en horario de Madrid
const START = Date.UTC(2026, 9, 19);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const [y, m, d] = today.split('-').map(Number);
const week = Math.floor((Date.UTC(y, m - 1, d) - START) / (7 * 86400000));
// ahorro y vida: el nº 1 de cada cola ya se publicó como prueba, así que arrancan en el 2 y el 1 cierra el ciclo
const OFFSET = { ahorro: 1, vida: 1 }[kind] || 0;
// renta: solo se publica durante la campaña (25 de marzo a 30 de junio); fuera de ella no se publica nada
let rentaWeek = 0;
if (kind === 'renta') {
  const inSeason = (m, d) => (m === 3 && d >= 25) || m === 4 || m === 5 || (m === 6 && d <= 30);
  const isForced = forced !== undefined && forced !== '';
  if (!isForced && !inSeason(m, d)) {
    console.log(`Hoy ${today}: fuera de la campaña de la Renta, no se publica nada.`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'skip=true\n');
    process.exit(0);
  }
  // Datos fiscales caducados (data/trust.json): no se publica hasta revisarlos
  if (!isForced && isExpired('renta', today)) {
    console.log('::warning::Carrusel de la Renta NO publicado: los datos fiscales están caducados. Revísalos y actualiza data/trust.json.');
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'skip=true\n');
    process.exit(0);
  }
  rentaWeek = Math.max(0, Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 2, 25)) / (7 * 86400000)));
}
const idx = forced !== undefined && forced !== '' ? Number(forced) : (((kind === 'renta' ? rentaWeek : week + OFFSET) % queue.length) + queue.length) % queue.length;
const item = queue[idx];
if (!item) throw new Error(`No hay carrusel con índice ${idx}`);
fs.writeFileSync(dst, JSON.stringify(item, null, 2));
console.log(`Hoy ${today} · semana ${week} · ${kind} #${idx + 1}/${queue.length}: ${item.id}`);
