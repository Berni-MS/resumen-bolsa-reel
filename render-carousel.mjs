// Genera las 7 diapositivas (JPEG 1080x1350) y el texto de un carrusel.
// Uso: node render-carousel.mjs <item.json> <outDir>
import fs from 'node:fs';
import { ctaBlock } from './cta.mjs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const item = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = path.resolve(process.argv[3] || 'out');
fs.mkdirSync(outDir, { recursive: true });

const INK = '#0F1B33', GREEN = '#35D07F', RED = '#FF5247', MUTED = '#9FB0CC', CARD = '#16264A', SOFT = '#DCE5F5';
const N = item.slides.length;
if (N < 2 || N > 10) throw new Error('El carrusel debe tener entre 2 y 10 diapositivas');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// [[palabra]] resalta con el color de acento
const rich = (s, accent) => esc(s).replace(/\[\[(.+?)\]\]/g, `<span style="color:${accent}">$1</span>`);

function fontFace() {
  const base = path.resolve('node_modules/@fontsource');
  const faces = [];
  const add = (pkg, family, weights) => {
    for (const w of weights) {
      const f = path.join(base, pkg, 'files', `${pkg}-latin-${w}-normal.woff2`);
      if (fs.existsSync(f)) faces.push(`@font-face{font-family:'${family}';font-weight:${w};src:url('data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}') format('woff2');}`);
    }
  };
  add('big-shoulders-display', 'Big Shoulders Display', [800, 900]);
  add('hanken-grotesk', 'Hanken Grotesk', [500, 700]);
  if (!faces.length) console.warn('AVISO: fuentes no encontradas; se usa una fuente provisional.');
  return faces.join('\n');
}
const DISPLAY = `'Big Shoulders Display','Arial Narrow','Liberation Sans Narrow',sans-serif`;
const BODY = `'Hanken Grotesk','Helvetica Neue',Arial,sans-serif`;
const px = (n) => `calc(${n}px * var(--s))`;

function body(sl, accent) {
  const A = accent;
  switch (sl.t) {
    case 'cover':
      return `<div style="display:flex;flex-direction:column;gap:${px(36)}">
        <div class="d" style="font-size:${px(sl.bigSize || 300)};line-height:.85;color:${A}">${esc(sl.big)}</div>
        <div class="d" style="font-size:${px(120)};line-height:1.1">${rich(sl.title, A)}</div></div>`;
    case 'point':
      return `<div style="display:flex;flex-direction:column;gap:${px(38)}">
        ${sl.kicker ? `<div style="font-size:${px(40)};font-weight:700;color:${MUTED}">${esc(sl.kicker)}</div>` : ''}
        <div class="d" style="font-size:${px(sl.headSize || 150)};line-height:1.1">${rich(sl.head, A)}</div>
        <div style="font-size:${px(44)};line-height:1.35;font-weight:500;color:${SOFT}">${esc(sl.body)}</div>
        ${sl.note ? `<div style="background:${CARD};border-radius:24px;padding:${px(32)} ${px(36)};font-size:${px(36)};line-height:1.3;color:${MUTED}">${esc(sl.note)}</div>` : ''}</div>`;
    case 'cards':
      return `<div style="display:flex;flex-direction:column;gap:${px(32)}">
        <div class="d" style="font-size:${px(130)};line-height:1.1;color:${sl.accent === 'red' ? RED : GREEN}">${esc(sl.head)}</div>
        ${sl.cards.map(c => `<div style="background:${CARD};border-radius:24px;padding:${px(28)} ${px(36)}"><div style="font-size:${px(46)};font-weight:700">${esc(c.t)}</div><div style="font-size:${px(34)};line-height:1.3;color:${MUTED};margin-top:8px">${esc(c.b)}</div></div>`).join('')}</div>`;
    case 'agenda': {
      const dot = k => (k >= 3 ? RED : GREEN);
      return `<div style="display:flex;flex-direction:column;gap:${px(26)}">
        ${sl.kicker ? `<div style="font-size:${px(40)};font-weight:700;color:${MUTED}">${esc(sl.kicker)}</div>` : ''}
        <div class="d" style="font-size:${px(130)};line-height:1.1">${rich(sl.head, A)}</div>
        ${sl.rows.map(r => `<div style="background:${CARD};border-radius:24px;padding:${px(26)} ${px(34)};display:flex;gap:${px(30)};align-items:center">
          <div style="flex:none;width:${px(150)};text-align:left"><div class="d" style="font-size:${px(66)};line-height:1.08;color:${dot(r.k)}">${esc(r.d)}</div>${r.t ? `<div style="font-size:${px(32)};font-weight:700;color:${MUTED}">${esc(r.t)}</div>` : ''}</div>
          <div style="font-size:${px(42)};line-height:1.2;font-weight:700">${esc(r.n)}</div></div>`).join('')}</div>`;
    }
    case 'steps':
      return `<div style="display:flex;flex-direction:column;gap:${px(30)}">
        <div class="d" style="font-size:${px(130)};line-height:1.1">${rich(sl.head, A)}</div>
        ${sl.steps.map((c, i) => `<div style="display:flex;gap:28px;align-items:center"><div style="flex:none;width:${px(84)};height:${px(84)};border-radius:50%;background:${GREEN};color:${INK};font-weight:700;font-size:${px(44)};display:flex;align-items:center;justify-content:center">${i + 1}</div><div><div style="font-size:${px(42)};font-weight:700">${esc(c.t)}</div><div style="font-size:${px(32)};line-height:1.25;color:${MUTED}">${esc(c.b)}</div></div></div>`).join('')}</div>`;
    case 'stat':
      return `<div style="display:flex;flex-direction:column;gap:${px(30)}">
        ${sl.kicker ? `<div style="font-size:${px(40)};font-weight:700;color:${MUTED}">${esc(sl.kicker)}</div>` : ''}
        <div class="d" style="white-space:nowrap;font-size:${px(sl.bigSize || 260)};line-height:.9;color:${sl.color === 'green' ? GREEN : sl.color === 'red' ? RED : A}">${esc(sl.big)}</div>
        <div class="d" style="font-size:${px(88)};line-height:1.1">${rich(sl.head, A)}</div>
        <div style="font-size:${px(42)};line-height:1.33;font-weight:500;color:${SOFT}">${esc(sl.body)}</div></div>`;
    case 'myth':
      return `<div style="display:flex;flex-direction:column;gap:${px(36)}">
        <div style="font-size:${px(36)};font-weight:700;color:${RED}">MITO</div>
        <div class="d" style="font-size:${px(140)};line-height:1.1">${esc(sl.myth)}</div>
        <div style="font-size:${px(36)};font-weight:700;color:${GREEN};margin-top:${px(20)}">REALIDAD</div>
        <div style="font-size:${px(42)};line-height:1.3;font-weight:500;color:${SOFT}">${esc(sl.reality)}</div></div>`;
    case 'close':
      return `<div style="display:flex;flex-direction:column;gap:${px(40)}">
        <div class="d" style="font-size:${px(sl.headSize || 170)};line-height:1.1">${rich(sl.head, A)}</div>
        <div style="font-size:${px(44)};line-height:1.35;font-weight:500;color:${SOFT}">${esc(sl.body)}</div>
        ${sl.extra ? `<div style="background:${CARD};border-radius:24px;padding:${px(32)} ${px(36)};font-size:${px(sl.extraSize || 34)};line-height:1.35;font-weight:${sl.extraBold ? 700 : 500};color:${sl.extraBold ? '#fff' : MUTED}">${esc(sl.extra)}</div>` : ''}</div>`;
    default: throw new Error('Tipo de diapositiva desconocido: ' + sl.t);
  }
}

const mythCount = item.slides.filter(x => x.t === 'myth').length;
function labelFor(sl, i) {
  if (sl.label) return sl.label;
  if (sl.t === 'myth' && mythCount > 1) return `Mito ${item.slides.slice(0, i + 1).filter(x => x.t === 'myth').length} de ${mythCount}`;
  return item.label || '';
}

function html(sl, i) {
  const accent = item.accent === 'red' ? RED : GREEN;
  const isClose = sl.t === 'close';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
${fontFace()}
*{box-sizing:border-box}body{margin:0}
:root{--s:1}
.root{width:1080px;height:1350px;padding:90px 80px;background:${INK};color:#fff;font-family:${BODY};display:flex;flex-direction:column;gap:24px;overflow:hidden}
.d{font-family:${DISPLAY};font-weight:900}
.top{display:flex;justify-content:space-between;font-size:30px;font-weight:700;color:${MUTED};flex:none}
.mid{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
.bot{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex:none;font-weight:700;color:${MUTED}}
</style></head><body><div class="root">
<div class="top"><span>@tuamigodelasfinanzas</span><span>${esc(labelFor(sl, i))}</span></div>
<div class="mid" id="mid">${body(sl, accent)}</div>
<div class="bot"><span style="font-size:${isClose ? 28 : 32}px;line-height:1.3;font-weight:${isClose ? 500 : 700};max-width:850px">${esc(sl.foot || '')}</span><span style="font-size:32px;color:${GREEN}">${i + 1}/${N}</span></div>
</div></body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
const warnings = [];
for (let i = 0; i < N; i++) {
  await page.setContent(html(item.slides[i], i), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  let s = 1;
  for (; s >= 0.55; s -= 0.05) {
    await page.evaluate(v => document.documentElement.style.setProperty('--s', v), s.toFixed(2));
    const over = await page.evaluate(() => {
      const m = document.getElementById('mid');
      if (m.scrollHeight > m.clientHeight + 1) return true;
      return [...m.querySelectorAll('*')].some(e => e.scrollWidth > e.clientWidth + 1 && e.children.length === 0 ? true : (e.scrollWidth > m.clientWidth + 1));
    });
    if (!over) break;
  }
  if (s < 0.55) warnings.push(`Diapositiva ${i + 1}: el texto no cabe`);
  else if (s < 1) console.log(`Diapositiva ${i + 1}: texto reducido a escala ${s.toFixed(2)}`);
  await page.screenshot({ path: path.join(outDir, `${String(i + 1).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 92 });
}
await browser.close();

// Texto de la publicación
const legal = 'ℹ️ Contenido informativo y educativo. No es asesoramiento financiero ni una recomendación de compra o venta.';
const src = item.sources && item.sources.length ? '\n\nFuentes: ' + item.sources.join(' · ') : '';
const tags = [...new Set([...(item.tags || []), '#tuamigodelasfinanzas'])].join(' ');
const kindArg = process.env.CAROUSEL_KIND || '';
const caption = `${item.caption}${src}\n\n${ctaBlock(item.caption, kindArg, item.id || '')}\n\n${legal}\n\n${tags}`;
fs.writeFileSync(path.join(outDir, 'caption.txt'), caption);
console.log(`Texto: ${caption.length} caracteres`);
if (caption.length > 2200) warnings.push(`Texto demasiado largo (${caption.length})`);
if ((caption.match(/#/g) || []).length > 30) warnings.push('Más de 30 hashtags');
if (warnings.length) { console.error(warnings.join('\n')); process.exit(1); }
