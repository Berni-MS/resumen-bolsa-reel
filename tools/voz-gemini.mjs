// Guion de voz en off redactado por Gemini para las diapositivas que no traen `voz` escrito a mano.
// Uso (módulo): const n = await guionesGemini(item)  -> rellena sl.voz y devuelve cuántas diapositivas ha rellenado (0 si no hay clave o falla).
const MODELOS = [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'].filter(Boolean);

function limpiar(sl) {
  const { foot, accent, extraBold, extraSize, headSize, bigSize, color, voz, ...r } = sl;
  return r;
}
const nums = s => (String(s).match(/\d[\d.,]*\d|\d/g) || []).map(x => x.replace(/[.,]$/, ''));

export async function guionesGemini(item) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return 0;
  const faltan = item.slides.some(s => !s.voz);
  if (!faltan) return 0;
  const fuente = JSON.stringify(item.slides.map(limpiar));
  const prompt = `Eres el locutor de «Tu Amigo de las Finanzas», una cuenta educativa de finanzas personales para España. Hablas en español de España, con tuteo, tono cercano, claro y tranquilo.
Te paso las ${item.slides.length} diapositivas de un carrusel (JSON). Vas a escribir el guion de VOZ EN OFF de un vídeo que muestra esas diapositivas, una tras otra. El guion NO es una lectura literal del texto de la imagen: explícalo con tus palabras, con un hilo lógico entre diapositivas (conectores como «lo primero», «ahora», «ojo con esto», «por eso»), como lo contaría una persona que quiere que se entienda de verdad.
Reglas:
- Un texto por diapositiva, en el mismo orden. MUY CORTOS: diapositiva 1, gancho de 6 a 12 palabras; las demás, de 12 a 24 palabras (máximo 28). Todo el vídeo debe durar unos 40 segundos.
- Fluido y natural, como si se lo contaras a un amigo: frases cortas, lenguaje de calle, sin tono de locutor ni de lectura. Nada de enumerar con «primera, segunda, tercera» salvo que sea imprescindible; agrupa las ideas y quédate con lo esencial de cada diapositiva.
- Cubre lo esencial de cada diapositiva (las ideas clave, no cada detalle). Puedes reformular o añadir una frase breve que ayude a entenderlo, SIN introducir datos, cifras, fechas, leyes, porcentajes ni nombres que no estén en las diapositivas.
- Escribe las cifras tal como aparecen (por ejemplo 34 %, 3,5 %, 2.000 euros). No uses emojis, hashtags, viñetas ni comillas raras. Las siglas, tal cual (TAE, IRPF).
- Contenido educativo: nada de recomendar productos, comprar o vender, ni prometer rentabilidades. Mantén los matices y avisos de la fuente («es una referencia», «depende del caso»).
- La última diapositiva cierra con un llamamiento natural a guardar o compartir el vídeo, y termina con la frase exacta: «Contenido educativo, no es asesoramiento financiero.» Si la fuente cita fuentes de datos, di que aparecen en la última imagen.
Responde SOLO con JSON: {"voz":["texto diapositiva 1", ...]} con exactamente ${item.slides.length} textos.

DIAPOSITIVAS:
${fuente}`;
  const permitidas = new Set(nums(fuente).concat(nums(item.slides.map(s => s.voz || '').join(' '))));
  for (const modelo of [...new Set(MODELOS)]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, responseMimeType: 'application/json' } }),
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) { console.warn(`Gemini ${modelo}: HTTP ${r.status} ${(await r.text()).slice(0, 160).replace(key, '***')}`); continue; }
      const j = await r.json();
      const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      const out = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)).voz;
      if (!Array.isArray(out) || out.length !== item.slides.length || out.some(t => typeof t !== 'string' || t.split(/\s+/).length < 5 || t.split(/\s+/).length > 40)) { console.warn(`Gemini ${modelo}: respuesta con formato inválido`); continue; }
      const raros = out.flatMap(nums).filter(n => !permitidas.has(n) && !/^\d$/.test(n));
      if (raros.length) { console.warn(`Gemini ${modelo}: cifras que no están en la fuente (${raros.slice(0, 5).join(', ')}); se descarta`); continue; }
      let n = 0;
      item.slides.forEach((s, i) => { if (!s.voz) { s.voz = out[i].replace(/\s+/g, ' ').trim(); s.vozFuente = 'gemini'; n++; } });
      console.log(`Gemini (${modelo}): ${n} guiones de voz`);
      return n;
    } catch (e) { console.warn(`Gemini ${modelo} falló: ${String(e.message).replace(key, '***').slice(0, 160)}`); }
  }
  return 0;
}
