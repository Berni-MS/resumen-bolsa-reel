// Carrusel de reacción el mismo día que sale el dato (IPC del INE o Euríbor del BCE).
// Uso: node build-reaccion.mjs <ipc|euribor> <item.json> <carpeta-estado> [force]
// Reutiliza build-novedades.mjs para los datos. Si no hay dato nuevo, escribe skip=true y no publica nada.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const [kind, dst, stateDir, force] = process.argv.slice(2);
if (!['ipc', 'euribor'].includes(kind)) throw new Error('kind debe ser ipc o euribor');
fs.mkdirSync(stateDir, { recursive: true });
const raw = process.env.REACCION_DATOS || 'datos-reaccion.json';
if (!process.env.REACCION_DATOS) try { fs.unlinkSync(raw); } catch {}
const env = { ...process.env, GITHUB_OUTPUT: '', MARKER_PREFIX: 'reaccion-' };
if (!process.env.REACCION_DATOS) execFileSync('node', ['build-novedades.mjs', kind, raw, stateDir, force || 'false'], { stdio: 'inherit', env });
if (!fs.existsSync(raw)) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'skip=true\n');
  process.exit(0);
}
const d = JSON.parse(fs.readFileSync(raw, 'utf8'));
const f = (n, dec = 1) => Number(n).toFixed(dec).replace('.', ',');
const pct = (n, dec = 1) => `${f(n, dec)} %`;
const sg = (n, dec = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${f(Math.abs(n), dec)} %`;
const eur = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const year = String(d.ym).slice(0, 4);
let item;

if (kind === 'ipc') {
  const up = d.annualPrev != null ? d.annual > d.annualPrev : null;
  const same = d.annualPrev != null && Math.abs(d.annual - d.annualPrev) < 0.05;
  const mv = same ? 'se mantiene' : up ? 'sube' : 'baja';
  const gr = [...d.groups].sort((a, b) => b.v - a.v).slice(0, 3);
  const cesta = 100 * (1 + d.annual / 100);
  item = {
    id: `ipc-${d.ym}`, label: 'IPC', accent: up ? 'red' : 'green',
    caption: `IPC de ${d.month} ${year}: la inflación en España ${mv} al ${pct(d.annual)} 📊 Te explico qué significa para tu compra y tus gastos, con el dato del INE publicado hoy.\n\nDesliza para verlo.\n\n💾 Guárdalo para comparar con el próximo mes.`,
    tags: ['#IPC', '#inflacion', '#finanzaspersonales'],
    sources: ['INE (IPC, índice general y grupos)'],
    slides: [
      { t: 'cover', big: pct(d.annual), title: `IPC de [[${d.month}]]: la inflación`, foot: 'Dato publicado hoy por el INE' },
      { t: 'stat', kicker: `Inflación anual · ${d.month}`, big: pct(d.annual), color: up ? 'red' : 'green', head: same ? 'Se mantiene' : up ? 'Sube respecto al mes anterior' : 'Baja respecto al mes anterior', body: d.annualPrev != null ? `En ${d.prevMonth} fue del ${pct(d.annualPrev)}. Es lo que han subido los precios en 12 meses.` : 'Es lo que han subido los precios en los últimos 12 meses.', foot: 'Variación anual del IPC' },
      { t: 'point', kicker: 'Mes a mes', head: `${sg(d.monthly)} [[en un mes]]`, body: `Es la variación de precios respecto al mes anterior. Mira siempre el dato anual para ver la tendencia, que el mensual da muchos saltos.`, foot: 'Variación mensual' },
      { t: 'cards', head: 'Lo que más sube', accent: up ? 'red' : 'green', cards: gr.map(g => ({ t: `${g.name}: ${pct(g.v)}`, b: g.prev != null ? `El mes pasado: ${pct(g.prev)}.` : 'Variación anual.' })), foot: 'Grupos con más inflación' },
      { t: 'point', kicker: 'Lo que notas tú', head: `Lo de 100 € ahora cuesta [[${eur(cesta)}]]`, body: `Con una inflación del ${pct(d.annual)}, lo que hace un año costaba 100 € cuesta hoy unos ${f(cesta, 2)} €. Si tu sueldo no ha subido igual, compras un poco menos.`, foot: 'Poder adquisitivo' },
      { t: 'steps', head: 'Qué puedes hacer', steps: [{ t: 'Mira tus gastos fijos', b: 'Luz, seguros y suscripciones suelen actualizarse.' }, { t: 'Compara tu sueldo', b: 'Con el IPC, para saber si pierdes poder de compra.' }, { t: 'Revisa dónde está tu ahorro', b: 'Cuánto te rinde frente a la inflación.' }], foot: 'Tres comprobaciones' },
      { t: 'close', head: '¿Lo notas en tu compra?', body: 'Cuéntamelo en los comentarios. Cada vez que sale un dato importante te lo explico el mismo día, sin tecnicismos.', extra: 'Dato: INE. Contenido informativo y educativo; no es asesoramiento financiero.', extraSize: 30 },
    ],
  };
} else {
  const up = d.prev != null ? d.value > d.prev : null;
  const m = d.mortgage;
  const dif = m.diff;
  item = {
    id: `euribor-${d.ym}`, label: 'Euríbor', accent: up ? 'red' : 'green',
    caption: `Euríbor de ${d.month} ${year}: ${pct(d.value, 2)} 🏠 Qué significa para tu hipoteca variable, con el dato del BCE y un ejemplo de cuota.\n\nDesliza para verlo.\n\n💾 Guárdalo para cuando revises tu hipoteca.`,
    tags: ['#euribor', '#hipoteca', '#finanzaspersonales'],
    sources: ['BCE (Euríbor a 12 meses, media mensual)', 'cálculo propio'],
    slides: [
      { t: 'cover', big: pct(d.value, 2), title: `Euríbor de [[${d.month}]]`, foot: 'Media mensual a 12 meses' },
      { t: 'stat', kicker: `Euríbor · ${d.month}`, big: pct(d.value, 2), color: up ? 'red' : 'green', head: d.prev == null ? 'Dato del mes' : up ? 'Sube respecto al mes anterior' : 'Baja respecto al mes anterior', body: d.prev != null ? `El mes pasado fue del ${pct(d.prev, 2)}. Es el índice al que se referencian muchas hipotecas variables.` : 'Es el índice al que se referencian muchas hipotecas variables.', foot: 'Dato del BCE' },
      ...(d.yago != null ? [{ t: 'point', kicker: 'Hace un año', head: `Antes estaba en [[${pct(d.yago, 2)}]]`, body: `Hace un año, el mismo mes, el Euríbor era del ${pct(d.yago, 2)}. Ahora está en el ${pct(d.value, 2)}.`, foot: 'Comparación anual' }] : [{ t: 'point', kicker: 'Qué es', head: 'El precio del [[dinero]] entre bancos', body: 'El Euríbor es el tipo al que los bancos europeos se prestan dinero a 12 meses. Tu banco lo usa de referencia.', foot: 'Lo básico' }]),
      { t: 'stat', kicker: `Hipoteca de ${eur(m.capital)} a ${m.years} años (Euríbor + ${m.spread} %)`, big: eur(m.now), color: 'accent', head: 'Cuota mensual aproximada', body: dif != null ? `Hace un año habría sido de ${eur(m.before)}: ${dif > 0 ? 'unos ' + eur(dif) + ' más' : dif < 0 ? 'unos ' + eur(-dif) + ' menos' : 'prácticamente igual'} al mes.` : 'Cálculo orientativo con la fórmula de cuota constante.', foot: 'Ejemplo orientativo' },
      { t: 'cards', head: 'Y según tu hipoteca', accent: 'green', cards: [{ t: 'Variable', b: 'Se revisa con el Euríbor: tu cuota puede cambiar.' }, { t: 'Fija', b: 'No cambia con el Euríbor mientras dure el tipo fijo.' }, { t: 'Mixta', b: 'Fija al inicio y variable después.' }], foot: 'Tres tipos' },
      { t: 'steps', head: 'Qué puedes hacer', steps: [{ t: 'Mira tu contrato', b: 'Qué índice y cuándo se revisa.' }, { t: 'Calcula tu cuota', b: 'Con el Euríbor actual y tu diferencial.' }, { t: 'Compara con el banco', b: 'Pide la oferta vinculante por escrito.' }], foot: 'Tres comprobaciones' },
      { t: 'close', head: '¿Tienes hipoteca variable?', body: 'Cuéntame en comentarios si ya notas el cambio. Cada mes te explico el dato el mismo día.', extra: 'Dato: BCE. Cálculo orientativo; cada banco aplica sus condiciones. Contenido educativo; no es asesoramiento financiero.', extraSize: 28 },
    ],
  };
}
fs.writeFileSync(dst, JSON.stringify(item, null, 2));
fs.writeFileSync('reaccion.key', d.key);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `skip=false\nkey=${d.key}\n`);
console.log('Carrusel de reacción listo:', item.id);
