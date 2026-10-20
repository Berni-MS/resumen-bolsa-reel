// Guion hablado del reel de bolsa, por pantalla. Devuelve { '01-variacion': 'texto', ... } con números ya escritos para voz.
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const NOMBRE = { SPY: 'el S&P 500', IBEX: 'el IBEX 35', QQQ: 'el Nasdaq 100', DIA: 'el Dow Jones' };
const NOMBRE_VOZ = { SPY: 'el ese y pe quinientos', IBEX: 'el Íbex treinta y cinco', QQQ: 'el Nasdaq cien', DIA: 'el Dow Jones' };
const PRON = { IBM: 'I B M', AMD: 'A M D', AMZN: 'Amazon', NRG: 'N R G', FMC: 'F M C', CEG: 'Constellation Energy', WDC: 'Western Digital', SNDK: 'Sandisk' };

const n1 = x => Math.abs(x).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace(/,0$/, '');
const n2 = x => Math.abs(x).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// «6,1 por ciento»: se deja la coma para que la voz diga «seis coma uno»
const por = x => `${n1(x)} por ciento`;
const verbo = (x, pl) => (x > 0 ? (pl ? 'suben' : 'sube') : (pl ? 'caen' : 'cae'));
const spell = s => String(s).split(/\s+/).map(w => (/^[A-Z]{2,5}$/.test(w) && !/^(ETF|IBEX)$/.test(w) ? (PRON[w] || w.split('').join(' ')) : w)).join(' ');
const SUF = /\s+(Corporation|Company|Companies|Incorporated|Inc\.?|Corp\.?|Co\.?|Group|Holdings)$/i;
const nombre = r => { const n = String(r.name).replace(SUF, ''); return PRON[r.ticker] && !/\s/.test(n) ? PRON[r.ticker] : spell(n); };
const junta = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a.at(-1) : (a[0] || '');
const lower1 = s => s.charAt(0).toLowerCase() + s.slice(1);
const sinPunto = s => String(s).trim().replace(/[.\s]+$/, '');

function fechaVoz(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

export function vozBolsa(d, isoDate, ayer = true) {
  const idx = Object.fromEntries(d.indices.map(i => [i.ticker, i]));
  const orden = ['SPY', 'IBEX', 'QQQ', 'DIA'].filter(k => idx[k]);
  const plano = x => Math.abs(x) < 0.1;
  const frase = k => {
    const i = idx[k];
    if (plano(i.chg)) return `${NOMBRE_VOZ[k]} se queda prácticamente plano`;
    return `${NOMBRE_VOZ[k]} ${verbo(i.chg)} un ${por(i.chg)}`;
  };
  const seg = {};

  // 1) Apertura: fecha, índices y lo que más llama la atención
  const mayor = orden.slice().sort((a, b) => Math.abs(idx[b].chg) - Math.abs(idx[a].chg))[0];
  const signos = new Set(orden.filter(k => !plano(idx[k].chg)).map(k => Math.sign(idx[k].chg)));
  let destaca = '';
  if (signos.size > 1) destaca = 'Una jornada con índices en direcciones distintas.';
  else if (!plano(idx[mayor].chg)) destaca = `Destaca ${NOMBRE_VOZ[mayor]}, con un ${idx[mayor].chg > 0 ? 'avance' : 'descenso'} del ${por(idx[mayor].chg)}.`;
  else destaca = 'Una jornada tranquila, sin grandes movimientos.';
  seg['01-variacion'] = `Os traigo el resumen de la bolsa de ${ayer ? 'ayer, ' : ''}${fechaVoz(isoDate)}. ${destaca} ${junta(orden.filter(k => k !== mayor || plano(idx[k].chg)).map(frase)).replace(/^./, c => c.toUpperCase())}.`;

  // 2-5) Rankings: los tres primeros de cada lista, con nombre y variación
  const lista = (k, tipo) => {
    const rows = (d.lists[k] || {})[tipo] || [];
    const r3 = rows.slice(0, 2).map(r => `${nombre(r)}, con un ${n1(r.chg)}`);
    return r3.length ? r3.join('; ').replace(/; ([^;]*)$/, '; y $1') + ' por ciento' : '';
  };
  const L = { SPY: 'S&P 500', IBEX: 'IBEX 35', QQQ: 'Nasdaq 100' };
  const second = d.lists.IBEX ? 'IBEX' : 'QQQ';
  const rows = (k, t) => ((d.lists[k] || {})[t] || []);
  const nom = k => ({ SPY: 'el ese y pe quinientos', IBEX: 'el Íbex', QQQ: 'el Nasdaq cien' }[k]);
  const top = (k, t) => rows(k, t)[0];
  seg['02-spy-subidas'] = rows('SPY', 'gainers').length
    ? `Entre las empresas del ese y pe quinientos, suben ${lista('SPY', 'gainers')}.` : '';
  seg['03-spy-bajadas'] = rows('SPY', 'losers').length
    ? `Y caen ${lista('SPY', 'losers')}.` : '';
  const s2 = second.toLowerCase();
  seg[`04-${s2}-subidas`] = rows(second, 'gainers').length
    ? `En ${nom(second)}, lideran las subidas ${lista(second, 'gainers')}.` : '';
  seg[`05-${s2}-bajadas`] = rows(second, 'losers').length
    ? `Y entre las que más ceden, ${lista(second, 'losers')}.` : '';

  // 6) Motivos: factores al alza y a la baja, con su explicación
  const fs_ = d.factors || [];
  const up = fs_.filter(f => f.dir === 'up'), dn = fs_.filter(f => f.dir !== 'up');
  const exp = f => `${lower1(sinPunto(f.title))}: ${lower1(sinPunto(f.text))}.`;
  const CU = ['Por un lado, ', 'Además, '], CD = ['Por otro lado, ', 'Y también, '];
  const corto = f => (f.title + ' ' + f.text).split(/\s+/).length <= 24;
  const ups = up.slice(0, 1).concat(up.slice(1, 2).filter(corto));
  const partes = [...ups.map((f, i) => CU[i] + exp(f)), ...dn.slice(0, 1).map((f, i) => CD[i] + exp(f))];
  seg['08-factores'] = `¿Y por qué se ha movido así el mercado? ${partes.join(' ')} Son los motivos que han podido influir. Información, no asesoramiento financiero.`.replace(/\s+/g, ' ');
  return seg;
}
