// Limpia el guion que devuelve Gemini (puede traer ```json ... ```) y lo valida.
// Uso: node prepare-30s.mjs <raw> <item.json> [AAAA-MM-DD]
import fs from 'node:fs';
const raw = fs.readFileSync(process.argv[2], 'utf8');
const i = raw.indexOf('{'), j = raw.lastIndexOf('}');
if (i < 0 || j < i) throw new Error('La respuesta no contiene JSON');
const it = JSON.parse(raw.slice(i, j + 1));

const fail = m => { throw new Error('Guion no válido: ' + m); };
const str = (v, max, name) => { if (typeof v !== 'string' || !v.trim()) fail(`falta ${name}`); if (v.replace(/\[\[|\]\]/g, '').length > max) fail(`${name} demasiado largo (${v.length} > ${max})`); return v.trim(); };

it.hook = str(it.hook, 70, 'hook');
if (it.hook_big && String(it.hook_big).length <= 8) it.hook_big = String(it.hook_big); else delete it.hook_big;
if (!Array.isArray(it.scenes) || it.scenes.length !== 4) fail('debe haber 4 escenas');
it.scenes = it.scenes.map((s, n) => ({
  kicker: str(s.kicker, 24, `kicker ${n + 1}`),
  text: str(s.text, 130, `text ${n + 1}`),
  ...(s.big && String(s.big).length <= 9 ? { big: String(s.big) } : {}),
}));
if (it.badge) it.badge = str(it.badge, 20, 'badge').toUpperCase();
it.caption = str(it.caption, 900, 'caption');
it.source = str(it.source, 90, 'source');
if (!['up', 'down', 'neutral'].includes(it.mood)) it.mood = 'neutral';
it.tags = (Array.isArray(it.tags) ? it.tags : []).map(t => '#' + String(t).replace(/[^\p{L}\p{N}_]/gu, '')).filter(t => t.length > 1).slice(0, 3);

const date = process.argv[4] || it.date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
it.date = date;
const d = new Date(date + 'T12:00:00Z');
const f = o => new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', ...o }).format(d);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
it.date_label = cap(`${f({ weekday: 'long' })} ${f({ day: 'numeric' })} de ${f({ month: 'long' })}`);
fs.writeFileSync(process.argv[3], JSON.stringify(it, null, 2));
console.log('Guion OK:', it.hook);
