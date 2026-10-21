// Cierre estándar de todos los vídeos: "Guárdalo · Compártelo · Sígueme" (tarjeta final de marca).
// Contenido dentro de la zona segura de Instagram (entre y≈440 y y≈1540).
export const CIERRE_VOZ = 'Guárdalo y compártelo con quien lo necesite. Sígueme para más.';
export function endcardInner({ INK = '#0F1B33', GREEN = '#35D07F', MUTED = '#9FB0CC', DISPLAY = "'Big Shoulders Display','Arial Narrow','Liberation Sans Narrow',sans-serif", sub = 'Un consejo útil cada día, sin humo.' } = {}) {
  return `<div style="position:absolute;left:90px;right:150px;top:470px;height:1050px;display:flex;flex-direction:column;justify-content:center">
    <div style="font-size:42px;font-weight:700;color:${MUTED};margin-bottom:26px">¿Te ha servido?</div>
    <div style="font-family:${DISPLAY};font-weight:900;font-size:170px;line-height:.88;color:${GREEN}">Guárdalo</div>
    <div style="font-family:${DISPLAY};font-weight:900;font-size:170px;line-height:.88;color:#fff;margin-top:6px">Compártelo</div>
    <div style="margin-top:56px;font-size:54px;font-weight:700;color:#fff;line-height:1.15">Mándaselo a quien lo necesite</div>
    <div style="margin-top:44px;display:inline-block;align-self:flex-start;background:${GREEN};color:${INK};font-size:44px;font-weight:700;padding:16px 28px;white-space:nowrap">Sígueme · @tuamigodelasfinanzas</div>
    <div style="margin-top:34px;font-size:34px;font-weight:500;color:${MUTED}">${sub}</div>
  </div>`;
}
