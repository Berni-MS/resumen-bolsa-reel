#!/usr/bin/env node
// Imprime la ruta de la pista de fondo para un tipo/tema. Uso: node tools/musica.mjs <tipo>
import { pistaMusica } from '../subs-lib.mjs';
console.log(pistaMusica(process.argv[2] || 'neutral') || 'assets/music.mp3');
