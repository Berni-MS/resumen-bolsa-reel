// Planning semanal en imagen (con el tema de cada publicación). Uso: node build-planning.mjs <salida.png> [lunes AAAA-MM-DD]
// Por defecto, la semana que empieza el próximo lunes. El horario replica los escenarios de Make: si cambias un horario allí, cámbialo aquí.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { addDays, dow } from './lib-datos.mjs';

const out = process.argv[2] || 'planning.png';
let lunes = process.argv[3];
if (!lunes) { let d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date()); do { d = addDays(d, 1); } while (dow(d) !== 1); lunes = d; }
const R = 'REEL', C = 'CARRUSEL', H = 'HISTORIA';
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const car = kind => ({ car: kind });
// [hora, tipo, nombre, tema (texto fijo o resolutor)]
const SCHED = [
  [['12:40', R, 'En 30 segundos', 'Tema de actualidad'], ['18:00', H, 'Palabra del día', { palabra: 1 }], ['19:20', C, 'Educativo', car('edu')]],
  [['07:40', R, 'Resumen Bolsa', 'Cierre de la sesión anterior'], ['14:00', C, 'Trámites y ayudas', car('tramites')], ['18:00', H, 'Palabra del día', { palabra: 1 }], ['20:10', C, 'Ahorro y presupuesto', car('ahorro')]],
  [['07:40', R, 'Resumen Bolsa', 'Cierre de la sesión anterior'], ['13:00', H, 'Calculadora de la semana', { calc: 1 }], ['14:00', C, 'Alerta estafa', car('estafas')], ['18:00', H, 'Palabra del día', { palabra: 1 }], ['19:20', C, '1.000 € hace N años', 'Cálculo con datos reales']],
  [['07:40', R, 'Resumen Bolsa', 'Cierre de la sesión anterior'], ['18:00', H, 'Palabra del día', { palabra: 1 }], ['19:20', C, 'Mitos y datos', car('mitos')]],
  [['07:40', R, 'Resumen Bolsa', 'Cierre de la sesión anterior'], ['14:00', C, 'Vida cotidiana', car('vida')], ['18:00', H, 'Palabra del día', { palabra: 1 }]],
  [['07:40', R, 'Resumen Bolsa', 'Cierre de la sesión anterior'], ['10:00', R, 'Un consejo para tu bolsillo', 'Consejo breve'], ['19:20', C, 'Vivienda', car('vivienda')]],
  [['10:30', C, 'La semana en datos', 'Resumen de la semana'], ['19:20', C, 'Calendario de la semana', 'Agenda económica']],
];

function tema(t, fecha) {
  if (typeof t === 'string') return { texto: t, fijo: false };
  try {
    if (t.car) {
      const f = `/tmp/plan-${t.car}-${fecha}.json`;
      try { fs.rmSync(f); } catch {}
      execFileSync('node', ['select-carousel.mjs', t.car, f], { env: { ...process.env, FECHA_SIMULADA: fecha }, stdio: 'pipe' });
      return { texto: fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).label : 'No toca esta semana', fijo: true };
    }
    if (t.palabra) {
      const list = JSON.parse(fs.readFileSync('data/palabras.json', 'utf8'));
      const [y, m, d] = fecha.split('-').map(Number);
      const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 9, 19)) / 86400000);
      const n = Math.floor(days / 7) * 5 + Math.min(Math.max(new Date(Date.UTC(y, m - 1, d)).getUTCDay() - 1, 0), 4);
      return { texto: list[((n % list.length) + list.length) % list.length].term, fijo: true };
    }
    if (t.pregunta) {
      const qs = JSON.parse(fs.readFileSync('data/preguntas.json', 'utf8'));
      const [y, m, d] = fecha.split('-').map(Number);
      const w = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 9, 18)) / (7 * 86400000));
      return { texto: String(qs[((w % qs.length) + qs.length) % qs.length]), fijo: true };
    }
    if (t.calc) {
      const f = `/tmp/plan-calc-${fecha}.json`;
      execFileSync('node', ['build-calculadora.mjs', f, fecha], { stdio: 'pipe' });
      const c = JSON.parse(fs.readFileSync(f, 'utf8'));
      return { texto: [c.title, c.accent].filter(Boolean).join(' '), fijo: true };
    }
  } catch (e) { console.warn('Tema no disponible:', e.message.split('\n')[0]); }
  return { texto: 'Por definir', fijo: false };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cls = { [R]: 'r', [C]: 'c', [H]: 'h' };
let nR = 0, nC = 0, nH = 0, cols = '';
SCHED.forEach((items, i) => {
  const fecha = addDays(lunes, i), dn = Number(fecha.slice(8));
  const rows = items.map(([hora, tipo, nombre, t]) => {
    if (tipo === R) nR++; else if (tipo === C) nC++; else nH++;
    const tm = tema(t, fecha);
    return `<div class="it"><div class="t">${hora}</div><span class="b ${cls[tipo]}">${tipo}</span><div class="n">${esc(nombre)}</div><div class="tm ${tm.fijo ? 'f' : ''}">${esc(tm.texto)}</div></div>`;
  }).join('');
  cols += `<div class="col"><h2>${DIAS[i]} ${dn}</h2>${rows}</div>`;
});
const fin = addDays(lunes, 6);
const rango = `${Number(lunes.slice(8))} ${MESES[Number(lunes.slice(5, 7)) - 1]} – ${Number(fin.slice(8))} ${MESES[Number(fin.slice(5, 7)) - 1]}`;
const doms = [...Array(7)].map((_, i) => Number(addDays(lunes, i).slice(8)));
const notas = [];
if (doms.some(d => d >= 2 && d <= 12)) notas.push('Euríbor: si hay dato nuevo, carrusel 12:30');
if (doms.some(d => d >= 12 && d <= 19)) notas.push('IPC: si hay dato nuevo, carrusel 12:30 (y su historia)');

// Fuentes de la marca (incrustadas, como en los vídeos)
const base = path.resolve('node_modules/@fontsource');
const faces = [];
for (const [pkg, fam, ws] of [['big-shoulders-display', 'Big Shoulders Display', [800]], ['hanken-grotesk', 'Hanken Grotesk', [500, 700]]]) for (const w of ws) {
  const f = path.join(base, pkg, 'files', `${pkg}-latin-${w}-normal.woff2`);
  if (fs.existsSync(f)) faces.push(`@font-face{font-family:'${fam}';font-weight:${w};src:url('data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}') format('woff2');}`);
}
const html = `<html><head><meta charset="utf-8"><style>${faces.join('\n')}
*{box-sizing:border-box;margin:0}body{width:2400px;height:1500px;background:#0F1B33;color:#fff;font-family:'Hanken Grotesk',Arial,sans-serif;padding:60px 70px}
h1{font-family:'Big Shoulders Display','Arial Narrow',sans-serif;font-size:112px;font-weight:800;line-height:1}h1 em{color:#35D07F;font-style:normal}
.sub{color:#9FB0CC;font-size:28px;font-weight:700;margin:8px 0 28px}
.grid{display:flex;gap:14px}.col{flex:1;background:#16264A;border-radius:22px;padding:22px 18px;height:1090px;min-width:0}
h2{color:#35D07F;font-size:34px;font-weight:700;padding-bottom:10px;border-bottom:2px solid #0F1B33;margin-bottom:6px}
.it{padding:9px 0;border-bottom:1px solid #0F1B33}.t{font-size:29px;font-weight:700;display:inline-block;margin-right:8px}.n{font-size:22px;color:#DCE5F5;margin-top:2px;line-height:1.15;font-weight:500}
.tm{font-size:21px;color:#9FB0CC;margin-top:2px;line-height:1.15}.tm.f{color:#fff;font-weight:700;font-size:23px}
.b{display:inline-block;font-size:14px;font-weight:700;letter-spacing:.5px;padding:2px 10px;border-radius:10px;color:#0F1B33;vertical-align:4px}
.r{background:#FF5247}.c{background:#35D07F}.h{background:#9FB0CC}
.foot{margin-top:22px;color:#9FB0CC;font-size:22px;line-height:1.4}
</style></head><body><h1>Planning <em>${rango}</em></h1>
<div class="sub">@tuamigodelasfinanzas · horario de Madrid · ${nR} reels · ${nC} carruseles · ${nH} historias · en negrita, el tema ya fijado</div>
<div class="grid">${cols}</div>
<div class="foot">Cada carrusel lleva una historia de aviso a los pocos minutos. ${notas.join(' · ')}${notas.length ? ' · ' : ''}Los vídeos de TikTok llegan a Telegram: 09:00 (mar–sáb), 13:30 (lun), 21:30 (diario) y al instante los carruseles elegidos.</div></body></html>`;
if (process.env.DUMP_HTML) { fs.writeFileSync(process.env.DUMP_HTML, html); console.log('HTML guardado'); process.exit(0); }
const { chromium } = await import('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2400, height: 1500 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: out });
await browser.close();
console.log(`Planning ${rango}: ${out}`);
