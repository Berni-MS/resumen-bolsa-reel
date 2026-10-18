// Elige el carrusel que toca esta semana (sin estado: depende solo de la fecha).
// Uso: node select-carousel.mjs <edu|mitos|ahorro|vida> <item.json> [indice]
import fs from 'node:fs';

const kind = process.argv[2];
const dst = process.argv[3];
const forced = process.argv[4];
if (!['edu', 'mitos', 'ahorro', 'vida'].includes(kind)) throw new Error('kind debe ser edu, mitos, ahorro o vida');
const dir = `queue/${kind}`;
const queue = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));

// Semana 0 = lunes 19/10/2026; la fecha se toma en horario de Madrid
const START = Date.UTC(2026, 9, 19);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const [y, m, d] = today.split('-').map(Number);
const week = Math.floor((Date.UTC(y, m - 1, d) - START) / (7 * 86400000));
const idx = forced !== undefined && forced !== '' ? Number(forced) : ((week % queue.length) + queue.length) % queue.length;
const item = queue[idx];
if (!item) throw new Error(`No hay carrusel con índice ${idx}`);
fs.writeFileSync(dst, JSON.stringify(item, null, 2));
console.log(`Hoy ${today} · semana ${week} · ${kind} #${idx + 1}/${queue.length}: ${item.id}`);
