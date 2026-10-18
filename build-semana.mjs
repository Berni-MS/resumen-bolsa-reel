// Carrusel «La semana en datos» (domingo). Uso: node build-semana.mjs <item.json> [AAAA-MM-DD domingo]
// Datos de lunes a domingo: luz (PVPC, Red Eléctrica), IBEX 35, S&P 500, euro-dólar, oro, Brent y bitcoin.
import fs from 'node:fs';
import { pvpc, mean, nf, pct, change, madridDate, addDays, dow, dayName, yahoo, ecbUsd, bitcoin, lastAtOrBefore, lastBefore } from './lib-datos.mjs';

const out = process.argv[2];
let sunday = process.argv[3] || madridDate();
while (dow(sunday) !== 0) sunday = addDays(sunday, -1); // por si se lanza otro día: el domingo anterior
const monday = addDays(sunday, -6), prevMonday = addDays(monday, -7), friday = addDays(monday, 4);
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dm = iso => `${Number(iso.slice(8))} de ${MES[Number(iso.slice(5, 7)) - 1]}`;

// ----- Luz -----
const all = await pvpc(prevMonday, sunday);
const byDay = {};
for (const x of all) (byDay[x.date] ||= []).push(x);
const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter(d => byDay[d]?.length >= 23);
const prev = Array.from({ length: 7 }, (_, i) => addDays(prevMonday, i)).filter(d => byDay[d]?.length >= 23);
if (week.length < 6) throw new Error('Faltan precios de la luz de la semana');
const dayAvg = d => ({ d, avg: mean(byDay[d].map(x => x.p)) });
const avgs = week.map(dayAvg), wavg = mean(avgs.map(x => x.avg));
const pavg = prev.length >= 6 ? mean(prev.map(d => dayAvg(d).avg)) : null;
const cheapD = avgs.reduce((m, x) => (x.avg < m.avg ? x : m)), dearD = avgs.reduce((m, x) => (x.avg > m.avg ? x : m));
const flat = week.flatMap(d => byDay[d]);
const minH = flat.reduce((m, x) => (x.p < m.p ? x : m)), maxH = flat.reduce((m, x) => (x.p > m.p ? x : m));
const lwd = pavg ? change(wavg, pavg) : null;

// ----- Mercados (cambio de la semana: último cierre hasta el domingo frente al último previo al lunes) -----
const weekly = async (sym) => { const y = await yahoo(sym, '1mo'); const a = lastBefore(y.bars, monday), b = lastAtOrBefore(y.bars, sunday); if (!a || !b || a.date === b.date) throw new Error(sym); return { last: b.close, ch: change(b.close, a.close) }; };
const safe = async (fn) => { try { return await fn(); } catch (e) { console.warn('Sin dato:', e.message); return null; } };
const [ibex, spx, gold, brent, eur, btc] = await Promise.all([
  safe(() => weekly('^IBEX')), safe(() => weekly('^GSPC')), safe(() => weekly('GC=F')), safe(() => weekly('BZ=F')),
  safe(async () => { const b = await ecbUsd(addDays(monday, -10)); const a = lastBefore(b, monday), z = lastAtOrBefore(b, sunday); return { last: z.close, ch: change(z.close, a.close) }; }),
  safe(async () => { const p = await bitcoin(8); return { last: p.at(-1), ch: change(p.at(-1), p.at(-8) ?? p[0]) }; }),
]);
if (!ibex && !spx) throw new Error('Faltan los índices de la semana');

const foot = 'Contenido informativo. No es asesoramiento financiero.';
const kwh = v => `${nf(v, 3).replace(/^-/, '−')} €/kWh`;
const slides = [
  { t: 'cover', big: `${Number(monday.slice(8))}–${Number(sunday.slice(8))}`, bigSize: 330, title: 'La semana en [[datos]]', foot: `Del lunes ${dm(monday)} al domingo ${dm(sunday)}` },
  { t: 'stat', kicker: 'La luz', big: nf(wavg, 3), bigSize: 280, color: 'green', head: '€/kWh de media esta semana', body: `${lwd != null ? `${nf(Math.abs(lwd), 0)} % ${lwd <= 0 ? 'más barata' : 'más cara'} que la semana anterior. ` : ''}Día más barato: ${dayName(cheapD.d).toLowerCase()} (${kwh(cheapD.avg)}). Día más caro: ${dayName(dearD.d).toLowerCase()} (${kwh(dearD.avg)}).`, foot: 'Precio PVPC (tarifa regulada) · Fuente: Red Eléctrica' },
  { t: 'point', kicker: 'La luz, hora a hora', head: `La hora más barata: [[${dayName(minH.date).toLowerCase()} a las ${minH.hour}:00]]`, body: `${kwh(minH.p)}${minH.p < 0 ? ' (precio negativo)' : ''}. La más cara: ${dayName(maxH.date).toLowerCase()} a las ${maxH.hour}:00, a ${kwh(maxH.p)}${minH.p > 0 ? `, unas ${nf(maxH.p / minH.p, 0)} veces más` : ''}.`, note: 'El precio cambia mucho según la hora: por eso importa cuándo consumes, si tienes tarifa regulada.', foot },
];
const lead = ibex || spx;
slides.push({ t: 'stat', kicker: 'La bolsa', big: pct(lead.ch), bigSize: 250, color: lead.ch >= 0 ? 'green' : 'red', head: ibex ? 'IBEX 35 en la semana' : 'S&P 500 en la semana', body: `${ibex && spx ? `S&P 500: ${pct(spx.ch)} (${nf(spx.last, 0)} puntos). ` : ibex ? `Cierre: ${nf(ibex.last, 0)} puntos. ` : ''}Variación entre el cierre del viernes anterior y el de esta semana.`, foot });
const cards = [];
if (eur) cards.push({ t: `Euro/dólar: ${nf(eur.last, 4)} $`, b: `${pct(eur.ch)} en la semana (BCE)` });
if (gold) cards.push({ t: `Oro: ${nf(gold.last, 0)} $ la onza`, b: `${pct(gold.ch)} en la semana` });
if (brent) cards.push({ t: `Brent: ${nf(brent.last, 2)} $ el barril`, b: `${pct(brent.ch)} en la semana` });
if (btc) cards.push({ t: `Bitcoin: ${nf(btc.last, 0)} €`, b: `${pct(btc.ch)} en 7 días` });
if (cards.length < 2) throw new Error('Faltan datos de divisas y materias primas');
slides.push({ t: 'cards', head: 'Divisas, oro, petróleo y bitcoin', accent: 'green', cards, foot: 'Fuentes: BCE, Yahoo Finance, CoinGecko · Datos con posible retraso' });
slides.push({ t: 'point', kicker: 'Y ahora…', head: 'La agenda de la semana [[llega esta noche]]', body: 'Hoy a las 19:20 publicamos el calendario con las citas que mueven los mercados: bancos centrales, inflación, empleo y resultados.', foot });
slides.push({ t: 'close', head: 'Guarda [[la semana]]', headSize: 150, body: 'Cada domingo, los datos que importan a tu bolsillo: luz, bolsa, divisas, oro, petróleo y bitcoin.', extra: 'Mándaselo a alguien al que le sube la factura de la luz.', extraBold: true, foot });

const lines = [`⚡ Luz: ${nf(wavg, 3)} €/kWh de media${lwd != null ? ` (${pct(lwd, 0)} vs. la semana anterior)` : ''}`];
if (ibex) lines.push(`📈 IBEX 35: ${pct(ibex.ch)}`);
if (spx) lines.push(`🇺🇸 S&P 500: ${pct(spx.ch)}`);
if (eur) lines.push(`💶 Euro/dólar: ${nf(eur.last, 4)} $`);
if (gold) lines.push(`🥇 Oro: ${pct(gold.ch)}`);
if (brent) lines.push(`🛢️ Brent: ${pct(brent.ch)}`);
if (btc) lines.push(`₿ Bitcoin: ${pct(btc.ch)}`);
const caption = `La semana en datos (${dm(monday)} al ${dm(sunday)}) 🗓️\n\n${lines.join('\n')}\n\nDesliza para ver el detalle hora a hora de la luz y cada cifra.\n\n💾 Guárdalo y actívate las notificaciones: cada domingo, la semana en datos.`;
const item = {
  id: `semana-${sunday}`, label: 'La semana en datos', accent: 'green', caption,
  tags: ['#preciodelaluz', '#luz', '#bolsa', '#ahorro', '#finanzaspersonales'],
  sources: ['Red Eléctrica (PVPC)', 'BCE', 'Yahoo Finance', 'CoinGecko'], slides,
};
if (slides.length !== 7) throw new Error('El carrusel debe tener 7 diapositivas, tiene ' + slides.length);
fs.writeFileSync(out, JSON.stringify(item, null, 2));
console.log(`Semana ${monday}–${sunday}: luz ${nf(wavg, 3)} | ${lines.join(' | ')}`);
