// Guion del reel «¿Cuánto cuesta…?»: coste de un uso doméstico a la hora más cara y a la más barata del día, con el precio real PVPC de hoy.
// Uso: node tools/build-cuesta.mjs <salida.json> [AAAA-MM-DD]   (CUESTA_FAKE=1 usa precios inventados, solo para pruebas locales)
import fs from 'node:fs';
import { pvpc, nf, madridDate } from '../lib-datos.mjs';

const [out, dateArg] = process.argv.slice(2);
const today = dateArg || madridDate();
// Consumos medios orientativos por uso (kWh)
const USOS = [
  { frase: 'poner la lavadora', uso: 'un lavado a 40 grados', kwh: 0.9 },
  { frase: 'poner el lavavajillas', uso: 'un ciclo del lavavajillas', kwh: 1.1 },
  { frase: 'poner la secadora', uso: 'un ciclo de secadora', kwh: 2.5 },
  { frase: 'encender el horno', uso: 'una hora de horno', kwh: 1.5 },
  { frase: 'poner el aire acondicionado', uso: 'una hora de aire acondicionado', kwh: 1.0 },
  { frase: 'encender el radiador eléctrico', uso: 'una hora de radiador eléctrico', kwh: 1.5 },
  { frase: 'cocinar con la vitro', uso: 'una hora de vitrocerámica', kwh: 1.2 },
  { frase: 'usar la plancha', uso: 'una hora de plancha', kwh: 1.0 },
];
const doy = Math.floor((Date.parse(today + 'T12:00:00Z') - Date.parse(today.slice(0, 4) + '-01-01T12:00:00Z')) / 86400000);
const u = USOS[doy % USOS.length];

let dia = [];
if (process.env.CUESTA_FAKE) dia = Array.from({ length: 24 }, (_, h) => ({ date: today, hour: String(h).padStart(2, '0'), p: 0.08 + 0.12 * Math.abs(Math.sin(h / 4)) + (h >= 18 && h <= 21 ? 0.1 : 0) }));
else {
  for (let i = 0; i < 3 && dia.length < 23; i++) { try { dia = (await pvpc(today, today)).filter(x => x.date === today); } catch (e) { console.warn('REData:', e.message); } }
}
if (dia.length < 23) throw new Error(`No hay precios PVPC de ${today}`);

// Horas realistas para usar el electrodoméstico: de 7 a 24 h
const util = dia.filter(x => Number(x.hour) >= 7);
const cara = util.reduce((m, x) => (x.p > m.p ? x : m)), barata = util.reduce((m, x) => (x.p < m.p ? x : m));
const costeCara = cara.p * u.kwh, costeBarata = barata.p * u.kwh;
const eur = c => `${nf(Math.max(c, 0.01), 2)} €`;
const dif = costeCara - costeBarata, menos = Math.round((1 - costeBarata / costeCara) * 100);
if (!(dif > 0.01) || menos < 10) throw new Error(`El día ${today} no hay diferencia suficiente entre horas (${menos} %)`);
const ahorroMes = dif * 20, ahorroTxt = ahorroMes >= 10 ? `${Math.round(ahorroMes)} €` : `${nf(ahorroMes, 1)} €`;
const hh = x => `${Number(x.hour)}:00`;
const hhVoz = x => `las ${Number(x.hour)}`;

const hook = `¿Cuánto cuesta [[${u.frase}]] hoy?`;
const item = {
  date: today,
  mood: 'neutral',
  badge: 'CUÁNTO CUESTA',
  hook,
  hook_big: eur(costeCara),
  voz_hook: `¿Cuánto cuesta ${u.frase} hoy? Según la hora, puede salirte por ${nf(costeCara, 2)} euros o por solo ${nf(Math.max(costeBarata, 0.01), 2)}.`,
  scenes: [
    { kicker: 'La hora más cara', big: eur(costeCara), text: `A las ${hh(cara)}, ${u.uso} te cuesta [[lo máximo del día]]`, voz: `A las ${Number(cara.hour)} horas, ${u.uso} te cuesta ${nf(costeCara, 2)} euros: es la hora más cara.` },
    { kicker: 'La hora más barata', big: eur(costeBarata), text: `A las ${hh(barata)}, lo mismo sale un [[${menos} % más barato]]`, voz: `A las ${Number(barata.hour)} horas, lo mismo te sale un ${menos} por ciento más barato.` },
    { kicker: 'Al mes', big: ahorroTxt, text: `Si lo haces unas 20 veces al mes, [[ahorras unos ${ahorroTxt}]] cambiando solo la hora`, voz: `Si lo haces unas veinte veces al mes, ahorras unos ${ahorroTxt.replace(' €', '')} euros cambiando solo la hora.` },
    { kicker: 'El truco', text: 'Programa el [[inicio diferido]] y evita las horas punta: [[de 10 a 14 y de 18 a 22 h]]', voz: 'El truco: programa el inicio diferido y evita las horas punta, de diez a dos y de seis a diez de la noche, de lunes a viernes.' },
  ],
  caption: `¿Cuánto cuesta ${u.frase} hoy? De ${eur(costeBarata)} a ${eur(costeCara)} según la hora 💡\n\nMismo uso, distinto precio: con el precio de la luz de hoy (PVPC) y un consumo medio de ${nf(u.kwh, 1)} kWh por uso, mover el aparato a la hora barata se nota a final de mes.\n\nEs un cálculo orientativo, solo de energía y sin impuestos.`,
  source: 'Red Eléctrica (PVPC de hoy) y consumos medios orientativos',
  tags: ['#ahorro', '#facturadelaluz', '#finanzaspersonales'],
  outro_kick: '¿Te ha servido?',
  outro_txt: 'Comenta [[GASTOS]] y te paso la lista',
  voz_outro: 'Si quieres revisar tus gastos fijos, comenta gastos y te paso la guía gratis. Sígueme para más.',
  cta_kind: 'vida',
};
fs.writeFileSync(out, JSON.stringify(item, null, 2));
console.log(`Cuesta ${u.frase}: ${eur(costeBarata)} (${hh(barata)}) – ${eur(costeCara)} (${hh(cara)}), ahorro/mes ${ahorroTxt}`);
