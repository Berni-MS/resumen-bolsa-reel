// Responde en público a los comentarios que piden una guía con su palabra clave (AHORRO, RENTA, BOLSA, GASTOS, VIVIENDA, ESTAFAS).
// Uso: IG_TOKEN=… IG_USER=… [DRY=true] node tools/ig-comments.mjs
// Sin estado: un comentario ya contestado por la cuenta no se vuelve a contestar.
const token = String(process.env.IG_TOKEN || '').replace(/[\s"']/g, ''), user = process.env.IG_USER, DRY = process.env.DRY === 'true';
if (!token || !user) throw new Error('Faltan IG_TOKEN o IG_USER');
const API = token.startsWith('IG') ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
const BASE = 'https://berni-ms.github.io/resumen-bolsa-reel/guias';
const GUIAS = {
  ahorro: ['la plantilla de presupuesto mensual', 'ahorro'],
  renta: ['el checklist de la declaración de la renta', 'renta'],
  bolsa: ['el glosario de bolsa en 30 términos', 'bolsa'],
  gastos: ['la lista para revisar tus gastos fijos y comisiones', 'gastos'],
  vivienda: ['el checklist para comprar o alquilar con cabeza', 'vivienda'],
  estafas: ['la guía antiestafas', 'estafas'],
};
const PLANTILLAS = [
  '¡Hola @{u}! 👋 Aquí tienes {guia}: {url} Es gratis y sin registro. ¡Ojalá te sirva!',
  '¡Claro, @{u}! 😊 Te dejo {guia}: {url} Si te surge alguna duda, cuéntamela por mensaje.',
  '@{u} ¡Hecho! 🙌 Aquí va {guia}: {url} Guárdala para tenerla a mano.',
  '¡Gracias por pedirla, @{u}! 💚 {guia}: {url} Y si conoces a alguien a quien le venga bien, mándasela.',
  'Aquí la tienes, @{u} 👇 {guia}: {url} Gratis, sin trucos y sin registro.',
  '¡Buena elección, @{u}! 🎯 {guia}: {url} Cualquier duda, me la dices.',
  '¡Va para ti, @{u}! ✨ {guia}: {url} Me alegra que te interese.',
  '@{u} ¡Un placer ayudarte! 🤝 Te dejo {guia}: {url} Y si te gusta, cuéntame qué tal.',
  '¡Hola, @{u}! Te paso {guia}: {url} Contenido educativo, no es asesoramiento financiero. 😉',
  'Toma, @{u} 🎁 {guia}: {url} Entender tu dinero es más fácil con una buena guía.',
  '¡Enseguida, @{u}! ⚡ {guia}: {url} ¡Que te sea útil!',
  '@{u} ¡Aquí estoy! 😄 {guia}: {url} Si prefieres otra guía, comenta su palabra clave.',
];
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
// Solo cuenta si el comentario es corto (pide la guía), para no contestar a opiniones largas que mencionan "bolsa" o "ahorro".
export function detect(text) {
  const t = norm(text), words = t.split(' ').filter(Boolean);
  if (!words.length || words.length > 6) return [];
  return Object.keys(GUIAS).filter(k => words.includes(k));
}
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export function reply(username, keys, seed, avoid = -1) {
  let i = hash(seed) % PLANTILLAS.length; if (i === avoid) i = (i + 1) % PLANTILLAS.length;
  const guia = keys.map(k => GUIAS[k][0]).join(' y ');
  const url = keys.map(k => `${BASE}/${GUIAS[k][1]}.html`).join(' · ');
  return { i, text: PLANTILLAS[i].replaceAll('{u}', username).replaceAll('{guia}', guia).replaceAll('{url}', url) };
}
if (process.argv[1] && process.argv[1].endsWith('ig-comments.mjs')) {
  const call = async (path, params = {}, method = 'GET') => {
    const u = new URL(`${API}/${path}`); const body = new URLSearchParams({ ...params, access_token: token });
    const r = method === 'GET' ? await fetch(`${u}?${body}`) : await fetch(u, { method, body });
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`); return j;
  };
  const me = (await call('me', { fields: 'username,user_id' })).username;
  const media = (await call(`${user}/media`, { fields: 'id,permalink', limit: 20 })).data || [];
  const limite = Date.now() - 72 * 3600 * 1000;
  let hechos = 0, last = -1;
  for (const m of media) {
    let cs = []; try { cs = (await call(`${m.id}/comments`, { fields: 'id,text,username,timestamp,replies{username}', limit: 50 })).data || []; } catch (e) { console.log(`Sin acceso a comentarios de ${m.id}: ${e.message}`); continue; }
    for (const c of cs) {
      if (!c.username || c.username === me) continue;
      if (Date.parse(c.timestamp) < limite) continue;
      if ((c.replies?.data || []).some(r => r.username === me)) continue;
      const keys = detect(c.text); if (!keys.length) continue;
      if (hechos >= 10) { console.log('Límite de 10 respuestas por pasada; el resto, en la siguiente.'); break; }
      const r = reply(c.username, keys, c.id, last); last = r.i;
      if (DRY) { console.log(`[PRUEBA] ${c.username}: «${c.text}» → ${r.text}`); hechos++; continue; }
      try { await call(`${c.id}/replies`, { message: r.text }, 'POST'); console.log(`Respondido a ${c.username} (${keys.join(',')})`); hechos++; await new Promise(res => setTimeout(res, 20000)); }
      catch (e) { console.log(`::warning::No se pudo responder a ${c.username}: ${e.message}`); }
    }
  }
  console.log(`Revisadas ${media.length} publicaciones; respuestas${DRY ? ' (prueba)' : ''}: ${hechos}`);
}
