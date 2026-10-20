// Coteja la tabla STOCKS_RELEVANTES (volcada desde Make) con las listas de Wikipedia de S&P 500, Nasdaq-100 y Dow 30.
import fs from 'node:fs';
const [,, dumpFile, outFile] = process.argv;
const table = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
const clean = s => s.replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#160;|&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/\s+/g, ' ').trim();
const norm = t => t.trim().toUpperCase().replace(/-/g, '.');
async function page(title) {
  const r = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2`, { headers: { 'User-Agent': 'revision-stocks/1.0 (tuamigodelasfinanzas)' } });
  const j = await r.json(); if (!j.parse) throw new Error('Wikipedia: ' + title);
  const html = j.parse.text;
  const tables = html.match(/<table[\s\S]*?<\/table>/g) || [];
  const m = [tables.find(t => /id="constituents"/.test(t)) ?? tables.filter(t => /<th[^>]*>\s*(<[^>]+>\s*)*(Ticker|Symbol)/i.test(t)).sort((a, b) => b.length - a.length)[0]];
  if (!m[0]) throw new Error('Sin tabla de componentes en ' + title + ' · tablas: ' + tables.length + ' · cabeceras: ' + tables.map(t => clean((t.match(/<tr[\s\S]*?<\/tr>/) || [''])[0]).slice(0, 60)).join(' | ').slice(0, 600));
  const out = new Map();
  for (const tr of m[0].match(/<tr[\s\S]*?<\/tr>/g) || []) {
    const cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []).map(clean);
    const ti = cells.findIndex(c => /^[A-Z]{1,5}([.\-][A-Z])?$/.test(c) && !/^(NYSE|NASDAQ|CBOE)$/.test(c));
    if (ti < 0) continue;
    const name = cells.find((c, i) => i !== ti && c && !/^(NYSE|NASDAQ|CBOE|NYSE ARCA)$/i.test(c));
    out.set(norm(cells[ti]), name);
  }
  return out;
}
const sp = await page('List of S&P 500 companies'), nq = await page('Nasdaq-100').catch(async e1 => page('Nasdaq-100 companies').catch(e2 => { throw new Error(e1.message + ' || ' + e2.message); }));
console.log(`Wikipedia: S&P ${sp.size}, Nasdaq-100 ${nq.size}`);
const STOP = new Set('inc corp corporation company co ltd plc the group holdings holding class a b c and of de sa nv ag se cos limited international'.split(' '));
const toks = s => (s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
const similar = (a, b) => { const A = toks(a), B = toks(b); return A.some(x => B.some(y => x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y.slice(0, 4)) || y.startsWith(x.slice(0, 4)))))); };
const L = [];
const flag = v => v === true || v === 'true';
const bad = [], notInIdx = [], seen = new Set();
for (const r of table) {
  const t = norm(r.ticker || ''); seen.add(t);
  const w = sp.get(t) ?? nq.get(t);
  if (flag(r.sp500) && !sp.has(t)) notInIdx.push(`${t} (${r.company}) marcado S&P 500 y no está en la lista de Wikipedia`);
  if (flag(r.nasdaq100) && !nq.has(t)) notInIdx.push(`${t} (${r.company}) marcado Nasdaq 100 y no está en la lista de Wikipedia`);
  if (w && !similar(r.company, w)) bad.push(`${t}: tabla="${r.company}" · Wikipedia="${w}"`);
}
const missing = [];
for (const [t, n] of sp) if (!seen.has(t)) missing.push(`S&P 500: ${t} (${n})`);
for (const [t, n] of nq) if (!seen.has(t)) missing.push(`Nasdaq 100: ${t} (${n})`);
L.push(`Revisión STOCKS_RELEVANTES · ${new Date().toISOString()}`, `Registros en la tabla: ${table.length}`, '',
  `== NOMBRES QUE NO COINCIDEN (${bad.length}) ==`, ...bad, '',
  `== MARCADOS EN UN ÍNDICE AL QUE NO PERTENECEN SEGÚN WIKIPEDIA (${notInIdx.length}) ==`, ...notInIdx, '',
  `== EN WIKIPEDIA Y FALTAN EN LA TABLA (${missing.length}) ==`, ...missing);
fs.writeFileSync(outFile, L.join('\n') + '\n');
console.log(L.slice(0, 4).join('\n'), '\nnombres:', bad.length, 'índice:', notInIdx.length, 'faltan:', missing.length);
