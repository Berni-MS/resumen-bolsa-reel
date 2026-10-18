// Pregunta de la semana para la historia del domingo. Sin estado: depende de la fecha.
// Uso: node build-pregunta.mjs <salida.json> [AAAA-MM-DD]
import fs from 'node:fs';
const qs = JSON.parse(fs.readFileSync('data/preguntas.json', 'utf8'));
const today = process.argv[3] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const [y, m, d] = today.split('-').map(Number);
const week = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 9, 18)) / (7 * 86400000));
const q = qs[((week % qs.length) + qs.length) % qs.length];
fs.writeFileSync(process.argv[2], JSON.stringify({ pregunta: q, date: today }, null, 2));
console.log(`Pregunta ${today}: ${q}`);
