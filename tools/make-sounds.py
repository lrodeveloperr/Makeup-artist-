#!/usr/bin/env python3
"""Builds the tools' sounds from real CC0 recordings on Freesound (owner decision, 19 October 2026: real ASMR
recordings, free of copyright, no music). Every source is CC0 (public domain); each is credited in ASSETS.md.

For each tool, the recording is cleaned (rumble cut; pencil and felt tip, recorded on paper, softened towards
skin) and cut into its single movements, its units: one brush swish, one lipstick rub, one gloss swipe, one burst of
mascara bristles, one pencil stroke. Each unit is the rise and fall of the tool's sound around one peak, cut at the
quietest point between neighbouring peaks; sharp transients (lip pops, knocks) are left out, and the most typical
units are kept (about 2.2 s a tool), each evened to the same level. They are saved one after another with 0.12 s of
silence between them, so the game finds each unit in the decoded sound however much silence an MP3 decoder adds at
the start. The game plays one unit per sweep of the hand (game/sound.js). Taps (gems, lenses) are trimmed one-shots.

Writes assets/sounds/*.mp3 (mono, 56 kbit/s). Needs python3 with numpy, ffmpeg and network access to freesound.org.
Usage: python3 tools/make-sounds.py
"""
import os, re, subprocess, tempfile, time, urllib.error, urllib.request
import numpy as np

SR = 44100
KEEP, GAP = 3, 0.12  # seconds of units kept a tool; silence between units
LENGTHS = [0, 0.3, 0.45, 0.65, 9]  # short, medium, long and longest units (s)
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')

# tool units: Freesound id (or ids), ffmpeg clean-up filter, the band whose energy is the tool moving, a unit's
# shortest and longest length (s), the least time between two units' peaks (s), and how much of the quiet ends to
# keep (a fraction of the energy range above the floor where a unit starts and ends); drive: how hard the sharpest
# peaks are softened (crackly recordings, bristles and sticky gloss, harder, so no tick sounds like a click)
UNITS = {
    'brush': dict(id=[489425, 575858], af='highpass=f=250,lowpass=f=11000', band=(2000, 9000), lo=0.2, hi=0.9, gap=0.12, edge=0.08),  # makeup brushes on skin
    'glow': dict(id=512288, af='highpass=f=300,lowpass=f=12000', band=(2000, 10000), lo=0.2, hi=1.0, gap=0.25, edge=0.25),        # a soft brush pass, airier
    'pencil': dict(id=809937, af='highpass=f=200,lowpass=f=5000', band=(1000, 6000), lo=0.25, hi=1.2, gap=0.3, edge=0.25),         # a soft pencil stroke
    'liner': dict(id=[321138, 351145], af='highpass=f=200,lowpass=f=3500', band=(800, 6000), lo=0.25, hi=1.2, gap=0.3, edge=0.25), # fine felt tips
    'mascara': dict(id=410069, af='highpass=f=400,lowpass=f=12000', band=(2000, 10000), lo=0.12, hi=0.45, gap=0.1, edge=0.25, drive=3),    # a mascara wand's bristles
    'lip': dict(id=740836, af='highpass=f=120,lowpass=f=8000', band=(500, 6000), lo=0.22, hi=0.8, gap=0.15, edge=0.25),            # a creamy rub on skin
    'gloss': dict(id=[788343, 391887], af='highpass=f=150,lowpass=f=9000', band=(500, 8000), lo=0.2, hi=0.8, gap=0.2, edge=0.25, drive=3),     # lip gloss applied (swipes)
}
# taps: Freesound id, clean-up filter, start (s), longest length (s)
SHOTS = {
    'gem-glass': dict(id=427389, af='highpass=f=300', start=None, max_len=0.45),   # a single tap on glass
    'gem-pearl': dict(id=607582, af='highpass=f=200,lowpass=f=6000', start=None, max_len=0.25),   # a small hard object set down
    'gem-metal': dict(id=607584, af='highpass=f=400', start=None, max_len=0.3),    # a bright jewellery click
    'lens': dict(id=533146, af='highpass=f=150', start=0.2, max_len=0.35),          # a single droplet
}


def fetch(url):
    """Freesound turns away quick runs of requests (403, 429) for a while: wait and try again."""
    for wait in (0, 5, 15, 30, 60):
        time.sleep(wait)
        try: return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
        except urllib.error.HTTPError as e:
            if e.code not in (403, 429): raise
    raise SystemExit(f'{url}: refused')


def preview(sound_id):
    """The HQ preview of a Freesound sound (an MP3 of the CC0 recording)."""
    page = fetch(f'https://freesound.org/s/{sound_id}/').decode('utf8', 'replace')
    if 'Creative Commons 0' not in page:
        raise SystemExit(f'{sound_id} is not CC0')
    return fetch(re.search(r'data-mp3="([^"]+)-lq\.mp3"', page)[1] + '-hq.mp3')


def decode(data, af):
    with tempfile.NamedTemporaryFile(suffix='.mp3') as f:
        f.write(data); f.flush()
        raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f.name, '-af', af, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def encode(x, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'{name}.mp3')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '56k', path], input=x.astype(np.float32).tobytes(), check=True)
    return path


def band_energy(x, lo, hi, frame=0.02):
    n = int(SR * frame)
    frames = x[: len(x) // n * n].reshape(-1, n) * np.hanning(n)
    spec = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    return 10 * np.log10(spec[:, (f >= lo) & (f < hi)].sum(1) + 1e-12), n


def units(x, spec):
    """The single movements in a recording: each the rise and fall of the band's energy around one peak, cut at the
    quietest point between neighbouring peaks, its quiet ends and any slow build-up trimmed."""
    e, n = band_energy(x, *spec['band'], frame=0.01)
    es = np.convolve(e, np.ones(5) / 5, mode='same')
    floor, top = np.percentile(es, 10), np.percentile(es, 98)
    thr, edge = floor + 0.5 * (top - floor), floor + spec['edge'] * (top - floor)
    g = max(1, int(spec['gap'] / 0.01))
    peaks = [i for i in range(1, len(es) - 1) if es[i] >= thr and es[i] == es[max(0, i - g):i + g + 1].max()]
    out = []
    for k, p in enumerate(peaks):
        left = max(0, p - g) if k == 0 else peaks[k - 1] + int(np.argmin(es[peaks[k - 1]:p]))
        right = min(len(es) - 1, p + g) if k == len(peaks) - 1 else p + int(np.argmin(es[p:peaks[k + 1]]))
        while left < p and es[left] < edge: left += 1
        while right > p and es[right] < edge: right -= 1
        # a unit starts with its sound, not a slow build-up: from just before it reaches a quarter of its peak level
        lin = 10 ** ((es[left:p + 1] - es[p]) / 20)
        left = max(left, left + int(np.argmax(lin >= 0.25)) - 2)
        if spec['lo'] <= (right - left) * 0.01 <= spec['hi']: out.append(x[left * n:right * n].copy())
    return out


def make_units(name, spec):
    ids = spec['id'] if isinstance(spec['id'], list) else [spec['id']]
    found = []
    for sid in ids:
        found += units(decode(preview(sid), spec['af']), spec)
    if not found: raise SystemExit(f'{name}: no units found')
    rms = lambda u: np.sqrt(np.mean(u ** 2)) + 1e-9
    level = np.array([20 * np.log10(rms(u)) for u in found])
    crest = np.array([np.abs(u).max() / rms(u) for u in found])
    # leave out sharp transients (a pop or a knock: far peakier than the tool's own units); keep the most typical
    # units of every length, so a quick flick and a long, slow sweep each find a unit about their length (taken in
    # turn from short, medium and long units, the most typical first), in recording order
    ok = [i for i in range(len(found)) if crest[i] < 1.6 * np.median(crest)]
    mid = np.median(level[ok])
    ok.sort(key=lambda i: abs(level[i] - mid))
    length = lambda i: len(found[i]) / SR
    bins = [[i for i in ok if a <= length(i) < b] for a, b in zip(LENGTHS, LENGTHS[1:])]
    keep, total = [], 0
    while total < KEEP and any(bins):
        for b in bins:
            if b and total < KEEP: i = b.pop(0); keep.append(i); total += length(i)
    keep.sort()
    silence = np.zeros(int(GAP * SR), dtype=np.float32)
    parts = [silence]
    for i in keep:
        u = found[i] * (0.1 / rms(found[i]))  # every unit at RMS -20 dBFS, its sharpest peaks softened
        drive = spec.get('drive', 1.5)
        u = np.tanh(u * drive) / drive
        u *= min(0.1 / rms(u), 0.9 / np.abs(u).max())  # and the level they took back (a crackly unit loses most)
        a, b = int(0.004 * SR), int(0.025 * SR)
        u[:a] *= np.linspace(0, 1, a); u[-b:] *= np.linspace(1, 0, b) ** 2
        parts += [u, silence]
    path = encode(np.concatenate(parts), name)
    print(f'{name:10} {str(spec["id"]):>16}  {len(keep):3d} of {len(found):3d} units, {total:.1f}s  {os.path.getsize(path)} bytes')


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
    for name, spec in UNITS.items(): make_units(name, spec)
    for name, spec in SHOTS.items(): make_shot(name, spec)
