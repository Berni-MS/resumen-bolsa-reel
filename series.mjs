// Series con nombre propio: cada formato recurrente tiene un nombre, un día y un hashtag fijos.
export const SERIES = {
  edu: { name: 'El ABC de la bolsa', day: 'lunes', tag: '#ElABCdelaBolsa' },
  ahorro: { name: 'Ahorra sin sufrir', day: 'martes', tag: '#AhorraSinSufrir' },
  euros: { name: '¿Y si hubieras invertido?', day: 'miércoles', tag: '#YSiHubierasInvertido' },
  mitos: { name: 'Mito o dato', day: 'jueves', tag: '#MitoODato' },
  vida: { name: 'Finanzas de la vida real', day: 'viernes', tag: '#FinanzasDeLaVidaReal' },
  semana: { name: 'La semana en datos', day: 'domingo', tag: '#LaSemanaEnDatos' },
  vivienda: { name: 'Tu casa, tus cuentas', day: 'sábado', tag: '#TuCasaTusCuentas' },
  estafas: { name: 'Alerta estafa', day: 'miércoles', tag: '#AlertaEstafa' },
  renta: { name: 'Renta sin miedo', day: 'jueves', tag: '#RentaSinMiedo' },
  calendario: { name: 'Tu semana en bolsa', day: 'domingo', tag: '#TuSemanaEnBolsa' },
};
// Número de episodio: el del archivo de la cola (p. ej. mitos-012-…) o, si no lo hay, la semana desde el 19/10/2026.
export function episode(kind, id = '', today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())) {
  const m = String(id).match(/^[a-z]+-(\d{2,3})-/);
  if (m) return Number(m[1]);
  const [y, mo, d] = today.split('-').map(Number);
  return Math.max(1, Math.floor((Date.UTC(y, mo - 1, d) - Date.UTC(2026, 9, 19)) / (7 * 86400000)) + 1);
}
