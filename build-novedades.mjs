// Datos de las historias de novedades. Uso: node build-novedades.mjs <carburantes|euribor|ipc> <salida.json> <carpeta-estado> [force]
// carburantes: precios medios (Ministerio de Transición Ecológica). euribor: media mensual a 12 meses (BCE). ipc: inflación (INE).
// Si no hay un dato nuevo (o ya se publicó), escribe skip=true y NO se publica nada. Si falla la fuente, termina con error.
import fs from 'node:fs';
import path from 'node:path';
import { getText, getJson, nf, madridDate, addDays } from './lib-datos.mjs';

const [kind, out, stateDir, forceArg] = process.argv.slice(2);
const force = forceArg === 'true' || forceArg === 'force';
const today = madridDate();
const num = s => { const n = Number(String(s ?? '').replace(',', '.')); return Number.isFinite(n) && String(s ?? '').trim() !== '' ? n : null; };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const monthName = ym => MONTHS[Number(ym.slice(5, 7)) - 1];
const monthLabel = ym => `${monthName(ym)} de ${ym.slice(0, 4)}`;
const prevMonth = ym => { let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1; if (m === 0) { y--; m = 12; } return `${y}-${String(m).padStart(2, '0')}`; };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const markerFile = key => path.join(stateDir, process.env.MARKER_PREFIX ? `${process.env.MARKER_PREFIX}${key}.txt` : `${key}.txt`);

function finish(res) {
  if (!force && fs.existsSync(markerFile(res.key))) return skip(`ya publicado (${res.key})`);
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `skip=false\nkey=${res.key}\n`);
  console.log(`Datos listos: ${res.key}`);
}
function skip(why) {
  console.log(`Nada que publicar: ${why}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'skip=true\n');
}

// ---------- Carburantes ----------
const titleProv = p => {
  let s = p.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  s = s.replace(/\bDe\b/g, 'de').replace(/\bDel\b/g, 'del').replace(/\bLa\b/g, 'la').replace(/\bLas\b/g, 'las');
  const m = s.match(/^(.*)\s\((a|la|el|las|los|illes)\)$/i); // "Coruña (A)" → "A Coruña"
  if (m) { const art = m[2].toLowerCase() === 'illes' ? '' : m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase(); s = `${art} ${m[1]}`.trim(); }
  return s.replace(/^Balears.*/i, 'Baleares');
};
async function carburantes() {
  const j = await getJson('https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/', 3);
  const list = (j.ListaEESSPrecio || []).filter(e => e['Tipo Venta'] === 'P' && !['35', '38', '51', '52'].includes(e.IDProvincia)); // Península y Baleares
  const g = [], d = [], byProv = {};
  for (const e of list) {
    const pg = num(e['Precio Gasolina 95 E5']), pd = num(e['Precio Gasoleo A']);
    const ok = x => x != null && x > 0.8 && x < 3.5;
    if (ok(pg)) g.push(pg);
    if (ok(pd)) d.push(pd);
    if (ok(pg)) (byProv[e.Provincia] ||= []).push(pg);
  }
  if (g.length < 3000 || d.length < 3000) throw new Error(`Pocas estaciones con precio (${g.length}/${d.length})`);
  const gm = mean(g), dm = mean(d);
  const provs = Object.entries(byProv).filter(([, a]) => a.length >= 30).map(([p, a]) => ({ name: titleProv(p), g: mean(a) })).sort((a, b) => a.g - b.g);
  if (provs.length < 10) throw new Error('Pocas provincias con datos');
  // histórico semanal para la comparación
  fs.mkdirSync(stateDir, { recursive: true });
  const histFile = path.join(stateDir, 'carburantes.json');
  let hist = []; try { hist = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch {}
  const prior = hist.filter(h => h.date <= addDays(today, -5)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const daysAgo = prior ? Math.round((new Date(today) - new Date(prior.date)) / 86400000) : null;
  hist = [...hist.filter(h => h.date !== today), { date: today, g: Number(gm.toFixed(4)), d: Number(dm.toFixed(4)) }].sort((a, b) => a.date.localeCompare(b.date)).slice(-20);
  fs.writeFileSync(histFile, JSON.stringify(hist));
  const cheap = provs.slice(0, 3), dear = provs.slice(-3).reverse();
  const res = {
    kind: 'carburantes', key: `carburantes-${today}`, date: today, stations: list.length,
    label: new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(today + 'T12:00:00Z')),
    g: { avg: gm, tank: gm * 50, ch: prior ? (gm / prior.g - 1) * 100 : null },
    d: { avg: dm, tank: dm * 50, ch: prior ? (dm / prior.d - 1) * 100 : null },
    daysAgo, cheap, dear, saving: (dear[0].g - cheap[0].g) * 50,
  };
  finish(res);
}

// ---------- Euríbor (media mensual a 12 meses, BCE) ----------
function csvLine(l) { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }
const cuota = (capital, tinPct, years) => { const i = tinPct / 100 / 12, n = years * 12; return i === 0 ? capital / n : (capital * i) / (1 - Math.pow(1 + i, -n)); };
async function euribor() {
  const t = await getText('https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA?lastNObservations=16&format=csvdata');
  const [h, ...rows] = t.trim().split('\n'); const H = csvLine(h), iT = H.indexOf('TIME_PERIOD'), iV = H.indexOf('OBS_VALUE');
  const obs = rows.map(csvLine).map(c => ({ ym: c[iT], v: Number(c[iV]) })).filter(o => o.ym && Number.isFinite(o.v)).sort((a, b) => a.ym.localeCompare(b.ym));
  if (obs.length < 3) throw new Error('BCE: pocos datos de Euríbor');
  const last = obs[obs.length - 1];
  if (last.ym >= today.slice(0, 7)) return skip(`el último dato (${last.ym}) no es de un mes cerrado`);
  const prev = obs.find(o => o.ym === prevMonth(last.ym));
  const yago = obs.find(o => o.ym === `${Number(last.ym.slice(0, 4)) - 1}${last.ym.slice(4)}`);
  const SPREAD = 1, CAP = 150000, YEARS = 25;
  const now = cuota(CAP, last.v + SPREAD, YEARS), before = yago ? cuota(CAP, yago.v + SPREAD, YEARS) : null;
  finish({
    kind: 'euribor', key: `euribor-${last.ym}`, ym: last.ym, label: monthLabel(last.ym), month: monthName(last.ym),
    value: last.v, prev: prev ? prev.v : null, yago: yago ? yago.v : null,
    mortgage: { capital: CAP, years: YEARS, spread: SPREAD, now, before, diff: before != null ? now - before : null },
  });
}

// ---------- IPC (INE) ----------
async function ipc() {
  const j = await getJson('https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/76125?nult=2');
  const by = {};
  for (const s of j) { const data = [...(s.Data || [])].sort((a, b) => b.Fecha - a.Fecha); by[s.Nombre.replace(/\s+/g, ' ').trim()] = data.map(x => ({ ym: new Date(x.Fecha + 43200000).toISOString().slice(0, 7), v: x.Valor })); }
  const get = (grp, tipo) => { const a = by[`Nacional. ${grp}. ${tipo}.`]; if (!a || !a.length) throw new Error(`INE: falta ${grp} (${tipo})`); return a; };
  const ga = get('Índice general', 'Variación anual'), gm = get('Índice general', 'Variación mensual');
  const ym = ga[0].ym;
  const groups = [
    ['Alimentos y bebidas no alcohólicas', 'Comida y bebida'],
    ['Vivienda, agua, electricidad, gas y otros combustibles', 'Vivienda, luz y gas'],
    ['Transporte', 'Transporte'],
    ['Restaurantes y servicios de alojamiento', 'Restaurantes y hoteles'],
  ].map(([full, name]) => { const a = get(full, 'Variación anual'); return { name, v: a[0].v, prev: a[1] ? a[1].v : null }; });
  finish({
    kind: 'ipc', key: `ipc-${ym}`, ym, label: monthLabel(ym), month: monthName(ym), prevMonth: ga[1] ? monthName(ga[1].ym) : null,
    annual: ga[0].v, annualPrev: ga[1] ? ga[1].v : null, monthly: gm[0].v, groups,
  });
}

if (!['carburantes', 'euribor', 'ipc'].includes(kind)) { console.error('Uso: build-novedades.mjs <carburantes|euribor|ipc> <out.json> <estado> [force]'); process.exit(2); }
fs.mkdirSync(stateDir, { recursive: true });
await ({ carburantes, euribor, ipc })[kind]();
