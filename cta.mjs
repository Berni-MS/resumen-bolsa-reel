// Cierre de los pies de publicación: invitación a compartir, palabra clave para recibir una guía gratis y palabras de búsqueda.
// Las guías están en https://tuamigodelasfinanzas.github.io/resumen-bolsa-reel/guias/ y el escenario de Make «COMENTARIOS palabra clave» responde a estas palabras.
const GUIAS = {
  AHORRO: { guia: 'la plantilla de presupuesto mensual', seo: 'ahorro · presupuesto · finanzas personales en España' },
  RENTA: { guia: 'el checklist de la declaración de la renta', seo: 'declaración de la renta · Hacienda · finanzas personales en España' },
  BOLSA: { guia: 'el glosario de bolsa en 30 términos', seo: 'bolsa · inversión · aprender a invertir en España' },
  VIVIENDA: { guia: 'el checklist para comprar o alquilar con cabeza', seo: 'hipoteca · alquiler · comprar casa · finanzas personales en España' },
  ESTAFAS: { guia: 'la guía antiestafas', seo: 'estafas · ciberseguridad · Bizum · finanzas personales en España' },
  TRAMITES: { guia: 'la guía de trámites y ayudas', seo: 'trámites · ayudas · Seguridad Social · Hacienda · finanzas personales en España' },
  GASTOS: { guia: 'la lista para revisar tus gastos fijos y comisiones', seo: 'gastos fijos · comisiones · TAE · finanzas personales en España' },
};
export function pickKey(kind, id = '') {
  if (kind === 'bienvenida') return 'AHORRO';
  if (kind === 'vivienda') return 'VIVIENDA';
  if (kind === 'estafas') return 'ESTAFAS';
  if (kind === 'tramites') return 'TRAMITES';
  if (/renta|irpf|hacienda|declaraci/i.test(id)) return 'RENTA';
  if (kind === 'ahorro' || kind === 'consejo') return 'AHORRO';
  if (kind === 'vida' || kind === 'semana') return 'GASTOS';
  return 'BOLSA';
}
export function ctaBlock(caption, kind, id = '') {
  const key = pickKey(kind, id), g = GUIAS[key];
  const share = /env[ií]aselo|m[áa]ndaselo|comp[áa]rtelo/i.test(caption) ? '' : '📲 Mándaselo a alguien a quien le venga bien.\n';
  // Respuesta automática a comentarios activa (tools/ig-comments.mjs). Con COMMENT_KEYWORD=0 se remite al enlace del perfil
  const gancho = process.env.COMMENT_KEYWORD !== '0' ? `🎁 Comenta ${key} y te paso gratis ${g.guia}.` : `🎁 Gratis en el enlace de mi perfil: ${g.guia}.`;
  return `${share}${gancho}\n🔎 ${g.seo}`;
}
