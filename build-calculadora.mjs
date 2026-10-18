// Calculadora de la semana (historia). Rota entre varias calculadoras según la semana. Sin estado.
// Uso: node build-calculadora.mjs <salida.json> [AAAA-MM-DD]   (semana 0 = miércoles 2026-10-21)
import fs from 'node:fs';
import { nf } from './lib-datos.mjs';
const e0 = n => `${nf(n, 0)} €`;
const fv = (p, rate, years) => { const i = rate / 100 / 12, n = years * 12; return p * ((Math.pow(1 + i, n) - 1) / i); };
const pmt = (cap, rate, years) => { const i = rate / 100 / 12, n = years * 12; return (cap * i) / (1 - Math.pow(1 + i, -n)); };
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
];

const today = process.argv[3] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const [y, m, d] = today.split('-').map(Number);
const week = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 9, 21)) / (7 * 86400000));
const idx = ((week % CALCS.length) + CALCS.length) % CALCS.length;
const res = { kind: 'calc', date: today, n: idx, ...CALCS[idx](), footer: SUP };
fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 2));
console.log(`Calculadora ${idx} (${res.title} ${res.accent}) para ${today}`);
