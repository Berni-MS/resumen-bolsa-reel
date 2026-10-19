// Confianza: fuentes de referencia y fecha de revisión que se imprimen en la última diapositiva y en el pie.
// Los datos viven en data/trust.json (los vigila tools/vigilante.mjs).
import fs from 'node:fs';
const T = JSON.parse(fs.readFileSync(new URL('./data/trust.json', import.meta.url), 'utf8'));
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const REVIEWED = (() => { const [y, m] = T.reviewed.split('-').map(Number); return `${MESES[m - 1]} de ${y}`; })();
export const STATIC_KINDS = new Set(Object.keys(T.sources));
export const LEGAL_SHORT = 'Contenido educativo, no es asesoramiento financiero.';

// Lista de fuentes: las del propio carrusel si las tiene (datos, mitos, euros…), si no las de referencia de su serie.
export function sourcesFor(item, kind) {
  if (item.sources && item.sources.length) return item.sources;
  return T.sources[kind] || [];
}
// Texto de pie de la última diapositiva (corto: cabe en dos líneas pequeñas)
export function trustFoot(item, kind, onlyLegal = false) {
  if (onlyLegal) return LEGAL_SHORT;
  const src = sourcesFor(item, kind);
  let list = src.join(' · ');
  if (list.length > 96) list = list.slice(0, 93).replace(/[ ,·|]+\S*$/, '') + '…';
  const own = item.sources && item.sources.length;
  const head = own ? 'Fuentes' : 'Fuentes de referencia';
  const rev = STATIC_KINDS.has(kind) && !own ? ` · Revisado en ${REVIEWED}` : '';
  return `${src.length ? `${head}: ${list}${rev}\n` : ''}${LEGAL_SHORT}`;
}
// Línea para el pie de la publicación
export function trustCaption(item, kind) {
  const src = sourcesFor(item, kind);
  if (!src.length) return '';
  const own = item.sources && item.sources.length;
  const rev = STATIC_KINDS.has(kind) && !own ? ` Revisado en ${REVIEWED}.` : '';
  return `\n\n${own ? 'Fuentes' : 'Fuentes de referencia'}: ${src.join(' · ')}.${rev}`;
}
