// Duración recomendada de una historia según el texto que hay que leer.
// Instagram muestra las imágenes fijas solo 5 s; por eso las historias se publican como vídeo con esta duración.
// Cálculo: 4 s para situarse + 1 s cada 4 palabras (lectura cómoda en el móvil, unas 240 ppm); mínimo 8 s y máximo 15 s (un tramo de historia).
export function storySeconds(text, { min = 8, max = 15 } = {}) {
  const words = (String(text).match(/[\p{L}\p{N}][\p{L}\p{N}.,%€$/·:+−-]*/gu) || []).length;
  return { words, seconds: Math.min(max, Math.max(min, Math.round(4 + words / 4))) };
}
