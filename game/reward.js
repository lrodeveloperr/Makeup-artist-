// The picture that sells the colour of the day (owner's choice, 19 October 2026: the product shot): the product
// itself in that colour, drawn to look real: a lipstick, an open compact with its brush, a sharpened pencil with
// the line it draws, a mascara and its wand, an eye wearing the lens. Gloss adds a wet highlight, shimmer adds
// sparkle. Textless. Colours are palette entries with their target.

const INK = '#2a1d15';
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
const light = (h, t) => mix(h, '#ffffff', t), dark = (h, t) => mix(h, '#000000', t);
// a small deterministic scatter (sparkles, specks)
const scatter = (n, seed = 1) => { let x = seed; const r = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); return Array.from({ length: n }, () => [r(), r(), r()]); };
let uid = 0;

const sparkles = (c, box, n, seed) => (c.shimmer ? scatter(n, seed).map(([x, y, s]) => `<circle cx="${(box[0] + x * box[2]).toFixed(1)}" cy="${(box[1] + y * box[3]).toFixed(1)}" r="${(0.6 + s * 1.6).toFixed(1)}" fill="#fff" opacity="${(0.5 + s * 0.5).toFixed(2)}"/>`).join('') : '');
const shadow = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity=".18" filter="url(#blur)"/>`;
// a cylinder's shading across its width
const cyl = (id, hex, dir = 'x') => `<linearGradient id="${id}" x1="0" y1="0" x2="${dir === 'x' ? 1 : 0}" y2="${dir === 'x' ? 0 : 1}"><stop offset="0" stop-color="${dark(hex, 0.45)}"/><stop offset=".22" stop-color="${hex}"/><stop offset=".38" stop-color="${light(hex, 0.35)}"/><stop offset=".6" stop-color="${hex}"/><stop offset="1" stop-color="${dark(hex, 0.5)}"/></linearGradient>`;
const metal = (id, a = '#f6e3a6', b = '#b8882a') => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${b}"/><stop offset=".3" stop-color="${a}"/><stop offset=".5" stop-color="#fff6d6"/><stop offset=".7" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const black = (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a0a0a"/><stop offset=".3" stop-color="#2b2b2b"/><stop offset=".42" stop-color="#5a5a5a"/><stop offset=".6" stop-color="#262626"/><stop offset="1" stop-color="#050505"/></linearGradient>`;

const PRODUCT = {
  lip(c, u) {
    const g = c.gloss;
    return `<defs>${cyl(`b${u}`, c.hex)}${metal(`m${u}`)}${black(`k${u}`)}</defs>
      ${shadow(120, 218, 52, 9)}
      <rect x="92" y="128" width="56" height="86" rx="6" fill="url(#k${u})"/>
      <rect x="88" y="116" width="64" height="16" rx="3" fill="url(#m${u})"/>
      <rect x="92" y="108" width="56" height="10" rx="2" fill="${dark(c.hex, 0.55)}"/>
      <path d="M96 110V46q0-8 8-11l40-14v89z" fill="url(#b${u})"/>
      <path d="M104 35l40-14v14l-40 14z" fill="${light(c.hex, g ? 0.45 : 0.28)}"/>
      <path d="M101 104V48q0-5 5-7" fill="none" stroke="#fff" stroke-width="${g ? 6 : 3}" stroke-linecap="round" opacity="${g ? 0.7 : 0.35}"/>
      ${g ? '<ellipse cx="134" cy="30" rx="4" ry="7" fill="#fff" opacity=".85" transform="rotate(-20 134 30)"/>' : ''}
      ${sparkles(c, [98, 30, 44, 76], 26, 3)}`;
  },
  brush(c, u) {
    return `<defs>${metal(`m${u}`)}<radialGradient id="p${u}" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="${light(c.hex, 0.18)}"/><stop offset=".7" stop-color="${c.hex}"/><stop offset="1" stop-color="${dark(c.hex, 0.25)}"/></radialGradient>
      <linearGradient id="r${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset=".45" stop-color="#c9d3dc"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#aab6c2"/></linearGradient>
      <linearGradient id="w${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a2416"/><stop offset=".4" stop-color="#7a4a2a"/><stop offset="1" stop-color="#2a1810"/></linearGradient>
      <linearGradient id="h${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1e2c8"/><stop offset=".55" stop-color="#d9c29c"/><stop offset=".75" stop-color="${light(c.hex, 0.2)}"/><stop offset="1" stop-color="${c.hex}"/></linearGradient></defs>
      ${shadow(96, 212, 72, 9)}
      <ellipse cx="96" cy="92" rx="66" ry="40" fill="#1f1512"/>
      <ellipse cx="96" cy="88" rx="66" ry="40" fill="url(#m${u})"/>
      <ellipse cx="96" cy="88" rx="56" ry="32" fill="url(#r${u})"/>
      <path d="M48 76q50-22 96 2" fill="none" stroke="#fff" stroke-width="6" opacity=".55"/>
      <ellipse cx="96" cy="166" rx="68" ry="42" fill="#1f1512"/>
      <ellipse cx="96" cy="162" rx="68" ry="42" fill="url(#m${u})"/>
      <ellipse cx="96" cy="162" rx="56" ry="32" fill="url(#p${u})"/>
      <ellipse cx="96" cy="162" rx="44" ry="22" fill="none" stroke="#fff" stroke-width="1.2" opacity=".25"/>
      <ellipse cx="96" cy="162" rx="30" ry="14" fill="none" stroke="#000" stroke-width="1.2" opacity=".12"/>
      <path d="M72 150q22-10 48 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".22"/>
      ${sparkles(c, [48, 136, 96, 52], 30, 5)}
      <g transform="rotate(-36 176 130)">
        <rect x="168" y="118" width="16" height="96" rx="7" fill="url(#w${u})"/>
        <rect x="166" y="90" width="20" height="32" rx="3" fill="url(#r${u})"/>
        <path d="M166 92q10-62 20 0z" fill="url(#h${u})"/>
        ${Array.from({ length: 7 }, (_, k) => `<path d="M${168 + k * 2.6} 90q${(k - 3) * 1.4}-30 ${(k - 3) * 1.1}-52" fill="none" stroke="#9a7a52" stroke-width=".6" opacity=".6"/>`).join('')}
      </g>`;
  },
  pencil(c, u) {
    return `<defs>${cyl(`b${u}`, c.hex, 'y')}<linearGradient id="w${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c79a62"/><stop offset=".4" stop-color="#f3d7ad"/><stop offset="1" stop-color="#a87444"/></linearGradient>
      <linearGradient id="s${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a8f99"/><stop offset=".45" stop-color="#f4f6f8"/><stop offset="1" stop-color="#6d727c"/></linearGradient></defs>
      ${shadow(120, 196, 86, 8)}
      <g transform="rotate(-30 120 120)">
        <rect x="18" y="104" width="22" height="32" rx="3" fill="url(#s${u})"/>
        <rect x="38" y="104" width="118" height="32" fill="url(#b${u})"/>
        <rect x="40" y="109" width="114" height="5" rx="2" fill="#fff" opacity=".35"/>
        <path d="M156 104l42 16-42 16z" fill="url(#w${u})"/>
        ${Array.from({ length: 5 }, (_, k) => `<path d="M158 ${107 + k * 6.5}l${30 - Math.abs(k - 2) * 7} ${(k - 2) * 2.2}" stroke="#a37444" stroke-width=".8" opacity=".7"/>`).join('')}
        <path d="M186 115.5l12 4.5-12 4.5z" fill="${dark(c.hex, 0.15)}"/>
        ${sparkles(c, [42, 106, 110, 28], 18, 7)}
      </g>
      <path d="M150 190q-26-22-66-10" fill="none" stroke="${c.hex}" stroke-width="7" stroke-linecap="round"/>
      <path d="M150 190q-26-22-66-10" fill="none" stroke="${light(c.hex, 0.3)}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`;
  },
  mascara(c, u) {
    return `<defs>${cyl(`b${u}`, c.hex)}${black(`k${u}`)}${metal(`m${u}`)}</defs>
      ${shadow(120, 220, 70, 9)}
      <rect x="54" y="78" width="54" height="138" rx="12" fill="url(#b${u})"/>
      <rect x="50" y="28" width="62" height="54" rx="7" fill="url(#k${u})"/>
      <rect x="50" y="78" width="62" height="8" fill="url(#m${u})"/>
      <rect x="62" y="34" width="5" height="40" rx="2.5" fill="#fff" opacity=".2"/>
      <ellipse cx="81" cy="150" rx="20" ry="26" fill="${dark(c.hex, 0.15)}" opacity=".35"/>
      ${sparkles(c, [58, 86, 46, 124], 24, 9)}
      <g transform="rotate(22 160 130)">
        <rect x="150" y="124" width="20" height="92" rx="6" fill="url(#k${u})"/>
        <rect x="156" y="42" width="8" height="84" rx="4" fill="#1a1a1a"/>
        ${Array.from({ length: 22 }, (_, k) => { const y = 46 + k * 3.6, w = 11 + 4 * Math.sin((k / 21) * Math.PI); return `<path d="M${160 - w} ${y}h${2 * w}" stroke="${k % 2 ? c.hex : light(c.hex, 0.2)}" stroke-width="2.2" stroke-linecap="round"/>`; }).join('')}
      </g>`;
  },
  lens(c, u) {
    const [s0, s1, s2, s3] = c.iris;
    const rays = Array.from({ length: 48 }, (_, k) => { const a = (k / 48) * 2 * Math.PI; return `<path d="M${120 + 14 * Math.cos(a)} ${124 + 14 * Math.sin(a)}L${120 + 36 * Math.cos(a + 0.05)} ${124 + 36 * Math.sin(a + 0.05)}" stroke="${k % 2 ? dark(s1, 0.35) : light(s0, 0.3)}" stroke-width="${k % 3 ? 0.9 : 1.6}" opacity=".45"/>`; }).join('');
    return `<defs><radialGradient id="i${u}"><stop offset=".28" stop-color="${s0}"/><stop offset=".55" stop-color="${s1}"/><stop offset=".84" stop-color="${s2}"/><stop offset="1" stop-color="${s3}"/></radialGradient>
      <radialGradient id="e${u}" cx=".5" cy=".5" r=".7"><stop offset=".6" stop-color="#ffffff"/><stop offset="1" stop-color="#e2d8d8"/></radialGradient>
      <linearGradient id="l${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".35" stop-color="#000" stop-opacity="0"/></linearGradient>
      <clipPath id="c${u}"><path d="M14 124Q120 44 226 124 120 204 14 124z"/></clipPath></defs>
      <path d="M14 124Q120 44 226 124 120 204 14 124z" fill="url(#e${u})"/>
      <g clip-path="url(#c${u})">
        <circle cx="120" cy="124" r="42" fill="url(#i${u})"/>
        ${rays}
        <circle cx="120" cy="124" r="41" fill="none" stroke="${s3}" stroke-width="3" opacity=".8"/>
        <circle cx="120" cy="124" r="46" fill="none" stroke="#fff" stroke-width="1.2" opacity=".35"/>
        <circle cx="120" cy="124" r="15" fill="#06040a"/>
        <ellipse cx="132" cy="110" rx="7" ry="5" fill="#fff" opacity=".95" transform="rotate(-25 132 110)"/>
        <circle cx="108" cy="138" r="3" fill="#fff" opacity=".55"/>
        <path d="M14 124Q120 44 226 124 120 204 14 124z" fill="url(#l${u})"/>
      </g>
      <path d="M14 124Q120 44 226 124" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <path d="M14 124Q120 204 226 124" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>
      ${Array.from({ length: 11 }, (_, k) => { const t = 0.08 + (k / 10) * 0.84, x = 14 + 212 * t, y = 124 - 80 * 4 * t * (1 - t) * 0.5 * 2; const dx = (t - 0.5) * 28, len = 16 + 10 * Math.sin(t * Math.PI); return `<path d="M${x.toFixed(1)} ${(y + 2).toFixed(1)}q${(dx * 0.4).toFixed(1)} -${(len * 0.5).toFixed(1)} ${dx.toFixed(1)} -${len.toFixed(1)}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`; }).join('')}`;
  },
};

export function productShot(c) {
  const u = ++uid;
  return `<svg viewBox="0 0 240 240" aria-hidden="true"><defs><filter id="blur" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="4"/></filter>
    <radialGradient id="bg${u}" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#fffaf6"/><stop offset="1" stop-color="#f3dcd6"/></radialGradient></defs>
    <rect width="240" height="240" rx="28" fill="url(#bg${u})"/>${PRODUCT[c.target](c, u)}</svg>`;
}
