// Lee con Business Discovery (API oficial) las últimas publicaciones de cuentas profesionales del nicho.
// Uso: IG_TOKEN=… IG_USER=… node tools/nicho.mjs data/nicho.json salida.json
import fs from 'node:fs';
const token = String(process.env.IG_TOKEN || '').replace(/[\s"']/g, ''), user = process.env.IG_USER;
if (!token || !user) throw new Error('Faltan IG_TOKEN o IG_USER');
const API = token.startsWith('IG') ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = { generado: new Date().toISOString(), cuentas: [], no_disponibles: [] };
for (const h of cfg.cuentas) {
  const f = `business_discovery.username(${h}){username,name,followers_count,media_count,media.limit(8){caption,like_count,comments_count,timestamp,permalink,media_type}}`;
  const u = new URL(`${API}/${user}`); u.searchParams.set('fields', f); u.searchParams.set('access_token', token);
  const r = await fetch(u); const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { out.no_disponibles.push({ cuenta: h, motivo: (j.error?.message || `HTTP ${r.status}`).slice(0, 120) }); continue; }
  const b = j.business_discovery;
  out.cuentas.push({ cuenta: b.username, nombre: b.name, seguidores: b.followers_count, publicaciones: b.media_count, ultimas: (b.media?.data || []).map(m => ({ fecha: m.timestamp, tipo: m.media_type, likes: m.like_count, comentarios: m.comments_count, enlace: m.permalink, texto: (m.caption || '').slice(0, 400) })) });
}
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 2));
console.log(`Disponibles: ${out.cuentas.length} · no disponibles: ${out.no_disponibles.length}`);
