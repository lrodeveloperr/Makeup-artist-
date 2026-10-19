#!/usr/bin/env python3
"""Builds the tools' sounds from real CC0 recordings on Freesound (owner decision, 19 October 2026: real ASMR
recordings, free of copyright, no music). Every source is CC0 (public domain); each is credited in ASSETS.md.

For each tool, the recording is cleaned (rumble cut; pencil and felt tip, recorded on paper, softened towards
skin), only the moments where the tool is moving are kept, and they are joined with short crossfades into a
seamless 2.5 s loop. Each loop is saved with 0.15 s of the loop's own sound on both sides, so the game can loop the
middle exactly however much silence an MP3 decoder adds at the start. Taps (gems, lenses) are trimmed one-shots.

Writes assets/sounds/*.mp3 (mono, 64 kbit/s). Needs python3 with numpy, ffmpeg and network access to freesound.org.
Usage: python3 tools/make-sounds.py
"""
import os, re, subprocess, tempfile, urllib.request
import numpy as np

SR = 44100
LOOP, PAD, XFADE = 2.5, 0.15, 0.025
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')

# tool loops: Freesound id (or ids, whose moving stretches are used in turn), ffmpeg clean-up filter, the band whose energy marks the tool moving, the shortest
# moment kept (s), and where in the recording to look (s)
LOOPS = {
    'brush': dict(id=489425, af='highpass=f=250,lowpass=f=11000', band=(2000, 9000), min_len=0.12),          # makeup brush on skin
    'glow': dict(id=512288, af='highpass=f=300,lowpass=f=12000', band=(2000, 10000), min_len=0.12),          # a soft brush pass, airier
    'pencil': dict(id=809937, af='highpass=f=200,lowpass=f=5000', band=(1000, 6000), min_len=0.2),           # a soft pencil stroke
    'liner': dict(id=[321138, 351145], af='highpass=f=200,lowpass=f=3500', band=(800, 6000), min_len=0.2),   # fine felt tips
    'mascara': dict(id=410069, af='highpass=f=400,lowpass=f=12000', band=(2000, 10000), min_len=0.06),       # a mascara wand's bristles
    'lip': dict(id=740836, af='highpass=f=120,lowpass=f=8000', band=(500, 6000), min_len=0.15),              # a creamy rub on skin
    'gloss': dict(id=788343, af='highpass=f=150,lowpass=f=9000', band=(500, 8000), min_len=0.18),            # lip gloss applied (swipes only)
}
# taps: Freesound id, clean-up filter, start (s), longest length (s)
SHOTS = {
    'gem-glass': dict(id=427389, af='highpass=f=300', start=None, max_len=0.45),   # a single tap on glass
    'gem-pearl': dict(id=607582, af='highpass=f=200,lowpass=f=6000', start=None, max_len=0.25),   # a small hard object set down
    'gem-metal': dict(id=607584, af='highpass=f=400', start=None, max_len=0.3),    # a bright jewellery click
    'lens': dict(id=533146, af='highpass=f=150', start=0.2, max_len=0.35),          # a single droplet
}


def preview(sound_id):
    """The HQ preview of a Freesound sound (an MP3 of the CC0 recording)."""
    req = urllib.request.Request(f'https://freesound.org/s/{sound_id}/', headers={'User-Agent': 'Mozilla/5.0'})
    page = urllib.request.urlopen(req, timeout=60).read().decode('utf8', 'replace')
    if 'Creative Commons 0' not in page:
        raise SystemExit(f'{sound_id} is not CC0')
    url = re.search(r'data-mp3="([^"]+)-lq\.mp3"', page)[1] + '-hq.mp3'
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()


def decode(data, af):
    with tempfile.NamedTemporaryFile(suffix='.mp3') as f:
        f.write(data); f.flush()
        raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f.name, '-af', af, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def encode(x, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'{name}.mp3')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '64k', path], input=x.astype(np.float32).tobytes(), check=True)
    return path


def band_energy(x, lo, hi, frame=0.02):
    n = int(SR * frame)
    frames = x[: len(x) // n * n].reshape(-1, n) * np.hanning(n)
    spec = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    return 10 * np.log10(spec[:, (f >= lo) & (f < hi)].sum(1) + 1e-12), n


def moving(x, band, min_len):
    """The stretches where the tool is moving: band energy well above the recording's quiet floor."""
    e, n = band_energy(x, *band)
    floor, top = np.percentile(e, 15), np.percentile(e, 95)
    # well above the floor, and within 20 dB of the loudest moments (a recording gated to silence between strokes
    # would otherwise keep its quiet tails)
    on = e > max(floor + 0.45 * (top - floor), top - 20)
    # close gaps shorter than 60 ms
    gap = int(0.06 / 0.02)
    idx = np.flatnonzero(on)
    for a, b in zip(idx[:-1], idx[1:]):
        if 1 < b - a <= gap: on[a:b] = True
    runs, start = [], None
    for i, v in enumerate(np.append(on, False)):
        if v and start is None: start = i
        if not v and start is not None:
            if (i - start) * 0.02 >= min_len: runs.append((start * n, i * n))
            start = None
    # trim the ends a little (the tool landing and lifting)
    t = int(0.015 * SR)
    return [(a + t, b - t) for a, b in runs if b - a > 4 * t]


def crossfade_join(parts):
    k = int(XFADE * SR)
    ramp = np.sin(np.linspace(0, np.pi / 2, k)) ** 2
    out = parts[0].copy()
    for p in parts[1:]:
        out[-k:] = out[-k:] * (1 - ramp) + p[:k] * ramp
        out = np.concatenate([out, p[k:]])
    return out


def make_loop(name, spec):
    ids = spec['id'] if isinstance(spec['id'], list) else [spec['id']]
    stretches = []
    for sid in ids:
        x = decode(preview(sid), spec['af'])
        x /= np.sqrt(np.mean(x ** 2)) + 1e-9  # recordings of different loudness, evened out
        stretches += [x[a:b] for a, b in moving(x, spec['band'], spec['min_len'])]
    if not stretches: raise SystemExit(f'{name}: no movement found')
    runs = stretches
    need = int((LOOP + 2 * XFADE) * SR) + int(2 * PAD * SR)
    parts, i = [], 0
    while sum(len(p) for p in parts) < need * 1.2:
        parts.append(runs[i % len(runs)]); i += 1
        if i > 400: break
    y = crossfade_join(parts)
    L = int(LOOP * SR)
    # a seamless cycle: the end crossfades into the start
    k = int(XFADE * SR)
    ramp = np.sin(np.linspace(0, np.pi / 2, k)) ** 2
    cyc = y[:L].copy()
    cyc[:k] = y[L:L + k] * (1 - ramp) + cyc[:k] * ramp
    # level: RMS -20 dBFS, peaks rounded off
    cyc *= 0.1 / (np.sqrt(np.mean(cyc ** 2)) + 1e-9)
    cyc = np.tanh(cyc * 1.5) / 1.5
    p = int(PAD * SR)
    padded = np.concatenate([cyc[-p:], cyc, cyc[:p]])
    path = encode(padded, name)
    print(f'{name:10} {str(spec["id"]):>16}  {len(runs):3d} moving stretches -> {LOOP}s loop  {os.path.getsize(path)} bytes')


def make_shot(name, spec):
    x = decode(preview(spec['id']), spec['af'])
    if spec['start'] is not None: x = x[int(spec['start'] * SR):]
    a = max(0, int(np.argmax(np.abs(x) > 0.1 * np.abs(x).max())) - int(0.004 * SR))
    y = x[a:a + int(spec['max_len'] * SR)].copy()
    fade = min(len(y) // 3, int(0.05 * SR))
    y[-fade:] *= np.linspace(1, 0, fade) ** 2
    y *= 0.7 / (np.abs(y).max() + 1e-9)
    path = encode(y, name)
    print(f'{name:10} {str(spec["id"]):>16}  one-shot {len(y) / SR:.2f}s  {os.path.getsize(path)} bytes')


if __name__ == '__main__':
    for name, spec in LOOPS.items(): make_loop(name, spec)
    for name, spec in SHOTS.items(): make_shot(name, spec)
