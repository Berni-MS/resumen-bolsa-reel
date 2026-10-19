// Genera el kit de marca: portadas de destacados (1080x1920) y foto de perfil (1080x1080).
// Uso: node brand/build-brand.mjs [carpeta_salida]   (por defecto brand/out)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const out = path.resolve(process.argv[2] || 'brand/out');
fs.mkdirSync(out, { recursive: true });
const INK = '#0F1B33', GREEN = '#35D07F', RED = '#FF5247', CARD = '#16264A';

// Iconos en una caja de 200x200 (trazo redondeado)
const ICONS = {
  empieza: `<path d="M62 28 V178"/><path d="M62 40 L158 66 L62 96 Z" fill="currentColor" fill-opacity=".18"/><path d="M40 178 H100"/>`,
  bolsa: `<path d="M22 176 H182"/><path d="M24 142 L72 96 L108 124 L168 54"/><path d="M134 52 H170 V88"/>`,
  ahorro: `<ellipse cx="100" cy="58" rx="56" ry="18"/><path d="M44 58 V90 A56 18 0 0 0 156 90 V58"/><path d="M44 90 V122 A56 18 0 0 0 156 122 V90"/><path d="M44 122 V154 A56 18 0 0 0 156 154 V122"/>`,
  vivienda: `<path d="M24 98 L100 34 L176 98"/><path d="M48 84 V164 H152 V84"/><path d="M84 164 V118 H116 V164"/>`,
  estafas: `<path d="M100 22 L168 48 V102 C168 142 136 166 100 180 C64 166 32 142 32 102 V48 Z" fill="currentColor" fill-opacity=".12"/><path d="M100 70 V112"/><circle cx="100" cy="138" r="4" fill="currentColor"/>`,
  renta: `<path d="M54 24 H126 L156 54 V176 H54 Z" fill="currentColor" fill-opacity=".12"/><path d="M126 24 V54 H156"/><circle cx="82" cy="94" r="10"/><circle cx="128" cy="142" r="10"/><path d="M130 88 L78 148"/>`,
  calculadoras: `<rect x="44" y="24" width="112" height="152" rx="16" fill="currentColor" fill-opacity=".12"/><rect x="60" y="40" width="80" height="32" rx="6"/><g fill="currentColor" stroke="none"><circle cx="72" cy="102" r="7"/><circle cx="100" cy="102" r="7"/><circle cx="128" cy="102" r="7"/><circle cx="72" cy="130" r="7"/><circle cx="100" cy="130" r="7"/><circle cx="128" cy="130" r="7"/><circle cx="72" cy="156" r="7"/><circle cx="100" cy="156" r="7"/><circle cx="128" cy="156" r="7"/></g>`,
  guias: `<path d="M100 56 C80 38 50 35 26 42 V152 C50 145 80 148 100 166 C120 148 150 145 174 152 V42 C150 35 120 38 100 56 Z" fill="currentColor" fill-opacity=".12"/><path d="M100 56 V166"/>`,
};
const COVERS = [
  ['01-empieza-aqui', 'empieza', GREEN], ['02-bolsa', 'bolsa', GREEN], ['03-ahorro', 'ahorro', GREEN], ['04-vivienda', 'vivienda', GREEN],
  ['05-estafas', 'estafas', RED], ['06-renta', 'renta', GREEN], ['07-calculadoras', 'calculadoras', GREEN], ['08-guias', 'guias', GREEN],
];
const cover = (icon, color) => `<!doctype html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
<rect width="1080" height="1920" fill="${INK}"/>
<circle cx="540" cy="960" r="420" fill="${CARD}"/>
<circle cx="540" cy="960" r="420" fill="none" stroke="${color}" stroke-width="14" stroke-opacity=".9"/>
<g transform="translate(${540 - 100 * 2.5} ${960 - 100 * 2.5}) scale(2.5)" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" color="${color}">${ICONS[icon]}</g>
</svg></body>`;
const avatar = `<!doctype html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
<rect width="1080" height="1080" fill="${INK}"/>
<circle cx="540" cy="540" r="372" fill="${CARD}"/>
<circle cx="540" cy="540" r="372" fill="none" stroke="${GREEN}" stroke-width="30"/>
<text x="540" y="540" text-anchor="middle" dominant-baseline="central" font-family="'Big Shoulders Display','Arial Narrow','Liberation Sans Narrow',sans-serif" font-weight="900" font-size="560" fill="${GREEN}">€</text>
</svg></body>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, icon, color] of COVERS) {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.setContent(cover(icon, color));
  await page.screenshot({ path: path.join(out, `destacado-${name}.png`) });
}
await page.setViewportSize({ width: 1080, height: 1080 });
await page.setContent(avatar);
await page.screenshot({ path: path.join(out, 'foto-de-perfil.png') });
await browser.close();
console.log(`Kit de marca generado en ${out}: ${COVERS.length} portadas y la foto de perfil`);
