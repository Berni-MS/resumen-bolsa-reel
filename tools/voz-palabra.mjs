// Guion hablado de la «Palabra del día». Uso: node tools/voz-palabra.mjs datos.json > voz.txt
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let v = {};
try { v = JSON.parse(fs.readFileSync(new URL('../data/palabras-voz.json', import.meta.url), 'utf8'))[d.term] || {}; } catch {}
const clean = s => String(s || '').replace(/\s+/g, ' ').replace(/€/g, ' euros').replace(/%/g, ' por ciento').trim();
const cuerpo = v.voz ? v.voz : `${clean(d.def)} ${clean(d.ex)}`;
console.log(`Palabra del día: ${v.say || d.term}. ${cuerpo} Mañana, otra palabra nueva en Tu Amigo de las Finanzas.`);
