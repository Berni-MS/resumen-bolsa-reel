// Datos de las historias diarias. Uso: node build-datos.mjs <luz|dinero> <salida.json> [AAAA-MM-DD]
// luz: precio PVPC de mañana, hora a hora. dinero: seis cifras del día. Si falta algún dato esencial, termina con error y NO se publica.
import fs from 'node:fs';
import { pvpc, cheapestWindow, mean, nf, pct, change, madridDate, madridTime, addDays, dayLong, yahoo, ecbUsd, bitcoin, sleep } from './lib-datos.mjs';

const [kind, out, dateArg] = process.argv.slice(2);
const today = dateArg || madridDate();

async function luz() {
  const target = addDays(today, 1);
  let tomorrow = [], now = [];
  // Red Eléctrica publica los precios del día siguiente sobre las 20:15; se espera hasta ~35 min
  for (let i = 0; i < 18; i++) {
    try {
      const all = await pvpc(today, target);
      tomorrow = all.filter(x => x.date === target); now = all.filter(x => x.date === today);
    } catch (e) { console.warn('REData:', e.message); }
    if (tomorrow.length >= 23) break;
    console.log(`Precios de ${target} aún no publicados (intento ${i + 1})`);
    await sleep(120000);
  }
  if (tomorrow.length < 23) throw new Error(`No hay precios PVPC de ${target}`);
  const ps = tomorrow.map(x => x.p), avg = mean(ps), avgToday = now.length >= 23 ? mean(now.map(x => x.p)) : null;
  const sorted = [...ps].sort((a, b) => a - b), k = Math.floor(ps.length / 3);
  const lo = sorted[k - 1], hi = sorted[ps.length - k];
  const max = tomorrow.reduce((m, x) => (x.p > m.p ? x : m)), min = tomorrow.reduce((m, x) => (x.p < m.p ? x : m));
  const res = {
    kind: 'luz', date: today, target, label: dayLong(target),
    bars: tomorrow.map(x => ({ h: x.hour, p: x.p, c: x.p <= lo ? 'low' : x.p >= hi ? 'high' : 'mid' })),
    avg, avgToday, delta: avgToday ? change(avg, avgToday) : null,
    cheap: cheapestWindow(tomorrow, 3), max: { h: `${max.hour}:00`, p: max.p }, min: { h: `${min.hour}:00`, p: min.p },
  };
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  console.log(`Luz ${target}: media ${nf(avg, 3)} €/kWh, barata ${res.cheap.from}-${res.cheap.to}, cara ${res.max.h}`);
}

async function dinero() {
  const rows = [], errors = [];
  const fresh = t => Date.now() - t < 45 * 60000;
  const add = async (name, fn) => { try { rows.push(await fn()); } catch (e) { errors.push(`${name}: ${e.message}`); } };
  const yh = (name, sym, fmt, unit) => add(name, async () => {
    const y = await yahoo(sym, '5d'), last = y.bars.at(-1), prev = y.bars.at(-2);
    const ch = change(last.close, prev.close);
    return { name, value: fmt(last.close), unit, ch, note: last.date === today && fresh(y.time) ? 'ahora' : last.date === today ? 'cierre de hoy' : `cierre del ${last.date.slice(8)}/${last.date.slice(5, 7)}` };
  });
  await Promise.all([
    yh('IBEX 35', '^IBEX', v => nf(v, 0), 'puntos'),
    yh('S&P 500', '^GSPC', v => nf(v, 0), 'puntos'),
    yh('Oro', 'GC=F', v => nf(v, 0), '$ por onza'),
    yh('Brent', 'BZ=F', v => nf(v, 2), '$ por barril'),
    add('Euro/dólar', async () => {
      const b = await ecbUsd(addDays(today, -10)), last = b.at(-1), prev = b.at(-2);
      return { name: 'Euro/dólar', value: nf(last.close, 4), unit: '$ por 1 €', ch: change(last.close, prev.close), note: `BCE, ${last.date.slice(8)}/${last.date.slice(5, 7)}` };
    }),
    add('Bitcoin', async () => {
      const p = await bitcoin(3), last = p.at(-1), prev = p.at(-2);
      return { name: 'Bitcoin', value: nf(last, 0), unit: '€', ch: change(last, prev), note: 'ahora · 24 h' };
    }),
  ]);
  const order = ['IBEX 35', 'S&P 500', 'Euro/dólar', 'Oro', 'Brent', 'Bitcoin'];
  rows.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  errors.forEach(e => console.warn('Sin dato →', e));
  if (rows.length < 4) throw new Error('Faltan datos: solo ' + rows.length + ' de 6');
  const res = { kind: 'dinero', date: today, label: dayLong(today), time: madridTime(), rows };
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  console.log('Dinero hoy:', rows.map(r => `${r.name} ${r.value} ${pct(r.ch)}`).join(' | '));
}

if (kind === 'luz') await luz();
else if (kind === 'dinero') await dinero();
else throw new Error('kind debe ser luz o dinero');
