// Convierte el registro de RESUMEN_BOLSA (Make) en data.json para render.mjs
// Uso: node prepare.mjs <record.json | -> <data.json>
import fs from 'node:fs';

const src = process.argv[2];
const dst = process.argv[3] || 'data.json';
const raw = src === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(src, 'utf8');
const r = JSON.parse(raw);

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const d = new Date(r.date + 'T12:00:00Z');
const fmt = o => new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', ...o }).format(d);
const dateLabel = cap(`${fmt({ weekday: 'long' })} ${fmt({ day: 'numeric' })} de ${fmt({ month: 'long' })} de ${fmt({ year: 'numeric' })}`);
const sessionLabel = `Sesión del ${fmt({ weekday: 'long' })} ${fmt({ day: 'numeric' })} de ${fmt({ month: 'long' })}`;

// Titular corto y determinista según los tres índices
const chg = [r.spy_chg, r.qqq_chg, r.dia_chg];
const down = chg.filter(x => x < 0).length, up = chg.filter(x => x > 0).length;
const avg = chg.reduce((a, b) => a + b, 0) / 3;
const names = [['S&P', r.spy_chg], ['Nasdaq', r.qqq_chg], ['Dow', r.dia_chg]];
const joinEs = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a.at(-1) : a[0];
let headline;
if (Math.max(...chg.map(Math.abs)) < 0.2) headline = 'Wall Street cierra sin rumbo';
else if (down === 3) headline = avg <= -1.5 ? 'Fuerte caída en Wall Street' : avg <= -0.75 ? 'Wall Street cierra con pérdidas' : 'Leves caídas en Wall Street';
else if (up === 3) headline = avg >= 1.5 ? 'Fuerte subida en Wall Street' : avg >= 0.75 ? 'Wall Street cierra con ganancias' : 'Leves subidas en Wall Street';
else {
  const u = names.filter(n => n[1] > 0).map(n => n[0]), dn = names.filter(n => n[1] < 0).map(n => n[0]);
  if (!u.length || !dn.length) headline = 'Wall Street cierra casi sin cambios';
  else headline = cap(`${joinEs(u)} ${u.length > 1 ? 'suben' : 'sube'}, ${joinEs(dn)} ${dn.length > 1 ? 'caen' : 'cae'}`);
}
const big = Math.abs(r.spy_chg) >= 1.5;

// Nombres cortos
const KEEP = new Set(['APA']);
function short(name, ticker) {
  let n = String(name).replace(/^The /, '');
  const stripped = n.replace(/\s+(Corporation|Company|Companies|Incorporated|Inc\.?|Corp\.?|Co\.?)$/i, '');
  if (stripped.length >= 4 && stripped !== ticker && !KEEP.has(ticker)) n = stripped;
  return n;
}
const list = a => (a || []).slice(0, 5).map(x => ({ ticker: x.ticker, name: short(x.company, x.ticker), chg: x.chg }));

// Factores: "dir|título|texto" por línea; si faltan, se sacan del resumen
let factors = [];
if (r.factors) {
  factors = String(r.factors).split(/\r?\n/).map(l => l.split('|')).filter(p => p.length >= 3)
    .map(p => ({ dir: p[0].trim().toLowerCase().startsWith('u') ? 'up' : 'down', title: p[1].trim(), text: p.slice(2).join('|').trim() })).slice(0, 4);
}
if (!factors.length) {
  const sentences = String(r.summary || '').split(/(?<=\.)\s+/).filter(Boolean).slice(1, 4);
  factors = sentences.map((s, i) => ({ dir: r.spy_chg >= 0 ? 'up' : 'down', title: ['Mercado', 'Contexto', 'Empresas'][i] || 'Contexto', text: s }));
}

const pctEs = x => (x < 0 ? '−' : '+') + Math.abs(x).toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' %';
const arrow = x => (x < 0 ? '🔻' : x > 0 ? '🟢' : '⚪');
const idxLines = [
  `${arrow(r.spy_chg)} S&P 500 (SPY): ${pctEs(r.spy_chg)}`,
  `${arrow(r.qqq_chg)} Nasdaq 100 (QQQ): ${pctEs(r.qqq_chg)}`,
  `${arrow(r.dia_chg)} Dow Jones (DIA): ${pctEs(r.dia_chg)}`,
];
const firstWord = n => String(n).split(/\s+/)[0].replace(/[,.]$/, '');
function topLine(label, rows, withName) {
  return `${label}: ` + rows.map(x => `${x.ticker}${withName && firstWord(x.name) !== x.ticker ? ' (' + firstWord(x.name) + ')' : ''} ${pctEs(x.chg)}`).join(' · ');
}
function buildCaption(withName) {
  const L = { SPY: 'S&P 500', QQQ: 'Nasdaq 100', DIA: 'Dow Jones' };
  const ups = ['SPY', 'QQQ', 'DIA'].map(k => topLine(L[k], list(k === 'SPY' ? r.sp500_gainers : k === 'QQQ' ? r.nasdaq100_gainers : r.dow30_gainers), withName));
  const dns = ['SPY', 'QQQ', 'DIA'].map(k => topLine(L[k], list(k === 'SPY' ? r.sp500_losers : k === 'QQQ' ? r.nasdaq100_losers : r.dow30_losers), withName));
  return [
    `${headline} 📊`,
    `${sessionLabel}. Variación de cada índice respecto al cierre de la sesión anterior.`,
    '',
    '🏛️ Así cerraron los índices',
    ...idxLines,
    '',
    '🚀 Las 5 acciones que más subieron',
    ...ups,
    '',
    '⚠️ Las 5 acciones que más cayeron',
    ...dns,
    '',
    '💬 Qué pasó',
    r.summary || '',
    '',
    '🎞️ En el Reel: la variación de los tres índices, el top 5 de subidas y bajadas en cada uno y los factores que movieron el mercado.',
    '',
    'ℹ️ Cotizaciones: Polygon.io. Contenido informativo, no es asesoramiento financiero.',
    '#bolsa #wallstreet #SP500 #nasdaq #dowjones #mercados #inversion #finanzas #tuamigodelasfinanzas',
  ].join('\n');
}
let caption = buildCaption(true);
if (caption.length > 2100) caption = buildCaption(false);

const data = {
  dateLabel, sessionLabel, headline,
  indices: [
    { ticker: 'SPY', name: 'S&P 500', close: r.spy_close, prev: r.spy_prev_close, chg: r.spy_chg },
    { ticker: 'QQQ', name: 'Nasdaq 100', close: r.qqq_close, prev: r.qqq_prev_close, chg: r.qqq_chg },
    { ticker: 'DIA', name: 'Dow Jones', close: r.dia_close, prev: r.dia_prev_close, chg: r.dia_chg },
  ],
  lists: {
    SPY: { gainers: list(r.sp500_gainers), losers: list(r.sp500_losers) },
    QQQ: { gainers: list(r.nasdaq100_gainers), losers: list(r.nasdaq100_losers) },
    DIA: { gainers: list(r.dow30_gainers), losers: list(r.dow30_losers) },
  },
  factors, caption,
};
fs.writeFileSync(dst, JSON.stringify(data, null, 2));
console.log('data.json listo:', headline, '|', dateLabel);
