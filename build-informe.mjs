// Informe semanal de resultados. Uso: node build-informe.mjs <datos.json> <salida.html>
// datos.json: publicaciones de Instagram {tipo, producto, fecha, likes, comentarios, guardados?, compartidos?, alcance?, vistas?, texto, enlace}
// Con métricas, la puntuación pondera lo que más pesa en Instagram: compartidos y guardados.
import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const n = x => Number(x) || 0;
const posts = (Array.isArray(raw) ? raw : []).map(p => {
  const texto = String(p.texto || '');
  const m = texto.match(/Serie «([^»]+)»/);
  return {
    tipo: p.producto === 'REELS' || p.tipo === 'VIDEO' ? 'Reel' : p.tipo === 'CAROUSEL_ALBUM' ? 'Carrusel' : 'Imagen',
    serie: m ? m[1] : 'Sin serie',
    fecha: String(p.fecha || '').slice(0, 10), likes: n(p.likes), comentarios: n(p.comentarios),
    guardados: p.guardados == null ? null : n(p.guardados), compartidos: p.compartidos == null ? null : n(p.compartidos),
    alcance: p.alcance == null ? null : n(p.alcance),
    titulo: texto.split('\n')[0].slice(0, 90), enlace: String(p.enlace || ''),
  };
}).filter(p => p.fecha);
const hasIns = posts.some(p => p.alcance != null);
const score = p => hasIns ? p.likes + 3 * p.comentarios + 4 * (p.guardados || 0) + 5 * (p.compartidos || 0) : p.likes + 3 * p.comentarios;
const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const week = posts.filter(p => p.fecha >= since);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const avg = (a, f) => a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0;
const f1 = x => x.toFixed(1).replace('.', ',');
const group = key => [...new Set(posts.map(p => p[key]))].map(k => {
  const a = posts.filter(p => p[key] === k), w = week.filter(p => p[key] === k);
  return { k, n: a.length, score: avg(a, score), semana: w.length, alcance: avg(a.filter(p => p.alcance != null), p => p.alcance), guardados: avg(a.filter(p => p.guardados != null), p => p.guardados), compartidos: avg(a.filter(p => p.compartidos != null), p => p.compartidos), comentarios: avg(a, p => p.comentarios) };
}).sort((a, b) => b.score - a.score);
const tipos = group('tipo'), series = group('serie').filter(s => s.k !== 'Sin serie' || s.n >= 3);
const top = [...posts].sort((a, b) => score(b) - score(a)).slice(0, 5);
const low = [...posts].sort((a, b) => score(a) - score(b)).slice(0, 3);
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const cols = hasIns ? ['Likes', 'Coment.', 'Guard.', 'Comp.', 'Alcance'] : ['Likes', 'Coment.'];
const cells = p => (hasIns ? [p.likes, p.comentarios, p.guardados ?? '–', p.compartidos ?? '–', p.alcance ?? '–'] : [p.likes, p.comentarios]).map(v => `<td>${v}</td>`).join('');
const row = p => `<tr><td>${esc(p.fecha)}</td><td>${p.tipo}</td>${cells(p)}<td>${p.enlace ? `<a href="${esc(p.enlace)}">${esc(p.titulo)}</a>` : esc(p.titulo)}</td></tr>`;
const grpHead = hasIns ? '<th>Publ.</th><th>Puntuación</th><th>Alcance medio</th><th>Guard. medios</th><th>Comp. medios</th>' : '<th>Publ.</th><th>Puntuación media</th>';
const grpRow = g => `<tr><td>${esc(g.k)}</td><td>${g.n}</td><td>${f1(g.score)}</td>${hasIns ? `<td>${Math.round(g.alcance)}</td><td>${f1(g.guardados)}</td><td>${f1(g.compartidos)}</td>` : ''}</tr>`;
// Recomendaciones automáticas
const rec = [];
const reales = series.filter(x => x.k !== 'Sin serie');
if (reales.length >= 2) {
  const s0 = reales[0], sl = reales[reales.length - 1];
  rec.push(`Mejor serie: <b>${esc(s0.k)}</b> (${f1(s0.score)} puntos de media). Plantéate publicarla más o repetir su tipo de gancho.`);
  if (sl.k !== s0.k && sl.n >= 2) rec.push(`Serie con menos respuesta: <b>${esc(sl.k)}</b> (${f1(sl.score)}). Prueba otro título de portada o otra hora antes de descartarla.`);
}
if (tipos.length >= 2) rec.push(`Formato que mejor funciona: <b>${tipos[0].k}</b>. ${tipos[0].k === 'Reel' ? 'Los reels alcanzan a gente nueva: mantén el gancho de los primeros segundos.' : 'Si quieres crecer en alcance, combina con más reels.'}`);
if (hasIns) {
  const sh = posts.filter(p => p.compartidos != null);
  const bestShare = [...sh].sort((a, b) => b.compartidos - a.compartidos)[0];
  if (bestShare && bestShare.compartidos > 0) rec.push(`Lo más compartido: «${esc(bestShare.titulo)}» (${bestShare.compartidos}). Los compartidos traen seguidores nuevos; busca ese tipo de tema.`);
}
if (!rec.length) rec.push('Todavía hay pocas publicaciones para sacar conclusiones. Repite el formato y el tema de las mejores.');
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe semanal · ${hoy}</title>
<style>body{margin:0;background:#0F1B33;color:#DCE5F5;font:16px/1.5 system-ui,sans-serif}main{max-width:900px;margin:0 auto;padding:28px 18px 60px}h1,h2{color:#fff;margin:0 0 8px}h2{margin-top:30px;font-size:20px}
table{width:100%;border-collapse:collapse;font-size:15px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid rgba(159,176,204,.25);vertical-align:top}th{color:#35D07F}a{color:#35D07F}.s{color:#9FB0CC;font-size:14px}li{margin:6px 0}</style></head><body><main>
<h1>Informe semanal · ${hoy}</h1><p class="s">@tuamigodelasfinanzas · ${posts.length} publicaciones recientes, ${week.length} de los últimos 7 días. ${hasIns ? 'Puntuación = likes + 3 × comentarios + 4 × guardados + 5 × compartidos.' : 'Puntuación = likes + 3 × comentarios (no se han podido leer guardados y compartidos).'}</p>
<h2>Qué hacer esta semana</h2><ul>${rec.map(r => `<li>${r}</li>`).join('')}</ul>
<h2>Por serie</h2><table><tr><th>Serie</th>${grpHead}</tr>${series.map(grpRow).join('')}</table>
<h2>Por formato</h2><table><tr><th>Formato</th>${grpHead}</tr>${tipos.map(grpRow).join('')}</table>
<h2>Las 5 mejores</h2><table><tr><th>Fecha</th><th>Formato</th>${cols.map(c => `<th>${c}</th>`).join('')}<th>Publicación</th></tr>${top.map(row).join('')}</table>
<h2>Las 3 con menos respuesta</h2><table><tr><th>Fecha</th><th>Formato</th>${cols.map(c => `<th>${c}</th>`).join('')}<th>Publicación</th></tr>${low.map(row).join('')}</table>
</main></body></html>`;
fs.writeFileSync(process.argv[3], html);
console.log(`Informe: ${posts.length} publicaciones${hasIns ? ' con métricas' : ''}; mejor formato: ${tipos[0]?.k ?? '—'}`);
