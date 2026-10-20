// Aviso diario por Telegram con los vídeos del día listos para subir a TikTok.
// Uso: node tools/telegram-tiktok.mjs <carpeta-gh-pages> [AAAA-MM-DD]   (env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DRY=true, FORCE=true)
// Envía los reels del día (resumen de bolsa, En 30 segundos, consejo) y la Palabra del día, cada uno con su texto de TikTok.
// No reenvía lo ya enviado (estado/tiktok-enviados.json). Si no hay vídeos nuevos, no envía nada.
import fs from 'node:fs';
import path from 'node:path';

const site = process.argv[2];
const today = process.argv[3] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const TOKEN = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_CHAT_ID;
const DRY = process.env.DRY === 'true', FORCE = process.env.FORCE === 'true';
const BASE = process.env.PAGES_BASE || 'https://tuamigodelasfinanzas.github.io/resumen-bolsa-reel';
const MAX = 49 * 1024 * 1024; // límite de Telegram para bots: 50 MB

const sentFile = path.join(site, 'estado', 'tiktok-enviados.json');
let sent = []; try { sent = JSON.parse(fs.readFileSync(sentFile, 'utf8')); } catch {}

// Vídeos de hoy
const found = [];
const ONLY = process.env.ONLY || '';
// Carruseles con vídeo para TikTok: solo los de más valor (o todos si se pide con ALL_CARRUSELES=true)
const TK_OK = /^tk-\d{4}-\d\d-\d\d-(mitos|estafas|vivienda|semana|edu|tramites|ahorro|vida)/;
for (const [dir, test, kind] of [['tiktok-carruseles', n => n.endsWith('.mp4') && new RegExp(`^tk-${today}-`).test(n) && (process.env.ALL_CARRUSELES === 'true' || TK_OK.test(n)), 'carrusel'], ['reels', n => n.endsWith('.mp4') && new RegExp(`(^|-)${today}-`).test(n), 'reel'], ['historias', n => /^palabra-/.test(n) && n.endsWith('.mp4') && n.includes(`-${today}-`), 'palabra']]) {
  const d = path.join(site, dir);
  if (!fs.existsSync(d)) continue;
  for (const n of fs.readdirSync(d).filter(test).sort()) found.push({ dir, name: n, kind, file: path.join(d, n) });
}
// El reel del resumen de bolsa lleva la fecha de la sesión (la del día anterior): se toma el más reciente de los últimos 4 días
{
  const addD = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const d = path.join(site, 'reels');
  const res = fs.existsSync(d) ? fs.readdirSync(d).filter(n => /^\d{4}-\d\d-\d\d-\d+\.mp4$/.test(n) && n.slice(0, 10) >= addD(today, -4) && n.slice(0, 10) <= today).sort() : [];
  const last = res.at(-1);
  if (last && !found.some(v => v.name === last)) found.push({ dir: 'reels', name: last, kind: 'reel', file: path.join(d, last) });
}
const todo = found.filter(v => (FORCE || !sent.includes(v.name)) && (!ONLY || v.name.includes(ONLY)));
console.log(`Vídeos de hoy: ${found.length}; por enviar: ${todo.length}`);
if (!todo.length) process.exit(0);

// Texto para TikTok: sin enlaces ni llamadas a guías, corto y con 3 hashtags
function tiktokText(file) {
  const txt = file.replace(/\.mp4$/, '.txt');
  if (!fs.existsSync(txt)) return 'Te lo cuento en un minuto 👇\n\n#finanzaspersonales #tuamigodelasfinanzas';
  const raw = fs.readFileSync(txt, 'utf8');
  const tags = [...new Set(raw.match(/#[\p{L}\p{N}_]+/gu) || [])].filter(t => !/^#tuamigodelasfinanzas$/i.test(t));
  const body = raw.split('\n').filter(l => l.trim() && !/^(🎁|📲|🔎|🎞|ℹ|📌|Fuentes?:|Contenido informativo|#)/.test(l.trim()) && !/^#/.test(l.trim())).join(' ').replace(/\s+/g, ' ').trim();
  let t = body.length > 260 ? body.slice(0, 260).replace(/[\s,;:]+\S*$/, '') + '…' : body;
  return `${t}\n\n${[...tags.slice(0, 3), '#tuamigodelasfinanzas'].join(' ')}`;
}

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', body });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description || r.status}`);
  return j;
}
const form = o => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

if (DRY || !TOKEN || !CHAT) {
  if (!DRY) console.log('::warning::Faltan los secretos TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID: no se envía nada.');
  for (const v of todo) console.log(`--- ${v.name} (${(fs.statSync(v.file).size / 1e6).toFixed(1)} MB)\n${tiktokText(v.file)}`);
  process.exit(DRY ? 0 : 1);
}

await tg('sendMessage', form({ chat_id: CHAT, text: `🎬 Vídeos para TikTok de hoy (${todo.length}). Descárgalos y prográmalos en TikTok Studio. Cada uno lleva su texto en el pie: cópialo.` }));
for (const v of todo) {
  const caption = tiktokText(v.file).slice(0, 1000);
  const size = fs.statSync(v.file).size;
  if (size > MAX) {
    await tg('sendMessage', form({ chat_id: CHAT, text: `${v.name} pesa demasiado para Telegram. Descárgalo aquí: ${BASE}/${v.dir}/${v.name}\n\n${caption}` }));
  } else {
    const f = form({ chat_id: CHAT, caption, supports_streaming: 'true' });
    f.append('video', new Blob([fs.readFileSync(v.file)], { type: 'video/mp4' }), v.name);
    await tg('sendVideo', f);
  }
  sent.push(v.name);
  console.log('Enviado:', v.name);
}
fs.mkdirSync(path.dirname(sentFile), { recursive: true });
fs.writeFileSync(sentFile, JSON.stringify([...new Set(sent)].slice(-200), null, 1));
