// Historia/vídeo de la palabra del día: imagen con zoom suave + subtítulos + voz + música con ducking + volumen normalizado.
// Uso: node tools/historia-video.mjs story.png voz.mp3 voz.txt <duración> story.mp4
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assDe, fuente, pistaMusica } from '../subs-lib.mjs';
const [img, voz, txt, durS, out] = process.argv.slice(2);
const DUR = Number(durS);
const SUBS = process.env.SUBS === 'true';
const vd = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voz]).toString().trim());
const music = pistaMusica('palabra') || path.resolve('assets/music.mp3');
const tmp = fs.mkdtempSync('hv-');
try {
  const fu = fuente(path.join(tmp, 'fonts'));
  const text = fs.readFileSync(txt, 'utf8').replace(/\s+/g, ' ').trim();
  const ass = path.join(tmp, 's.ass');
  fs.writeFileSync(ass, assDe([{ start: 0.7, dur: vd, text }], { yBase: 1520, fontName: fu.name, size: 56 }));
  const F = Math.round(DUR * 30);
  const fc = `[0:v]scale=2160:-1,zoompan=z='1+0.04*on/${F}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${F}:s=1080x1920:fps=30,${SUBS ? 'scale=886:1574,pad=1080:1920:97:100:color=0x0F1B33,' : ''}format=yuv420p[z];` +
    (SUBS ? `[z]ass='${ass}':fontsdir='${fu.dir}'[vs];` : `[z]null[vs];`) +
    `[1:a]volume=0.5,afade=t=in:d=0.5,afade=t=out:st=${DUR - 1.5}:d=1.5[m];[2:a]adelay=700|700,volume=1.6,asplit=2[v][k];` +
    `[m][k]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];[md][v]amix=inputs=2:duration=first:normalize=0,apad,atrim=0:${DUR},loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', img, '-stream_loop', '-1', '-t', String(DUR), '-i', music, '-i', voz, '-filter_complex', fc, '-map', '[vs]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '128k', '-t', String(DUR), '-movflags', '+faststart', out], { stdio: 'inherit' });
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
