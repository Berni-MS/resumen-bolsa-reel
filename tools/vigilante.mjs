// Vigilante de datos que caducan. Lee data/trust.json y avisa de lo que está caducado o a punto de caducar.
// Uso: node tools/vigilante.mjs [--check-only <id>]
// Salida: imprime un informe en Markdown; con GITHUB_OUTPUT escribe alert=true|false y la ruta del informe (vigilante.md).
//   --check-only <id>: sale con código 3 si ese dato está caducado (lo usa select-carousel.mjs vía isExpired()).
import fs from 'node:fs';

const T = JSON.parse(fs.readFileSync(new URL('../data/trust.json', import.meta.url), 'utf8'));
const DAY = 86400000;
const todayMadrid = () => process.env.VIGILANTE_TODAY || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const toMs = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d || 1); };
const daysLeft = (iso, today = todayMadrid()) => Math.round((toMs(iso) - toMs(today)) / DAY);

export function isExpired(id, today = todayMadrid()) {
  const w = T.watch.find(x => x.id === id);
  return !!w && daysLeft(w.validUntil, today) < 0;
}

if ((process.argv[1] || '').endsWith('vigilante.mjs')) {
  const today = todayMadrid();
  const rows = [];
  for (const w of T.watch) {
    const left = daysLeft(w.validUntil, today);
    if (left < 0) rows.push({ lvl: 'caducado', left, w });
    else if (left <= T.warnDays) rows.push({ lvl: 'pronto', left, w });
  }
  // Revisión general del contenido estático
  const revAge = -daysLeft(T.reviewed + '-01', today);
  const revDue = revAge >= T.reviewEveryDays;
  const lines = [];
  lines.push(`Informe del vigilante de datos · ${today}`, '');
  if (!rows.length && !revDue) lines.push('Todo en regla: ningún dato caducado ni a punto de caducar.');
  if (revDue) lines.push(`- **Revisión general pendiente**: el contenido de las colas se revisó por última vez en ${T.reviewed} (hace ${revAge} días; se revisa cada ${T.reviewEveryDays}). Repasa las colas y actualiza \`reviewed\` en data/trust.json.`);
  for (const r of rows.sort((a, b) => a.left - b.left)) {
    const when = r.left < 0 ? `caducó hace ${-r.left} días` : `caduca en ${r.left} días (${r.w.validUntil})`;
    const block = r.lvl === 'caducado' && r.w.blocks.length ? ` **Mientras tanto no se publican carruseles de: ${r.w.blocks.join(', ')}.**` : '';
    lines.push(`- ${r.lvl === 'caducado' ? '🔴' : '🟠'} **${r.w.name}** — ${when}. Dónde: ${r.w.where}.${block}`);
  }
  const alert = rows.length > 0 || revDue;
  if (alert) lines.push('', 'Cómo cerrarlo: comprueba el dato en la fuente oficial, corrígelo si ha cambiado y actualiza `validUntil` (o `reviewed`) en `data/trust.json`.');
  const md = lines.join('\n');
  console.log(md);
  fs.writeFileSync('vigilante.md', md + '\n');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `alert=${alert}\n`);
  if (process.argv[2] === '--check-only') process.exit(isExpired(process.argv[3], today) ? 3 : 0);
}
