// Utilidades de datos para las historias diarias (luz, «Tu dinero hoy») y el carrusel semanal.
// Fuentes: Red Eléctrica (REData, PVPC), BCE (euro-dólar), Yahoo Finance (índices, oro, Brent), CoinGecko (bitcoin).
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; tuamigodelasfinanzas)' };
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function getText(url, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) { err = e; await sleep(1500 * (i + 1)); }
  }
  throw new Error(`${url.split('?')[0]}: ${err.message}`);
}
export const getJson = async (url, tries) => JSON.parse(await getText(url, tries));

export const madridDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
export const madridTime = (d = new Date()) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(d);
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const dow = iso => new Date(iso + 'T12:00:00Z').getUTCDay(); // 0 = domingo
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const dayName = iso => cap(new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', weekday: 'long' }).format(new Date(iso + 'T12:00:00Z')));
export const dayLong = iso => `${dayName(iso)} ${Number(iso.slice(8))} de ${new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', month: 'long' }).format(new Date(iso + 'T12:00:00Z'))}`;
export const nf = (n, d = 2) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' }).format(n);
export const pct = (x, d = 1) => `${x >= 0 ? '+' : '−'}${nf(Math.abs(x), d)} %`;
export const change = (last, prev) => (prev ? (last / prev - 1) * 100 : null);

// ---------- Luz (PVPC, €/MWh → €/kWh) ----------
export async function pvpc(startISO, endISO) {
  const j = await getJson(`https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date=${startISO}T00:00&end_date=${endISO}T23:59&time_trunc=hour`);
  const s = (j.included || []).find(x => x.type === 'PVPC');
  if (!s) throw new Error('REData no devuelve PVPC');
  return s.attributes.values.map(v => ({ date: v.datetime.slice(0, 10), hour: v.datetime.slice(11, 13), p: v.value / 1000 }));
}
export const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
export function cheapestWindow(day, len = 3) {
  let best = null;
  for (let i = 0; i + len <= day.length; i++) {
    const m = mean(day.slice(i, i + len).map(x => x.p));
    if (!best || m < best.m) best = { m, i };
  }
  const from = Number(day[best.i].hour), to = (Number(day[best.i + len - 1].hour) + 1) % 24;
  return { from: `${String(from).padStart(2, '0')}:00`, to: `${String(to).padStart(2, '0')}:00`, avg: best.m };
}
export const hh = h => `${h}:00`;

// ---------- Mercados ----------
export async function yahoo(symbol, range = '1mo') {
  const j = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`);
  const r = j.chart.result[0], q = r.indicators.quote[0].close, ts = r.timestamp;
  const bars = ts.map((t, i) => ({ date: madridDate(new Date(t * 1000)), close: q[i] })).filter(b => b.close != null && b.close > 0);
  if (bars.length < 2) throw new Error(`${symbol}: pocos datos`);
  return { bars, time: r.meta.regularMarketTime * 1000, price: r.meta.regularMarketPrice };
}
function csvLine(l) { const out = []; let cur = '', q = false; for (const c of l) { if (c === '"') q = !q; else if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; }
export async function ecbUsd(startISO) {
  const t = await getText(`https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?startPeriod=${startISO}&format=csvdata`);
  const [h, ...rows] = t.trim().split('\n'); const H = csvLine(h), iT = H.indexOf('TIME_PERIOD'), iV = H.indexOf('OBS_VALUE');
  const bars = rows.map(csvLine).map(c => ({ date: c[iT], close: Number(c[iV]) })).filter(b => b.close > 0);
  if (bars.length < 2) throw new Error('BCE: pocos datos');
  return bars;
}
export async function bitcoin(days = 8) {
  const j = await getJson(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=eur&days=${days}&interval=daily`);
  const p = j.prices.map(x => x[1]).filter(Boolean);
  if (p.length < 2) throw new Error('CoinGecko: pocos datos');
  return p;
}
export const lastAtOrBefore = (bars, iso) => [...bars].reverse().find(b => b.date <= iso);
export const lastBefore = (bars, iso) => [...bars].reverse().find(b => b.date < iso);
