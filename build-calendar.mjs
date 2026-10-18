// Carrusel semanal «El calendario de la semana»: Fed, BCE, IPC y empleo de EE. UU., resultados de grandes empresas,
// festivos y vencimientos. Fechas de data/calendar.json (fuentes oficiales); resultados de Alpha Vantage (si falla, se omiten).
// Uso: node build-calendar.mjs <item.json> [YYYY-MM-DD lunes de la semana]
import fs from 'node:fs';

const ARGS = process.argv.slice(2).filter(a => !a.startsWith('--'));
const DAY_MODE = process.argv.includes('--day');
const dst = ARGS[0] || 'item.json';
const forcedMonday = ARGS[1];
const CAL = JSON.parse(fs.readFileSync(new URL('./data/calendar.json', import.meta.url), 'utf8'));

const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA3 = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const iso = d => d.toISOString().slice(0, 10);
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// Hora de Madrid a partir de una hora de Nueva York (respeta los cambios de horario de verano de cada lado)
function offsetMin(tz, utcMs) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(utcMs));
  const g = t => Number(p.find(x => x.type === t).value);
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - utcMs) / 60000;
}
function etToMadrid(dateStr, hhmm) {
  const [y, m, d] = dateStr.split('-').map(Number); const [h, mi] = hhmm.split(':').map(Number);
  let utc = Date.UTC(y, m - 1, d, h, mi);
  utc -= offsetMin('America/New_York', utc - offsetMin('America/New_York', utc) * 60000) * 60000;
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(utc));
}

// Eventos
const events = [];
const push = (date, o) => events.push({ date, ...o });
for (const [d, sep] of CAL.fed) push(d, { type: 'fed', impact: 3, time: etToMadrid(d, '14:00'), title: 'La Fed decide los tipos de interés' + (sep ? ' (con nuevas proyecciones)' : '') });
for (const d of CAL.bce) push(d, { type: 'bce', impact: 3, time: '14:15', title: 'El BCE decide los tipos de interés' });
for (const d of CAL.empleo) push(d, { type: 'empleo', impact: 3, time: etToMadrid(d, '08:30'), title: 'Empleo de EE. UU. (nóminas y paro)' });
for (const d of CAL.ipc) push(d, { type: 'ipc', impact: 3, time: etToMadrid(d, '08:30'), title: 'Inflación de EE. UU. (IPC)' });
const closedUS = new Set(CAL.festivos_us.map(x => x[0]));
for (const [d, n] of CAL.festivos_us) push(d, { type: 'festivo', impact: 2, title: `Wall Street cerrada (${n})` });
for (const [d, h] of CAL.cierre_anticipado_us) push(d, { type: 'festivo', impact: 2, title: `Wall Street cierra antes (${h})` });
for (const [d, n] of CAL.festivos_es) push(d, { type: 'festivo', impact: 2, title: `Bolsa española cerrada (${n})` });
for (const [d, h] of CAL.cierre_anticipado_es) push(d, { type: 'festivo', impact: 2, title: `Bolsa española cierra a las ${h}` });
// Vencimientos: tercer viernes de cada mes (si Wall Street cierra ese día, vence el jueves)
const lastDay = parse(CAL.horizonte);
for (let y = 2026; y <= 2027; y++) for (let m = 0; m < 12; m++) {
  const first = new Date(Date.UTC(y, m, 1)); const off = (5 - first.getUTCDay() + 7) % 7;
  let d = new Date(Date.UTC(y, m, 1 + off + 14));
  if (d > lastDay) continue;
  const triple = [2, 5, 8, 11].includes(m);
  let s = iso(d); if (closedUS.has(s)) s = iso(addDays(d, -1));
  push(s, { type: 'opciones', impact: triple ? 3 : 2, title: triple ? 'Triple vencimiento: vencen opciones y futuros' : 'Vencen las opciones del mes' });
}
events.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

// Semana
const madridToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
let monday;
if (forcedMonday) monday = parse(forcedMonday);
else { const t = parse(madridToday); const wd = t.getUTCDay(); monday = wd === 0 ? addDays(t, 1) : wd === 6 ? addDays(t, 2) : addDays(t, 1 - wd); }
const friday = addDays(monday, 4), sunday = addDays(monday, 6);
const inRange = (e, a, b) => e.date >= iso(a) && e.date <= iso(b);
const week = events.filter(e => inRange(e, monday, sunday));
const radar = events.filter(e => inRange(e, addDays(sunday, 1), addDays(sunday, 21)) && e.impact >= 2);
if (iso(sunday) > CAL.horizonte) throw new Error('El calendario no llega a esta semana: hay que ampliar data/calendar.json');
const bmeCovered = iso(sunday) <= CAL.horizonte_bme;

// Resultados trimestrales de grandes empresas (Alpha Vantage)
const WATCH = { AAPL: 'Apple', MSFT: 'Microsoft', GOOGL: 'Alphabet', GOOG: 'Alphabet', AMZN: 'Amazon', META: 'Meta', NVDA: 'Nvidia', TSLA: 'Tesla', JPM: 'JPMorgan', BAC: 'Bank of America', WFC: 'Wells Fargo', GS: 'Goldman Sachs', MS: 'Morgan Stanley', C: 'Citigroup', NFLX: 'Netflix', KO: 'Coca-Cola', PEP: 'PepsiCo', MCD: "McDonald's", JNJ: 'Johnson & Johnson', PG: 'Procter & Gamble', XOM: 'Exxon', CVX: 'Chevron', WMT: 'Walmart', DIS: 'Disney', V: 'Visa', MA: 'Mastercard', AVGO: 'Broadcom', ORCL: 'Oracle', AMD: 'AMD', INTC: 'Intel', PLTR: 'Palantir', COST: 'Costco', HD: 'Home Depot', UNH: 'UnitedHealth', LLY: 'Eli Lilly', NKE: 'Nike', CRM: 'Salesforce', ADBE: 'Adobe', BA: 'Boeing', PFE: 'Pfizer' };
let earnings = [], earningsOk = false;
try {
  if (!process.env.ALPHAVANTAGE_API_KEY) throw new Error('sin clave');
  const r = await fetch(`https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${process.env.ALPHAVANTAGE_API_KEY}`, { signal: AbortSignal.timeout(30000) });
  const t = await r.text();
  if (!t.startsWith('symbol,')) throw new Error(t.slice(0, 100));
  const seen = new Set();
  for (const line of t.trim().split('\n').slice(1)) {
    const c = line.split(','); const sym = c[0], date = c[2], when = c[6] || '';
    if (!WATCH[sym] || !date) continue;
    const name = WATCH[sym]; if (seen.has(name + date)) continue; seen.add(name + date);
    earnings.push({ date, name, when });
  }
  earningsOk = true;
} catch (e) { console.warn('Resultados no disponibles:', e.message); }
earnings.sort((a, b) => a.date.localeCompare(b.date));
const earnWeek = earnings.filter(e => e.date >= iso(monday) && e.date <= iso(friday));
const whenTxt = w => /pre/i.test(w) ? 'antes de abrir' : /post/i.test(w) ? 'tras el cierre' : '';

// Textos
const fecha = d => `${d.getUTCDate()} de ${MES[d.getUTCMonth()]}`;
const label = d => `${DIA3[d.getUTCDay()]} ${d.getUTCDate()}`;
const rowOf = e => ({ d: label(parse(e.date)), t: e.time || '', n: e.title, k: e.impact });
const macro = week.filter(e => e.impact === 3 && e.type !== 'opciones').concat(week.filter(e => e.type === 'opciones' && e.impact === 3));
const EXPL = {
  fed: ['La Fed y los tipos', 'La Reserva Federal fija el precio del dinero en EE. UU. Si sube los tipos, financiarse cuesta más y la bolsa suele resentirse; si los baja, suele respirar. Importa la decisión, pero sobre todo el mensaje de su presidente sobre lo que viene.'],
  bce: ['El BCE y los tipos', 'El Banco Central Europeo marca los tipos del euro. Afecta a la hipoteca, al ahorro y a la bolsa europea. El mercado lee la decisión y también la rueda de prensa posterior, donde da pistas del siguiente paso.'],
  ipc: ['El IPC de EE. UU.', 'Mide cuánto han subido los precios. Si sale por encima de lo esperado, el mercado teme tipos altos durante más tiempo; si sale por debajo, respira. Suele mover el mercado en los minutos siguientes a la publicación.'],
  empleo: ['El informe de empleo', 'Cuenta cuántos puestos de trabajo se han creado y cuál es la tasa de paro. Un empleo muy fuerte puede retrasar bajadas de tipos; uno muy débil asusta por la economía. Por eso cada primer viernes del mes mueve a los mercados.'],
  opciones: ['El vencimiento de opciones', 'Los contratos de opciones y futuros tienen fecha de caducidad, normalmente el tercer viernes del mes. Ese día se cierran muchas posiciones a la vez, hay más volumen y pueden darse movimientos bruscos sin noticia nueva.'],
  festivo: ['Mercados cerrados', 'Cuando un mercado cierra por festivo, no hay precios nuevos en él. Conviene saberlo para no esperar una subida o bajada que no puede ocurrir ese día, y porque los días de cierre anticipado suelen tener poco volumen.']
};


if (DAY_MODE) {
  const today = forcedMonday || madridToday;
  const evs = events.filter(e => e.date === today && e.impact >= 2);
  const earn = earnings.filter(e => e.date === today);
  const BLURB = { fed: 'Decisión sobre los tipos y mensaje de su presidente: ahí están las pistas.', bce: 'Decisión a las 14:15 y rueda de prensa después.', ipc: 'Si sale por encima de lo esperado, el mercado teme tipos altos más tiempo.', empleo: 'Empleo muy fuerte o muy débil: ambos pueden mover los índices.', opciones: 'Más volumen y movimientos bruscos sin noticia nueva.', festivo: 'Sin precios nuevos en ese mercado.' };
  const rowsD = evs.map(e => ({ t: e.time || '', n: e.title, k: e.impact, b: BLURB[e.type] || '' }));
  for (const e of earn) rowsD.push({ t: whenTxt(e.when), n: `${e.name} presenta resultados`, k: 1, b: 'Las cifras y las previsiones suelen mover la acción y a su sector.' });
  const d = parse(today);
  const out = { empty: rowsD.length === 0, date: today, label: `${DIA[d.getUTCDay()]} ${d.getUTCDate()} de ${MES[d.getUTCMonth()]}`, rows: rowsD.slice(0, 4), earningsOk };
  fs.writeFileSync(dst, JSON.stringify(out, null, 2));
  console.log(`::notice::Día ${today}: ${rowsD.length} citas`);
  process.exit(0);
}

const slides = [];
const range = `${monday.getUTCDate()}–${friday.getUTCDate()}`;
slides.push({ t: 'cover', big: range, bigSize: 330, title: `de ${MES[monday.getUTCMonth()]}: lo que mueve los mercados esta semana`, foot: 'Desliza: qué pasa cada día' });

if (week.length === 0 && earnWeek.length === 0) {
  slides.push({ t: 'point', head: 'Semana [[tranquila]] en el calendario', body: 'No hay citas de máximo impacto (bancos centrales, inflación o empleo). Las noticias de empresas y del día a día mandarán más que el calendario.', foot: 'Menos citas no es menos riesgo' });
} else {
  const merged = [...week.map(e => ({ date: e.date, time: e.time || '', ...rowOf(e) })), ...earnWeek.map(e => ({ date: e.date, time: '', d: label(parse(e.date)), t: whenTxt(e.when), n: `${e.name} presenta resultados`, k: 1 }))]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.t || '').localeCompare(b.t || ''));
  for (let i = 0; i < merged.length && slides.length < 3; i += 5) {
    slides.push({ t: 'agenda', head: i === 0 ? 'Tu semana' : 'Y además…', kicker: 'Día a día · hora de Madrid', rows: merged.slice(i, i + 5).map(({ d, t, n, k }) => ({ d, t, n, k })), foot: 'Rojo: mueve el mercado · Verde: a vigilar' });
  }
}
// Explicación del evento principal
const star = macro[0] || week.find(e => e.type === 'festivo') || null;
if (star && EXPL[star.type]) {
  const [h, b] = EXPL[star.type];
  slides.push({ t: 'point', kicker: `Lo más importante: ${DIA[parse(star.date).getUTCDay()]} ${parse(star.date).getUTCDate()}`, head: h, body: b, note: 'Contenido educativo: no sabemos cómo reaccionará el mercado, solo cuándo habrá que estar atento.', foot: 'Qué es y por qué importa' });
}
if (radar.length) {
  slides.push({ t: 'agenda', head: 'En el radar', kicker: 'Las próximas tres semanas', rows: radar.slice(0, 5).map(e => ({ d: `${parse(e.date).getUTCDate()} ${MES3[parse(e.date).getUTCMonth()].toUpperCase()}`, t: e.time || '', n: e.title, k: e.impact })), foot: 'Anótalo en el calendario' });
}
// Relleno: el carrusel debe tener SIEMPRE 7 diapositivas distintas (lo exige la publicación en Instagram)
const TIPS = [
  { t: 'point', kicker: 'Para leer el calendario', head: 'Rojo y [[verde]]', body: 'Rojo: citas que suelen mover los mercados (bancos centrales, inflación, empleo). Verde: citas a vigilar, con menos impacto. No predicen subidas ni bajadas: avisan de cuándo puede haber más movimiento.', foot: 'Cómo usar el calendario' },
  { t: 'point', kicker: 'Una idea clave', head: 'Mueve [[la sorpresa]]', body: 'El mercado ya cuenta con lo que espera. Una cifra buena puede sentar mal si se esperaba más, y una mala puede animar si se esperaba algo peor.', note: 'Por eso una cita no es una predicción.', foot: 'Qué mueve realmente los precios' },
  { t: 'point', kicker: 'Resultados de empresas', head: 'Cada trimestre, [[las cuentas]]', body: 'Las empresas cotizadas publican sus resultados cada trimestre. Las cifras y, sobre todo, las previsiones suelen mover su acción y a veces a todo su sector.', foot: 'Las fechas las puede cambiar cada empresa' },
  { t: 'point', kicker: 'Festivos y cierres', head: 'Si el mercado [[cierra]]', body: 'Cuando una bolsa cierra por festivo no hay precios nuevos en ella, y algunos días cierra antes de lo habitual. Conviene saberlo para no esperar un movimiento que no puede ocurrir.', foot: 'Revisa los cierres anticipados' },
  { t: 'point', kicker: 'Opciones y futuros', head: 'El tercer [[viernes]]', body: 'Los contratos de opciones y futuros caducan normalmente el tercer viernes de cada mes. Ese día se cierran muchas posiciones a la vez y puede haber más movimiento de lo habitual.', foot: 'Vencimientos mensuales' },
];
const usedTypes = new Set(star ? [star.type] : []);
const extras = [];
for (const e of radar) { if (EXPL[e.type] && !usedTypes.has(e.type)) { usedTypes.add(e.type); const [h, b] = EXPL[e.type]; extras.push({ t: 'point', kicker: `Lo que viene: ${parse(e.date).getUTCDate()} de ${MES[parse(e.date).getUTCMonth()]}`, head: h, body: b, note: 'Contenido educativo: no sabemos cómo reaccionará el mercado, solo cuándo habrá que estar atento.', foot: 'Qué es y por qué importa' }); } }
extras.push(...TIPS);
while (slides.length < 6 && extras.length) slides.push(extras.shift());
slides.push({ t: 'close', head: 'Guarda [[la semana]]', headSize: 150, body: 'Cada domingo, el calendario de lo que mueve los mercados: bancos centrales, inflación, empleo, resultados, festivos y vencimientos.', extra: 'Sígueme y activa las notificaciones para no perderte ninguna cita.', foot: 'Tu Amigo de las Finanzas' });

const lines = [];
for (const e of week.filter(e => e.impact === 3 && e.type !== 'opciones').slice(0, 4)) lines.push(`• ${DIA[parse(e.date).getUTCDay()]} ${parse(e.date).getUTCDate()}: ${e.title}`);
for (const e of week.filter(e => e.type === 'opciones' || e.type === 'festivo').slice(0, 2)) lines.push(`• ${DIA[parse(e.date).getUTCDay()]} ${parse(e.date).getUTCDate()}: ${e.title}`);
for (const e of earnWeek.slice(0, 4)) lines.push(`• ${DIA[parse(e.date).getUTCDay()]} ${parse(e.date).getUTCDate()}: ${e.name} presenta resultados`);
const intro = lines.length ? `Semana del ${fecha(monday)} al ${fecha(friday)} 📅\n\nLo que hay en el calendario:\n${lines.join('\n')}\n\nDesliza para ver cada día y qué significa.` : `Semana del ${fecha(monday)} al ${fecha(friday)} 📅\n\nSemana tranquila en el calendario de grandes citas. Desliza para ver los próximos eventos.`;
const caption = `${intro}\n\nLas fechas de resultados las pueden cambiar las empresas: confírmalas en su web.\n\n💾 Guárdalo y actívate las notificaciones: cada domingo, la agenda de la semana.`;
const sources = ['federalreserve.gov', 'ecb.europa.eu', 'bls.gov', 'nyse.com', 'bolsasymercados.es'].concat(earningsOk ? ['Alpha Vantage'] : []);
const out = { id: `calendario-${iso(monday)}`, label: 'Calendario de la semana', accent: 'green', caption, tags: ['#bolsa', '#calendarioeconomico', '#Fed', '#BCE', '#inversion', '#aprenderbolsa'], sources, slides };
if (!bmeCovered) console.warn('AVISO: festivos de la bolsa española sin confirmar para estas fechas.');
fs.writeFileSync(dst, JSON.stringify(out, null, 2));
console.log(`::notice::Resultados (${earningsOk ? 'ok' : 'no disponibles'}): ${earnWeek.map(e => e.date.slice(5) + ' ' + e.name).join(', ') || 'ninguno esta semana'}`);
console.log(`Semana ${iso(monday)}: ${week.length} eventos, ${earnWeek.length} resultados, ${radar.length} en el radar, ${slides.length} diapositivas`);
