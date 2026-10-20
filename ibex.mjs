// Datos del IBEX 35 para el reel del resumen: variación del índice y top 5 de subidas y bajadas de sus valores.
// Fuente: Yahoo Finance. Si falla o hay pocos datos, devuelve null y el reel usa el Nasdaq 100 como antes.
import fs from 'node:fs';
import { yahoo, sleep, madridDate } from './lib-datos.mjs';

const round2 = x => Math.round(x * 100) / 100;
function lastTwo(bars, sessionDate) {
  const ok = bars.filter(b => b.date <= sessionDate);
  if (ok.length < 2) return null;
  const a = ok.at(-1), b = ok.at(-2);
  return { date: a.date, close: a.close, prev: b.close, chg: round2((a.close / b.close - 1) * 100) };
}
// Cierre de la sesión: último precio cotizado (meta) frente al cierre anterior; si el dato es posterior a la sesión pedida, se usan las barras diarias
function session(res, sessionDate) {
  const day = madridDate(new Date(res.time));
  if (day <= sessionDate && Number.isFinite(res.price) && res.price > 0) {
    const prev = [...res.bars].reverse().find(b => b.date < day);
    if (prev) return { date: day, close: res.price, prev: prev.close, chg: round2((res.price / prev.close - 1) * 100) };
  }
  return lastTwo(res.bars, sessionDate);
}
export async function ibexData(sessionDate) {
  const cfg = JSON.parse(fs.readFileSync(new URL('./data/ibex.json', import.meta.url), 'utf8'));
  const idx = session(await yahoo(cfg.indice, '1mo'), sessionDate);
  if (!idx) throw new Error('IBEX: sin datos del índice');
  const rows = [], failed = [];
  for (const [sym, name] of cfg.valores) { // uno a uno y con pausa: Yahoo limita las peticiones en paralelo
    try {
      const q = session(await yahoo(sym, '1mo'), sessionDate);
      if (q && q.date === idx.date) rows.push({ ticker: sym.replace(/\.MC$/, ''), company: name, chg: q.chg, close: round2(q.close) });
      else failed.push(`${sym}(${q ? q.date : 'sin dato'})`);
    } catch (e) { failed.push(`${sym}(${String(e.message).slice(-30)})`); }
    await sleep(250);
  }
  if (failed.length) console.warn(`IBEX: ${failed.length} sin dato (índice ${idx.date}):`, failed.slice(0, 6).join(', '));
  if (rows.length < 25) throw new Error(`IBEX: solo ${rows.length} valores con dato`);
  const sorted = [...rows].sort((a, b) => b.chg - a.chg);
  return {
    date: idx.date, close: round2(idx.close), prev: round2(idx.prev), chg: idx.chg,
    gainers: sorted.slice(0, 5), losers: sorted.slice(-5).reverse(),
  };
}
