#!/usr/bin/env python3
"""Genera pistas de fondo originales (sintetizadas, sin derechos) en assets/music/<tipo>-N.mp3. Uso: python3 tools/gen-musica.py [carpeta_salida]"""
import numpy as np, subprocess, sys, os
from scipy.signal import fftconvolve, butter, sosfilt
SR = 48000
out = sys.argv[1] if len(sys.argv) > 1 else 'assets/music'
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(7)
NOTE = {n: i for i, n in enumerate(['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'])}
def hz(n, o): return 440.0 * 2 ** ((NOTE[n] + 12 * (o - 4) - 9) / 12)
CH = {'maj7': [0,4,7,11], 'm7': [0,3,7,10], 'maj': [0,4,7], 'min': [0,3,7], '7': [0,4,7,10], 'sus': [0,5,7]}
def chord(root, kind, o): return [hz(root, o) * 2 ** (i / 12) for i in CH[kind]]
def lp(x, f, order=2): return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)
def env(n, a, d, sus=0.0):
    t = np.arange(n) / SR
    e = np.minimum(t / max(a, 1e-4), 1) * (sus + (1 - sus) * np.exp(-t / d))
    return e
def epiano(f, dur, vel=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2*np.pi*f*t) + 0.45*np.sin(2*np.pi*2*f*t)*np.exp(-t/0.25) + 0.15*np.sin(2*np.pi*3*f*t)*np.exp(-t/0.12) + 0.3*np.sin(2*np.pi*f*t*1.003)
    return vel * s * env(n, 0.006, 0.55)
def pluck(f, dur, vel=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2*np.pi*f*k*t) / k for k in (1, 2, 3, 4)) * np.exp(-t / 0.18)
    return vel * lp(s, 3800) * env(n, 0.003, 0.4)
def pad(freqs, dur, vel=0.25):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for f in freqs:
        for det in (-0.004, 0.0, 0.004):
            s += np.sin(2*np.pi*f*(1+det)*t) + 0.3*np.sin(2*np.pi*2*f*(1+det)*t)
    e = np.minimum(t / 0.45, 1) * np.minimum((dur - t) / 0.5, 1)
    return vel * lp(s / (len(freqs) * 3), 2200) * np.clip(e, 0, 1)
def bass(f, dur, vel=0.6):
    n = int(dur * SR); t = np.arange(n) / SR
    return vel * (np.sin(2*np.pi*f*t) + 0.25*np.sin(2*np.pi*2*f*t)) * env(n, 0.01, 0.7, 0.25) * np.minimum((dur - t) / 0.05, 1)
def kick(vel=0.9):
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 45 + 90 * np.exp(-t / 0.035); ph = 2*np.pi*np.cumsum(f) / SR
    return vel * np.sin(ph) * np.exp(-t / 0.12)
def hat(vel=0.18, open_=False):
    n = int((0.25 if open_ else 0.06) * SR); t = np.arange(n) / SR
    return vel * hp(rng.standard_normal(n), 7000) * np.exp(-t / (0.09 if open_ else 0.018))
def clap(vel=0.35):
    n = int(0.2 * SR); t = np.arange(n) / SR
    return vel * hp(lp(rng.standard_normal(n), 3500), 900) * np.exp(-t / 0.05)
def add(buf, x, pos, pan=0.0):
    pos = int(pos * SR); n = len(buf)
    for k in range(len(x)):
        pass
    end = pos + len(x)
    seg = x[: max(0, min(len(x), n + 0 - pos))] if end > n else x
    # circular: lo que se sale del final vuelve al principio (bucle limpio)
    for i0 in range(0, len(x), 1 << 30): pass
    idx = (np.arange(len(x)) + pos) % n
    buf[0][idx] += x * (1 - max(pan, 0) * 0.6)
    buf[1][idx] += x * (1 + min(pan, 0) * 0.6)
def reverb(buf, mix=0.18, sec=1.1):
    ir = rng.standard_normal(int(sec * SR)) * np.exp(-np.arange(int(sec * SR)) / (0.28 * SR)); ir = lp(ir, 5000) / 40
    for c in (0, 1):
        w = fftconvolve(buf[c], ir)[: len(buf[c])]
        w2 = fftconvolve(buf[c], ir)[len(buf[c]):]
        w[: len(w2)] += w2[: len(w)]  # cola envuelta
        buf[c] = buf[c] * (1 - mix) + w * mix
def render(name, p):
    bpm = p['bpm']; beat = 60 / bpm; bar = 4 * beat; bars = p['bars']; total = bars * bar
    buf = [np.zeros(int(total * SR)), np.zeros(int(total * SR))]
    prog = p['prog']; sw = p.get('swing', 0.0)
    for b in range(bars):
        root, kind = prog[b % len(prog)]; t0 = b * bar; ch3 = chord(root, kind, p.get('oct', 3))
        ch4 = chord(root, kind, 4)
        if p.get('pad', True): add(buf, pad(ch3 + [ch4[0]], bar + 0.1, p.get('padvel', 0.25)), t0, -0.2)
        add(buf, bass(hz(root, 2), bar if p.get('longbass') else beat * 1.8, p.get('bassvel', 0.6)), t0)
        if p.get('bass8'):
            for k in range(1, 8): add(buf, bass(hz(root, 2), beat * 0.4, 0.45), t0 + k * beat / 2)
        style = p['style']
        if style == 'arp':
            seq = [0, 1, 2, 3, 2, 1, 2, 1] if len(ch4) > 3 else [0, 1, 2, 1, 0, 1, 2, 1]
            for k in range(8): add(buf, epiano(ch4[seq[k] % len(ch4)] * (2 if k % 4 == 3 else 1), beat * 0.9, p.get('vel', 0.28)), t0 + k * beat / 2 + (sw * beat / 2 if k % 2 else 0), 0.25)
        elif style == 'pluck16':
            seq = [0, 2, 1, 2]
            for k in range(16): add(buf, pluck(ch4[seq[k % 4] % len(ch4)] * (2 if k % 8 == 6 else 1), beat * 0.5, p.get('vel', 0.22)), t0 + k * beat / 4, 0.3 if k % 2 else -0.3)
        elif style == 'stab':
            for k in (0, 1.5, 3): add(buf, epiano(ch4[1], beat * 0.9, 0.3), t0 + k * beat, 0.2); add(buf, epiano(ch4[2], beat * 0.9, 0.25), t0 + k * beat, -0.2)
        elif style == 'bells':
            for k in range(4): add(buf, epiano(ch4[k % len(ch4)] * 2, beat * 1.6, 0.2), t0 + k * beat, 0.3 if k % 2 else -0.3)
        # melodía sencilla desde el compás 5
        if p.get('melody') and b >= 4:
            sc = [hz(p['key'], 5) * 2 ** (i / 12) for i in p['scale']]
            m = [0, 2, 1, 3, 2, 4, 3, 1] if b % 2 == 0 else [4, 3, 2, 1, 2, 3, 1, 0]
            for k in (0, 2, 3, 5, 6): add(buf, epiano(sc[m[k] % len(sc)], beat * 0.9, 0.2), t0 + k * beat / 2, -0.35)
        # percusión
        d = p.get('drums', 'none')
        for k in range(4):
            tb = t0 + k * beat
            if d in ('four', 'back') and (d == 'four' or k in (0, 2)): add(buf, kick(p.get('kvel', 0.55)), tb)
            if d == 'back' and k in (1, 3): add(buf, clap(0.28), tb)
            if d == 'four' and k in (1, 3): add(buf, clap(0.2), tb)
            if p.get('hats'):
                for h in range(2): add(buf, hat(0.1 if h == 0 else 0.07), tb + h * beat / 2 + (sw * beat / 2 if h else 0))
    reverb(buf, p.get('rev', 0.18))
    y = np.stack(buf, 1); y = y / (np.max(np.abs(y)) + 1e-9) * 0.9
    raw = os.path.join(out, name + '.wav')
    import wave
    with wave.open(raw, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype('<i2').tobytes())
    dst = os.path.join(out, name + '.mp3')
    comp = 'acompressor=threshold=-26dB:ratio=3.5:attack=5:release=120:makeup=4'
    ln = 'loudnorm=I=-13.2:TP=-2:LRA=7'
    r = subprocess.run(['ffmpeg', '-nostats', '-i', raw, '-af', comp + ',' + ln + ':print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    import json
    m = json.loads(r[r.rindex('{'):r.rindex('}') + 1])
    ln2 = f"{ln}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    dst = os.path.join(out, name + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', comp + ',' + ln2, '-ar', '48000', '-b:a', '160k', dst], check=True)
    r = subprocess.run(['ffmpeg', '-nostats', '-i', dst, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    li = float([l for l in r.splitlines() if l.strip().startswith('I:')][-1].split()[1])
    tmp = dst + '.tmp.mp3'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', dst, '-af', f'volume={-13.2 - li:.2f}dB,alimiter=limit=0.85:level=false', '-ar', '48000', '-b:a', '160k', tmp], check=True)
    os.replace(tmp, dst)
    os.remove(raw); print(name, f'{total:.1f}s')
M = [0, 2, 3, 5, 7, 10]; MAJ = [0, 2, 4, 7, 9]
TRACKS = {
  'bolsa-1': dict(bpm=104, bars=16, key='A', scale=M, prog=[('A','min'),('F','maj7'),('C','maj'),('G','maj')], style='pluck16', drums='four', hats=True, kvel=0.5, melody=True, bass8=True, rev=0.14),
  'bolsa-2': dict(bpm=110, bars=16, key='D', scale=M, prog=[('D','min'),('A#','maj'),('F','maj'),('C','maj')], style='arp', drums='back', hats=True, bass8=True, melody=True, rev=0.15, vel=0.3),
  'calma-1': dict(bpm=78, bars=16, key='C', scale=MAJ, prog=[('C','maj7'),('A','m7'),('F','maj7'),('G','sus')], style='arp', drums='back', hats=True, swing=0.18, kvel=0.35, melody=True, rev=0.22),
  'calma-2': dict(bpm=72, bars=16, key='F', scale=MAJ, prog=[('F','maj7'),('D','m7'),('A#','maj7'),('C','sus')], style='bells', drums='none', melody=True, rev=0.26, longbass=True, padvel=0.3),
  'alerta-1': dict(bpm=92, bars=16, key='E', scale=[0,3,5,7,10], prog=[('E','min'),('F','maj'),('E','min'),('B','min')], style='stab', drums='four', hats=False, kvel=0.6, bass8=True, rev=0.2, padvel=0.2),
  'optimista-1': dict(bpm=108, bars=16, key='G', scale=MAJ, prog=[('G','maj'),('D','maj'),('E','min'),('C','maj')], style='pluck16', drums='back', hats=True, melody=True, rev=0.14, bass8=False),
  'optimista-2': dict(bpm=112, bars=16, key='D', scale=MAJ, prog=[('D','maj'),('A','maj'),('B','min'),('G','maj')], style='arp', drums='back', hats=True, melody=True, rev=0.16, vel=0.3),
  'neutral-1': dict(bpm=85, bars=16, key='A', scale=M, prog=[('A','m7'),('D','m7'),('G','7'),('C','maj7')], style='arp', drums='back', hats=True, swing=0.22, kvel=0.4, melody=True, rev=0.22),
  'neutral-2': dict(bpm=90, bars=16, key='E', scale=M, prog=[('E','m7'),('A','m7'),('D','7'),('G','maj7')], style='bells', drums='back', hats=True, swing=0.2, kvel=0.35, rev=0.24),
}
if __name__ == '__main__':
    for k, v in TRACKS.items(): render(k, v)
