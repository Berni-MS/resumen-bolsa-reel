// Calculadora de la semana (historia). Rota entre varias calculadoras según la semana. Sin estado.
// Uso: node build-calculadora.mjs <salida.json> [AAAA-MM-DD]   (semana 0 = miércoles 2026-10-21)
import fs from 'node:fs';
import { nf } from './lib-datos.mjs';
const e0 = n => `${nf(n, 0)} €`;
const fv = (p, rate, years) => { const i = rate / 100 / 12, n = years * 12; return p * ((Math.pow(1 + i, n) - 1) / i); };
const pmt = (cap, rate, years) => { const i = rate / 100 / 12, n = years * 12; return (cap * i) / (1 - Math.pow(1 + i, -n)); };
const cap = (cuota, rate, years) => { const i = rate / 100 / 12, n = years * 12; return cuota * (1 - Math.pow(1 + i, -n)) / i; };
// Sueldo neto orientativo: soltero sin hijos, contrato indefinido, 12 pagas, tramos generales (estatal + autonómico medio)
const irpf = base => { const T = [[12450, .19], [20200, .24], [35200, .30], [60000, .37], [300000, .45], [Infinity, .47]]; let prev = 0, tax = 0; for (const [lim, r] of T) { if (base > prev) tax += (Math.min(base, lim) - prev) * r; prev = lim; } return tax; };
const neto = bruto => {
  const ss = bruto * 0.065;
  const w = bruto - ss; // rendimiento neto previo
  const red = w <= 14852 ? 7302 : w <= 17673.52 ? 7302 - 1.75 * (w - 14852) : w <= 19747.5 ? 2364.34 - 1.14 * (w - 17673.52) : 0;
  const base = Math.max(0, w - 2000 - Math.max(0, red));
  const cuota = Math.max(0, irpf(base) - irpf(5550));
  return { net: bruto - ss - cuota, ret: cuota / bruto * 100 };
};
const SUP = 'Cálculo orientativo con supuestos simples · No es asesoramiento financiero';

const CALCS = [
  () => ({ title: 'Ahorrar', accent: 'poco a poco', q: 'Si ahorras una cantidad fija cada mes durante 10 años, ¿cuánto juntas?',
    rows: [50, 100, 200].map(p => ({ a: `${p} € al mes`, b: e0(fv(p, 3, 10)), c: `Tú pones ${e0(p * 120)}; el resto es interés` })),
    note: 'Supuesto: 3 % anual constante. Es un ejemplo, no una promesa de rentabilidad.' }),
  () => ({ title: 'Gastos', accent: 'hormiga', bad: true, q: '¿Cuánto cuestan al año las pequeñas cosas de todos los días?',
    rows: [['Un café al día (1,50 €)', 1.5 * 365], ['Una suscripción olvidada (12,99 €/mes)', 12.99 * 12], ['Comida a domicilio (15 € a la semana)', 15 * 52]].map(([a, y]) => ({ a, b: `${e0(y)} al año`, c: `${e0(y * 10)} en 10 años` })),
    note: 'Importes de ejemplo; en 10 años, sin contar intereses.' }),
  () => ({ title: 'Tu fondo de', accent: 'emergencia', q: '¿Cuánto deberías tener guardado para imprevistos?',
    rows: [1000, 1500, 2000].map(g => ({ a: `Gastas ${e0(g)} al mes`, b: `${e0(g * 6)}`, c: `Meta ideal: 6 meses. Mínimo de 3 meses: ${e0(g * 3)}` })),
    note: 'Se calcula sobre tus gastos mensuales fijos, no sobre tu sueldo.' }),
  () => ({ title: 'La regla', accent: '50/30/20', q: 'Una forma sencilla de repartir tu nómina neta.',
    rows: [1200, 1600, 2000].map(n => ({ a: `Cobras ${e0(n)}`, b: `${e0(n * 0.2)} a ahorrar`, c: `${e0(n * 0.5)} necesidades · ${e0(n * 0.3)} gustos` })),
    note: 'Es una guía general: ajústala a tu situación.' }),
  () => ({ title: 'Lo que se come la', accent: 'inflación', bad: true, q: 'Si guardas 100 € bajo el colchón, ¿cuánto valdrán dentro de 10 años?',
    rows: [2, 3, 5].map(r => ({ a: `Con inflación del ${r} % anual`, b: `${nf(100 / Math.pow(1 + r / 100, 10), 0)} €`, c: 'de poder de compra dentro de 10 años' })),
    note: 'La inflación real varía cada año; son tres escenarios de ejemplo.' }),
  () => ({ title: 'Tu', accent: 'hipoteca', q: 'Cuota mensual de una hipoteca de 150.000 € a 25 años, según el tipo de interés.',
    rows: [2, 3.5, 5].map(r => { const c = pmt(150000, r, 25); return { a: `Al ${nf(r, r % 1 ? 1 : 0)} % anual`, b: `${e0(c)} al mes`, c: `${e0(c * 300 - 150000)} de intereses en total` }; }),
    note: 'Cuota fija sin vinculaciones ni gastos. Tu banco puede aplicar otras condiciones.' }),
  () => ({ title: 'La regla del', accent: '72', q: '¿Cuántos años tarda tu dinero en duplicarse?',
    rows: [2, 4, 8].map(r => ({ a: `Rentabilidad del ${r} % anual`, b: `${nf(72 / r, 0)} años`, c: `10.000 € se convertirían en 20.000 €` })),
    note: 'Es una aproximación (72 ÷ rentabilidad). Las rentabilidades no están garantizadas.' }),
  () => ({ title: 'Una deuda', accent: 'cara', bad: true, q: 'Debes 1.000 € al 20 % anual. ¿Qué pasa según lo que pagues al mes?',
    rows: [30, 50, 100].map(p => { const i = 0.2 / 12, n = Math.ceil(-Math.log(1 - (1000 * i) / p) / Math.log(1 + i)); return { a: `Pagas ${p} € al mes`, b: `${n} meses`, c: `${e0(p * n - 1000)} de intereses` }; }),
    note: 'Ejemplo con un interés del 20 % (típico de algunas tarjetas de crédito).' }),
  () => ({ title: 'Tu meta de', accent: 'ahorro', q: '¿Cuánto tienes que apartar cada mes para llegar a tu objetivo?',
    rows: [[1200, 1], [3000, 1], [6000, 1]].map(([m, y]) => ({ a: `${e0(m)} en ${y} año`, b: `${e0(m / 12)} al mes`, c: `O ${e0(m / 24)} al mes si te das 2 años` })),
    note: 'Sin contar intereses.' }),
  () => ({ title: 'Tu sueldo', accent: 'neto', q: 'Lo que llega a tu cuenta cada mes según tu sueldo bruto anual.',
    rows: [18000, 25000, 35000].map(b => { const r = neto(b); return { a: `Bruto de ${nf(b, 0)} € al año`, b: `≈ ${e0(r.net / 12)} al mes`, c: `12 pagas · retención aprox. ${nf(r.ret, 0)} %` }; }),
    note: 'Soltero sin hijos, contrato indefinido, 12 pagas. Tu nómina real puede variar según comunidad, familia y pagas.' }),
  () => ({ title: 'Lo que te', accent: 'prestan', q: '¿Qué hipoteca puedes pedir según tu sueldo neto mensual?',
    rows: [1500, 2000, 2500].map(n => ({ a: `Cobras ${e0(n)} netos al mes`, b: `Cuota máx. ≈ ${e0(n * 0.35)}`, c: `≈ ${e0(Math.round(cap(n * 0.35, 3.5, 25) / 1000) * 1000)} de préstamo (3,5 % · 25 años)` })),
    note: 'Regla orientativa: la cuota no debería pasar del 35 % de tu neto. Cada banco decide.' }),
];

const today = process.argv[3] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const [y, m, d] = today.split('-').map(Number);
const week = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 9, 21)) / (7 * 86400000));
const idx = ((week % CALCS.length) + CALCS.length) % CALCS.length;
const res = { kind: 'calc', date: today, n: idx, ...CALCS[idx](), footer: SUP };
fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 2));
console.log(`Calculadora ${idx} (${res.title} ${res.accent}) para ${today}`);
