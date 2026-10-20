// Datos del IBEX 35 para el reel del resumen: variación del índice y top 5 de subidas y bajadas de sus valores.
// Fuente: Yahoo Finance. Si falla o hay pocos datos, devuelve null y el reel usa el Nasdaq 100 como antes.
import fs from 'node:fs';
import { yahoo, sleep, madridDate, getText } from './lib-datos.mjs';

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
// Fuente alternativa (Stooq, CSV diario): cierre del último día ≤ sesión frente al anterior
async function stooq(sym, sessionDate) {
  const s = sym === '^IBEX' ? '^ibex' : sym.replace(/\.MC$/, '').toLowerCase() + '.es';
  const csv = await getText(`https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`);
  const bars = csv.trim().split('\n').slice(1).map(l => l.split(',')).map(c => ({ date: c[0], close: Number(c[4]) })).filter(b => /^\d{4}-\d\d-\d\d$/.test(b.date) && b.close > 0);
  return lastTwo(bars, sessionDate);
}
async function quote(sym, sessionDate, want) {
  const notes = [];
  try { const q = session(await yahoo(sym, '5d'), sessionDate); if (q && (!want || q.date === want)) return { ...q, src: 'yahoo' }; notes.push('yahoo ' + (q ? q.date : 'sin dato')); }
  catch (e) { notes.push('yahoo ' + String(e.message).slice(-25)); }
  try { const q = await stooq(sym, sessionDate); if (q && (!want || q.date === want)) return { ...q, src: 'stooq' }; notes.push('stooq ' + (q ? q.date : 'sin dato')); }
  catch (e) { notes.push('stooq ' + String(e.message).slice(-25)); }
  return { notes: notes.join(' / ') };
}
export async function ibexData(sessionDate) {
  const cfg = JSON.parse(fs.readFileSync(new URL('./data/ibex.json', import.meta.url), 'utf8'));
  const idx = await quote(cfg.indice, sessionDate);
  if (!idx.date) throw new Error('IBEX: sin datos del índice: ' + idx.notes);
  const srcs = {};
  const rows = [], failed = [];
  for (const [sym, name] of cfg.valores) { // uno a uno y con pausa: Yahoo limita las peticiones en paralelo
    const q = await quote(sym, sessionDate, idx.date);
    if (q.date) { rows.push({ ticker: sym.replace(/\.MC$/, ''), company: name, chg: q.chg, close: round2(q.close) }); srcs[q.src] = (srcs[q.src] || 0) + 1; }
    else failed.push(`${sym}[${q.notes}]`);
    await sleep(250);
  }
  console.log(`IBEX: índice ${idx.date} (${idx.src}); valores por fuente:`, JSON.stringify(srcs));
  if (failed.length) console.warn(`IBEX: ${failed.length} sin dato (índice ${idx.date}):`, failed.slice(0, 6).join(', '));
  if (rows.length < 25) throw new Error(`IBEX: solo ${rows.length} valores con dato`);
  const sorted = [...rows].sort((a, b) => b.chg - a.chg);
  return {
    date: idx.date, close: round2(idx.close), prev: round2(idx.prev), chg: idx.chg,
    gainers: sorted.slice(0, 5), losers: sorted.slice(-5).reverse(),
  };
}
