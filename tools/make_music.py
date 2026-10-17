"""Genera music.mp3: fondo musical original (sin derechos), 32 s, en bucle sin cortes.
Uso: python3 tools/make_music.py assets/music.mp3   (necesita numpy y ffmpeg)"""
import sys, subprocess, wave
import numpy as np

SR = 48000
BPM = 90
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORDS = [  # (raíz MIDI, acorde)
    (45, [57, 60, 64]),  # Am
    (41, [53, 57, 60]),  # F
    (48, [55, 60, 64]),  # C
    (43, [55, 59, 62]),  # G
]
BARS = 12
N = int(SR * BAR * BARS)
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def add(sig, start, pan=0.5):
    """suma circular para que el bucle no tenga corte"""
    i = int(start * SR)
    idx = (np.arange(len(sig)) + i) % N
    mix[idx, 0] += sig * (1 - pan) * 1.4
    mix[idx, 1] += sig * pan * 1.4

def env(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e

def pad(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * hz(m) * (1 + d) * t + p) for d, p in [(0, 0), (0.003, 1), (-0.003, 2)])
    s += 0.35 * np.sin(2 * np.pi * hz(m + 12) * t)
    return s * env(n, 0.9, 1.2) * 0.05

def pluck(m, dur=0.9):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * hz(m) * t) + 0.4 * np.sin(2 * np.pi * hz(m) * 2 * t) * np.exp(-6 * t)
    return s * np.exp(-5 * t) * 0.09

def bass(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * hz(m) * t) + 0.25 * np.sin(2 * np.pi * hz(m) * 2 * t)
    return s * env(n, 0.02, 0.35) * 0.22

def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 110 * np.exp(-14 * t) + 42
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-9 * t) * 0.32

def hat():
    n = int(0.08 * SR)
    x = rng.standard_normal(n)
    x = x - np.concatenate([[0], x[:-1]]) * 0.95  # paso alto simple
    return x * np.exp(-60 * np.arange(n) / SR) * 0.05

for b in range(BARS):
    root, chord = CHORDS[b % 4]
    t0 = b * BAR
    for m in chord:
        add(pad(m, BAR + 1.0), t0, pan=0.35 if m % 2 else 0.65)
    add(bass(root - 12 + 12, BEAT * 1.8), t0)
    add(bass(root - 12 + 12, BEAT * 1.4), t0 + 2 * BEAT)
    # arpegio en corcheas
    pattern = [0, 1, 2, 1, 0, 1, 2, 1]
    for k, p in enumerate(pattern):
        add(pluck(chord[p] + 12), t0 + k * BEAT / 2, pan=0.3 + 0.4 * (k % 2))
    for beat in (0, 2):
        add(kick(), t0 + beat * BEAT, 0.5)
    for k in range(4):
        add(hat(), t0 + k * BEAT + BEAT / 2, 0.6)

mix /= np.max(np.abs(mix))
mix *= 0.8
pcm = (mix * 32767).astype(np.int16)
wav = sys.argv[1].rsplit('.', 1)[0] + '.wav'
with wave.open(wav, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-b:a', '160k', sys.argv[1]], check=True)
import os; os.remove(wav)
print('ok', sys.argv[1])
