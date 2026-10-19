// Descarga las últimas publicaciones de Instagram con sus métricas (alcance, guardados, compartidos…).
// Uso: IG_TOKEN=… IG_USER=… node tools/ig-metrics.mjs salida.json
import fs from 'node:fs';
const token = process.env.IG_TOKEN, user = process.env.IG_USER;
if (!token || !user) throw new Error('Faltan IG_TOKEN o IG_USER');
const API = token.startsWith('IG') ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
const get = async (path, params = {}) => {
  const u = new URL(`${API}/${path}`); Object.entries({ ...params, access_token: token }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u); const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
  return j;
};
const media = (await get(`${user}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink', limit: 60 })).data || [];
const SETS = ['reach,saved,shares,total_interactions,views', 'reach,saved,shares,total_interactions', 'reach,saved,shares', 'reach,saved'];
const out = []; let metricErr = '';
for (const m of media) {
  const row = { id: m.id, tipo: m.media_type, producto: m.media_product_type, fecha: m.timestamp, likes: m.like_count || 0, comentarios: m.comments_count || 0, texto: m.caption || '', enlace: m.permalink };
  for (const set of SETS) {
    try {
      const ins = (await get(`${m.id}/insights`, { metric: set })).data || [];
      for (const x of ins) row[x.name === 'saved' ? 'guardados' : x.name === 'shares' ? 'compartidos' : x.name === 'reach' ? 'alcance' : x.name === 'views' ? 'vistas' : x.name] = x.values?.[0]?.value ?? 0;
      break;
    } catch (e) { metricErr = e.message; }
  }
  out.push(row);
}
const withIns = out.filter(r => r.alcance != null).length;
console.log(`Publicaciones: ${out.length}; con métricas: ${withIns}${withIns < out.length ? ` (último error: ${metricErr})` : ''}`);
fs.writeFileSync(process.argv[2], JSON.stringify(out));
