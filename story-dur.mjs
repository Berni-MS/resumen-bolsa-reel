// Duración recomendada de una historia según el texto que hay que leer.
// Instagram muestra las imágenes fijas solo 5 s; por eso las historias se publican como vídeo con esta duración.
// Decisión: todas las historias duran 15 s (un tramo completo de historia); las palabras solo se usan para informar.
export function storySeconds(text, { min = 15, max = 15 } = {}) {
  const words = (String(text).match(/[\p{L}\p{N}][\p{L}\p{N}.,%€$/·:+−-]*/gu) || []).length;
  return { words, seconds: Math.min(max, Math.max(min, Math.round(4 + words / 4))) };
}
