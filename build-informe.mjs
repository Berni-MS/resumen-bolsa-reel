// Informe semanal de resultados. Uso: node build-informe.mjs <datos.json> <salida.html>
// datos.json: lista de publicaciones de Instagram {id, tipo, producto, fecha, likes, comentarios, texto, enlace}
import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const posts = (Array.isArray(raw) ? raw : []).map(p => ({
  tipo: p.producto === 'REELS' ? 'Reel' : p.tipo === 'CAROUSEL_ALBUM' ? 'Carrusel' : p.tipo === 'VIDEO' ? 'Reel' : 'Imagen',
  fecha: String(p.fecha || '').slice(0, 10), likes: Number(p.likes) || 0, comentarios: Number(p.comentarios) || 0,
  texto: String(p.texto || '').split('\n')[0].slice(0, 90), enlace: String(p.enlace || ''),
})).filter(p => p.fecha);
const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const score = p => p.likes + 3 * p.comentarios;
const week = posts.filter(p => p.fecha >= since);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const avg = a => a.length ? (a.reduce((s, x) => s + score(x), 0) / a.length) : 0;
const tipos = [...new Set(posts.map(p => p.tipo))].map(t => {
  const a = posts.filter(p => p.tipo === t), w = week.filter(p => p.tipo === t);
  return { t, n: a.length, media: avg(a), semana: w.length, mediaSemana: avg(w) };
}).sort((a, b) => b.media - a.media);
const top = [...posts].sort((a, b) => score(b) - score(a)).slice(0, 5);
const low = [...posts].sort((a, b) => score(a) - score(b)).slice(0, 3);
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const row = p => `<tr><td>${esc(p.fecha)}</td><td>${p.tipo}</td><td>${p.likes}</td><td>${p.comentarios}</td><td>${p.enlace ? `<a href="${esc(p.enlace)}">${esc(p.texto)}</a>` : esc(p.texto)}</td></tr>`;
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe semanal · ${hoy}</title>
<style>body{margin:0;background:#0F1B33;color:#DCE5F5;font:16px/1.5 system-ui,sans-serif}main{max-width:820px;margin:0 auto;padding:28px 18px 60px}h1,h2{color:#fff;margin:0 0 8px}h2{margin-top:30px;font-size:20px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid rgba(159,176,204,.25);vertical-align:top}th{color:#35D07F}a{color:#35D07F}.s{color:#9FB0CC;font-size:14px}</style></head><body><main>
<h1>Informe semanal · ${hoy}</h1><p class="s">@tuamigodelasfinanzas · ${posts.length} publicaciones recientes, ${week.length} de los últimos 7 días. Puntuación = me gusta + 3 × comentarios (guardados y compartidos no están disponibles en este informe).</p>
<h2>Qué formato funciona mejor</h2><table><tr><th>Formato</th><th>Publicaciones</th><th>Puntuación media</th><th>Esta semana</th></tr>
${tipos.map(x => `<tr><td>${x.t}</td><td>${x.n}</td><td>${x.media.toFixed(1)}</td><td>${x.semana} · ${x.mediaSemana.toFixed(1)}</td></tr>`).join('')}</table>
<h2>Las 5 mejores</h2><table><tr><th>Fecha</th><th>Formato</th><th>Likes</th><th>Coment.</th><th>Texto</th></tr>${top.map(row).join('')}</table>
<h2>Las 3 con menos respuesta</h2><table><tr><th>Fecha</th><th>Formato</th><th>Likes</th><th>Coment.</th><th>Texto</th></tr>${low.map(row).join('')}</table>
<h2>Qué hacer con esto</h2><p>Repite el formato y el tema de las mejores; si un formato queda muy por debajo durante varias semanas, revisa su gancho o su horario.</p>
</main></body></html>`;
fs.writeFileSync(process.argv[3], html);
console.log(`Informe: ${posts.length} publicaciones, mejor formato: ${tipos[0]?.t ?? '—'}`);
