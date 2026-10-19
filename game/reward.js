// The picture that sells the colour of the day, three ways (the owner is choosing; ?reward= picks one):
//   tryon    the customer herself wearing the colour: a real render of the current face with it applied
//   product  the product itself, drawn to look real: a lipstick, a compact and brush, a pencil, a mascara, an eye
//   swatch   the colour swiped on skin in the customer's own tone, with the product tip, as beauty swatches are
// Everything is textless. Colours are palette entries with their target.
import { colourById } from '../src/makeup/palette.js';
import { skinAlbedo } from '../src/face/colors.js';

const INK = '#2a1d15';
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
const light = (h, t) => mix(h, '#ffffff', t), dark = (h, t) => mix(h, '#000000', t);
// the customer's skin as an sRGB hex (skinAlbedo is linear)
export const skinHex = (face) => rgbToHex(skinAlbedo(face.skin.tone, face.skin.undertone).map((v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
// a small deterministic scatter (sparkles, specks)
const scatter = (n, seed = 1) => { let x = seed; const r = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); return Array.from({ length: n }, () => [r(), r(), r()]); };
let uid = 0;

// ---------------- try-on: the customer wears it ----------------
// side: a FaceView with makeup (a small paint size); face: her record; colour: a palette id. Draws into the side
// view's canvas (shown as it is, so nothing is read back).
export function tryOn(side, face, colour) {
  const c = colourById(colour), t = c.target;
  side.setFace(face); // clean
  const [zoom, y] = { lip: [2.7, -0.62], brush: [2.1, -0.16], pencil: [2.7, 0.02], mascara: [2.7, 0.02], lens: [2.7, 0.02] }[t];
  side.zoom(zoom, y);
  const a = side.makeup, pr = (p) => a.picker.project(p);
  const [L, R] = side.eyes.meshes.map((m) => m.position), r = side.eyes.meshes[0].scale[0];
  const line = (p0, p1, k = 18) => Array.from({ length: k + 1 }, (_, i) => [p0[0] + ((p1[0] - p0[0]) * i) / k, p0[1] + ((p1[1] - p0[1]) * i) / k]);
  const stroke = (...parts) => { const g = a.begin(t, colour); for (const p of parts.flat()) a.move(g, p[0], p[1]); a.end(g); };
  const eyes = [[L, 1], [R, -1]];
  // record the strokes without painting, then paint them all at once (restore batches the dabs; painting
  // point by point is for live strokes)
  const draw = a.paint.draw;
  a.paint.draw = () => {};
  if (t === 'brush') for (const [e, s] of eyes) {
    for (let k = 0; k < 3; k++) stroke(line(pr([e[0] - 0.12, e[1] + 0.09, e[2] + 0.12]), pr([e[0] + 0.13, e[1] + 0.1, e[2] + 0.1])));
    for (let k = 0; k < 2; k++) stroke(line(pr([e[0] + s * 0.05, e[1] - 0.38, e[2]]), pr([e[0] + s * 0.2, e[1] - 0.46, e[2] - 0.05])));
  }
  if (t === 'pencil') for (const [e, s] of eyes) for (let k = 0; k < 2; k++) {
    stroke(line(pr([e[0] - s * 0.13, e[1] + 0.065, e[2] + 0.12]), pr([e[0], e[1] + 0.085, e[2] + 0.14]), 10), line(pr([e[0], e[1] + 0.085, e[2] + 0.14]), pr([e[0] + s * 0.14, e[1] + 0.07, e[2] + 0.1]), 10), line(pr([e[0] + s * 0.14, e[1] + 0.07, e[2] + 0.1]), pr([e[0] + s * 0.22, e[1] + 0.12, e[2] + 0.04]), 8));
  }
  if (t === 'mascara') for (const [e] of eyes) for (let k = 0; k < 3; k++) stroke(line(pr([e[0] - 0.16, e[1] + 0.1, e[2] + 0.2]), pr([e[0] + 0.16, e[1] + 0.1, e[2] + 0.2])));
  // lips: passes across the mouth, narrowing towards the bow and the bottom of the lower lip
  if (t === 'lip') for (const [y0, hw] of [[-0.55, 0.1], [-0.58, 0.16], [-0.61, 0.19], [-0.64, 0.19], [-0.67, 0.17], [-0.7, 0.13], [-0.725, 0.07]]) stroke(line(pr([-hw, y0, 0.5]), pr([hw, y0, 0.5]), 24));
  if (t === 'lens') for (const [e] of eyes) a.tapLens(...pr([e[0], e[1], e[2] + r]), colour);
  a.paint.draw = draw;
  a.restore(a.makeup);
  side.render();
}

// ---------------- product shots ----------------
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

// ---------------- the swatch on skin ----------------
const TIP = {
  lip: (c) => `<g transform="rotate(-50 62 150)"><rect x="46" y="150" width="32" height="50" rx="4" fill="#111"/><rect x="44" y="142" width="36" height="10" rx="2" fill="#d9b25a"/><path d="M50 142V106q0-5 5-7l22-8v51z" fill="${c.hex}"/><path d="M53 136V106q0-3 3-4" stroke="#fff" stroke-width="3" opacity=".5" fill="none"/></g>`,
  brush: (c) => `<g transform="rotate(-50 60 150)"><rect x="54" y="160" width="12" height="60" rx="5" fill="#5a3a22"/><rect x="52" y="140" width="16" height="22" rx="2" fill="#cfd6de"/><path d="M52 142q8-52 16 0z" fill="#e5d0aa"/><path d="M55 125q5-20 10 0q-5 8-10 0z" fill="${c.hex}" opacity=".9"/></g>`,
  pencil: (c) => `<g transform="rotate(-50 60 150)"><rect x="52" y="150" width="16" height="70" rx="2" fill="${c.hex}"/><rect x="54" y="152" width="3" height="64" fill="#fff" opacity=".35"/><path d="M52 150l8-26 8 26z" fill="#f1d5ad"/><path d="M57 134l3-10 3 10z" fill="${dark(c.hex, 0.2)}"/></g>`,
  mascara: (c) => `<g transform="rotate(-50 60 150)"><rect x="54" y="160" width="12" height="60" rx="4" fill="#111"/><rect x="58" y="112" width="4" height="50" fill="#222"/>${Array.from({ length: 12 }, (_, k) => `<path d="M${52 + (k % 2)} ${116 + k * 3.6}h${16 - (k % 2) * 2}" stroke="${c.hex}" stroke-width="1.8" stroke-linecap="round"/>`).join('')}</g>`,
};

export function skinSwatch(c, skin) {
  const u = ++uid;
  if (c.target === 'lens') return `<svg viewBox="0 0 240 240" aria-hidden="true"><rect width="240" height="240" rx="28" fill="${skin}"/><g transform="translate(0 6)">${PRODUCT.lens(c, u)}</g></svg>`;
  const g = c.gloss;
  return `<svg viewBox="0 0 240 240" aria-hidden="true"><defs>
      <filter id="rough${u}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${u}"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter>
      <filter id="soft${u}"><feGaussianBlur stdDeviation="5"/></filter>
      <filter id="grain${u}"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" seed="2"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .12 0"/></filter>
      <linearGradient id="sw${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.hex}"/><stop offset=".55" stop-color="${c.hex}"/><stop offset="1" stop-color="${c.hex}" stop-opacity=".25"/></linearGradient>
      <clipPath id="cl${u}"><path d="M58 150C90 118 118 172 150 140S196 112 210 104c6 10 0 24-16 36S150 190 118 172 76 180 60 166z"/></clipPath>
    </defs>
    <rect width="240" height="240" rx="28" fill="${skin}"/>
    <rect width="240" height="240" rx="28" filter="url(#grain${u})"/>
    <path d="M58 150C90 118 118 172 150 140S196 112 210 104c6 10 0 24-16 36S150 190 118 172 76 180 60 166z" fill="url(#sw${u})" filter="url(#rough${u})" opacity="${g ? 0.92 : 0.97}"/>
    <g clip-path="url(#cl${u})">
    ${g ? `<path d="M66 148c30-26 56 18 86-6s46-26 56-32" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".5" filter="url(#soft${u})"/><path d="M72 146c26-20 50 14 78-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>` : `<path d="M66 148c30-26 56 18 86-6s46-26 56-32" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".14"/>`}
    ${c.shimmer ? scatter(140, u + 11).map(([x, y, s]) => `<circle cx="${(56 + x * 158).toFixed(1)}" cy="${(100 + y * 84).toFixed(1)}" r="${(0.5 + s * 1.5).toFixed(1)}" fill="${s > 0.6 ? '#fff' : light(c.hex, 0.6)}" opacity="${(0.4 + s * 0.6).toFixed(2)}"/>`).join('') : ''}
    </g>
    ${TIP[c.target](c)}</svg>`;
}
