// Carrusel «1.000 € hace N años»: calcula con datos reales (Yahoo Finance, precios ajustados mensuales,
// con dividendos reinvertidos y cambio dólar-euro) y escribe el JSON del carrusel.
// Uso: node build-euros.mjs <item.json> [indice]      |   node build-euros.mjs --check
import fs from 'node:fs';

const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };
const STAKE = 1000;

// Rotación semanal: activo + años atrás
const LIST = [
  ['AAPL', 'Apple', 10], ['SPY', 'el S&P 500', 10], ['KO', 'Coca-Cola', 10], ['NVDA', 'Nvidia', 10],
  ['MSFT', 'Microsoft', 10], ['SPY', 'el S&P 500', 20], ['AMZN', 'Amazon', 10], ['QQQ', 'el Nasdaq 100', 10],
  ['MCD', "McDonald's", 10], ['AAPL', 'Apple', 20], ['JNJ', 'Johnson & Johnson', 10], ['KO', 'Coca-Cola', 20],
  ['DIS', 'Disney', 10], ['NVDA', 'Nvidia', 5], ['ITX.MC', 'Inditex', 10], ['BRK-B', 'Berkshire Hathaway', 10],
  ['SPY', 'el S&P 500', 5], ['MSFT', 'Microsoft', 20], ['PG', 'Procter & Gamble', 10], ['QQQ', 'el Nasdaq 100', 20],
  ['AMZN', 'Amazon', 5], ['NKE', 'Nike', 10], ['PEP', 'PepsiCo', 10], ['AAPL', 'Apple', 5],
  ['SPY', 'el S&P 500', 15], ['KO', 'Coca-Cola', 5],
];

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ym = ts => { const d = new Date(ts * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const label = k => `${MONTHS[k % 12]} de ${Math.floor(k / 12)}`;
const eur = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';
const dec = (n, d = 1) => n.toFixed(d).replace('.', ',');

async function series(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=max&interval=1mo&events=div%2Csplit`;
  let lastErr;
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const res = j.chart.result[0];
      const ts = res.timestamp, adj = res.indicators.adjclose?.[0]?.adjclose || res.indicators.quote[0].close;
      const map = new Map();
      ts.forEach((t0, i) => { if (adj[i] != null) map.set(ym(t0), adj[i]); });
      return { currency: res.meta.currency, map, last: res.meta.regularMarketTime, lastKey: ym(res.meta.regularMarketTime) };
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 2000 * (t + 1))); }
  }
  throw new Error(`No se pudo leer ${sym}: ${lastErr.message}`);
}

// valor en euros de 1.000 € invertidos a final del mes `start`, mes a mes hasta `end`
function path(a, fx, start, end) {
  const out = [];
  const a0 = a.map.get(start); if (a0 == null) throw new Error('sin precio inicial');
  const f0 = fx ? fx.map.get(start) : 1; if (f0 == null) throw new Error('sin cambio inicial');
  for (let k = start; k <= end; k++) {
    const av = a.map.get(k), fv = fx ? fx.map.get(k) : 1;
    if (av == null || fv == null) continue;
    out.push([k, STAKE * (av / a0) * (f0 / fv)]);
  }
  return out;
}

async function compute(entry) {
  const [sym, name, years] = entry;
  const a = await series(sym);
  let fx = null;
  if (a.currency === 'USD') fx = await series('EURUSD=X'); else if (a.currency !== 'EUR') throw new Error(`divisa no soportada: ${a.currency}`);
  const end = a.lastKey, start = end - years * 12;
  const p = path(a, fx, start, end);
  if (p.length < years * 12 * 0.9 || p[0][0] !== start) throw new Error('histórico insuficiente');
  if (p.at(-1)[0] !== end) throw new Error('sin dato actual');
  const final = p.at(-1)[1];
  // peor caída pico-valle
  let peak = p[0], worst = { dd: 0 };
  for (const pt of p) {
    if (pt[1] > peak[1]) peak = pt;
    const dd = pt[1] / peak[1] - 1;
    if (dd < worst.dd) worst = { dd, from: peak, to: pt };
  }
  let bench = null;
  if (sym !== 'SPY') {
    try {
      const s = await series('SPY'), f = await series('EURUSD=X');
      const bp = path(s, f, start, end); if (bp[0][0] === start && bp.at(-1)[0] === end) bench = bp.at(-1)[1];
    } catch { bench = null; }
  }
  return { sym, name, years, start, end, final, worst, bench, asOf: new Date(a.last * 1000) };
}

function build(r) {
  const up = r.final >= STAKE;
  const col = up ? 'green' : 'red';
  const ratio = r.final / STAKE;
  const cagr = (Math.pow(ratio, 1 / r.years) - 1) * 100;
  const sign = n => (n >= 0 ? '+' : '−') + dec(Math.abs(n), 1);
  const total = ratio >= 2 ? `×${dec(ratio, 1)}` : `${sign((ratio - 1) * 100)} %`;
  const asOf = `${r.asOf.getUTCDate()} de ${MONTHS[r.asOf.getUTCMonth()]} de ${r.asOf.getUTCFullYear()}`;
  const foot = 'Fuente: Yahoo Finance; cálculo propio';
  const what = r.name;
  const dd = Math.abs(r.worst.dd) * 100;
  const caption = `💶 ${eur(STAKE)} en ${what} hace ${r.years} años… hoy serían ${eur(r.final)}.\n\nDesliza para ver la rentabilidad, la peor caída del camino y qué no cuenta este cálculo. Los datos son reales: precios ajustados con dividendos reinvertidos y en euros (con el cambio incluido), sin impuestos ni comisiones.\n\n💾 Guárdalo y envíaselo a alguien que dude de invertir.`;

  const slides = [
    { t: 'cover', big: eur(STAKE), title: `en ${what} hace ${r.years} años`, foot: '¿Cuánto valen hoy?', bigSize: 230 },
    { t: 'stat', big: eur(r.final), head: `Hoy valdrían`, body: `Si los hubieras invertido a finales de ${label(r.start)} en ${what}. Datos a ${asOf}.`, kicker: `${r.years} años después`, color: col, foot, bigSize: 230 },
    { t: 'stat', big: total, head: `${up ? '+' : '−'}${dec(Math.abs(cagr), 1)} % de media al año`, body: 'Con dividendos reinvertidos y con el cambio entre dólar y euro incluido.', kicker: 'Rentabilidad total', color: col, foot },
    { t: 'stat', big: `−${dec(dd, 0)} %`, head: 'La peor caída del camino', body: dd < 1 ? 'En cierres mensuales apenas hubo caídas.' : `Entre ${label(r.worst.from[0])} y ${label(r.worst.to[0])}, tus ${eur(STAKE)} habrían pasado de ${eur(r.worst.from[1])} a ${eur(r.worst.to[1])}. Según cierres mensuales.`, kicker: 'El camino no fue recto', color: 'red', foot },
    r.bench != null
      ? { t: 'point', head: 'Frente al [[S&P 500]]', body: `En ese mismo periodo, ${eur(STAKE)} en el S&P 500 (a través del ETF SPY) habrían llegado a ${eur(r.bench)}.`, kicker: 'Para comparar', foot }
      : { t: 'point', head: 'Y bajo el [[colchón]]', body: `${eur(STAKE)} guardados sin invertir seguirían siendo ${eur(STAKE)}, pero con menos poder de compra que hace ${r.years} años.`, kicker: 'Para comparar', foot: 'La inflación reduce lo que compra el dinero' },
    { t: 'cards', head: 'Lo que este cálculo [[no cuenta]]', accent: 'red', cards: [
      { t: 'Impuestos y comisiones', b: 'Reducirían el resultado final.' },
      { t: 'Inflación', b: 'Los euros de hoy compran menos que los de entonces.' },
      { t: 'Sesgo del superviviente', b: 'Elegimos una empresa que conocemos hoy; otras ya no existen.' } ], foot: 'Mirar atrás tiene trampas' },
    { t: 'close', head: 'El pasado [[no garantiza]] el futuro', body: 'Mirar atrás ayuda a entender el riesgo y el tiempo, no a predecir lo que viene.', extra: 'Guárdalo y envíaselo a alguien.', extraBold: true, foot: 'Contenido informativo. No es asesoramiento financiero. La rentabilidad pasada no garantiza resultados futuros.' },
  ];
  const tag = r.sym.replace(/[^A-Za-z]/g, '');
  return {
    id: `euros-${r.sym.replace(/[^A-Za-z]/g, '')}-${r.years}a-${r.asOf.toISOString().slice(0, 10)}`,
    label: `${eur(STAKE)} hace ${r.years} años`, accent: up ? 'green' : 'red', caption,
    tags: ['#inversion', '#bolsa', '#interescompuesto', '#aprenderbolsa', tag.length > 1 ? `#${tag}` : '#acciones'],
    sources: ['Yahoo Finance (precios ajustados mensuales)', 'cálculo propio'], slides,
  };
}

const arg = process.argv[2];
if (arg === '--check') {
  let bad = 0;
  for (let i = 0; i < LIST.length; i++) {
    try { const r = await compute(LIST[i]); console.log(`OK ${i} ${LIST[i].join(' ')} -> ${eur(r.final)} (peor caída ${dec(r.worst.dd * 100, 0)} %, S&P ${r.bench ? eur(r.bench) : '-'})`); }
    catch (e) { bad++; console.log(`FALLA ${i} ${LIST[i].join(' ')}: ${e.message}`); }
  }
  process.exit(bad ? 1 : 0);
}

const dst = arg;
const forced = process.argv[3];
const START = Date.UTC(2026, 9, 19);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const [y, m, d] = today.split('-').map(Number);
const week = Math.floor((Date.UTC(y, m - 1, d) - START) / (7 * 86400000));
const first = forced !== undefined && forced !== '' ? Number(forced) : ((week % LIST.length) + LIST.length) % LIST.length;
let item, lastErr;
for (let k = 0; k < LIST.length && !item; k++) {
  const i = (first + k) % LIST.length;
  try { item = build(await compute(LIST[i])); console.log(`Semana ${week}: #${i} ${LIST[i].join(' ')} -> ${item.slides[1].big}`); }
  catch (e) { lastErr = e; console.warn(`AVISO: #${i} ${LIST[i][0]} falló: ${e.message}`); }
}
if (!item) throw lastErr;
fs.writeFileSync(dst, JSON.stringify(item, null, 2));
