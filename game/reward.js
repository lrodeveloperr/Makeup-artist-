// The picture that sells the colour of the day (owner's choice, 19 October 2026: the product shot): the product
// itself in that colour, drawn to look real: a lipstick, an open compact with its brush, a baked highlighter with
// its fan brush and a swatch, a sharpened pencil with the line it draws, a liquid liner and its wing, a mascara and
// its wand, a face gem, an eye wearing the lens. Gloss adds a wet highlight, shimmer adds sparkle. Textless.
// Colours are palette entries with their target.

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

// a four-pointed glint
const glint = (x, y, r, o = 1) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}z" fill="#fff" opacity="${o}"/>`;
// gem outlines (as the swatches) and their facets, in a 24-unit box
const GEM = {
  stone: 'M12 2.5l6.7 2.8 2.8 6.7-2.8 6.7-6.7 2.8-6.7-2.8L2.5 12l2.8-6.7z',
  drop: 'M12 2C9.2 6.6 6 10.3 6 14.4a6 6 0 0 0 12 0C18 10.3 14.8 6.6 12 2z',
  heart: 'M12 21s-8.5-5-8.5-11A4.6 4.6 0 0 1 12 7.2 4.6 4.6 0 0 1 20.5 10c0 6-8.5 11-8.5 11z',
  star: 'M12 1.5l3 7.3 7.5.6-5.7 5 1.8 7.6L12 18l-6.6 4 1.8-7.6-5.7-5 7.5-.6z',
};

const PRODUCT = {
  glow(c, u) {
    // a baked highlighter in a slim compact, swirled and sparkling, its fan brush, and a swatch of the glow
    const swirl = Array.from({ length: 5 }, (_, k) => `<path d="M${62 + k * 9} ${112 + k * 3}q${30 - k * 3} -${22 - k * 2} ${58 - k * 5} 0" fill="none" stroke="${k % 2 ? '#fff' : light(c.hex, 0.35)}" stroke-width="${3 - k * 0.3}" opacity="${0.55 - k * 0.06}"/>`).join('');
    return `<defs>${metal(`m${u}`)}<radialGradient id="p${u}" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${light(c.hex, 0.35)}"/><stop offset=".75" stop-color="${c.hex}"/><stop offset="1" stop-color="${dark(c.hex, 0.2)}"/></radialGradient>
      <linearGradient id="s${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.hex}" stop-opacity="0"/><stop offset=".25" stop-color="${light(c.hex, 0.25)}" stop-opacity=".9"/><stop offset=".6" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="${c.hex}" stop-opacity="0"/></linearGradient>
      <linearGradient id="w${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1d15"/><stop offset=".45" stop-color="#5a4232"/><stop offset="1" stop-color="#1a120c"/></linearGradient></defs>
      ${shadow(104, 186, 78, 9)}
      <path d="M40 196q70 18 140-6" fill="none" stroke="url(#s${u})" stroke-width="16" stroke-linecap="round"/>
      ${sparkles({ shimmer: 1 }, [52, 186, 120, 14], 18, 11)}
      <circle cx="104" cy="118" r="66" fill="#1f1512"/>
      <circle cx="104" cy="114" r="66" fill="url(#m${u})"/>
      <circle cx="104" cy="114" r="54" fill="url(#p${u})"/>
      ${swirl}
      ${sparkles({ shimmer: 1 }, [62, 72, 84, 84], 34, 13)}
      ${glint(84, 90, 9)}${glint(132, 134, 6, 0.8)}
      <g transform="translate(-16 22) rotate(32 196 104)">
        <rect x="190" y="104" width="12" height="98" rx="5" fill="url(#w${u})"/>
        <rect x="188" y="88" width="16" height="20" rx="2" fill="url(#m${u})"/>
        <path d="M196 92L168 46A46 46 0 0 1 224 46z" fill="#f1e2c8"/>
        <path d="M168 46A46 46 0 0 1 224 46" fill="none" stroke="${light(c.hex, 0.2)}" stroke-width="5"/>
        ${Array.from({ length: 9 }, (_, k) => `<path d="M196 92L${172 + k * 6} ${44 - Math.sin((k / 8) * Math.PI) * 6}" stroke="#bfa47e" stroke-width=".7" opacity=".7"/>`).join('')}
      </g>`;
  },
  liner(c, u) {
    // a liquid liner pen and the winged line it draws
    // the line along the lashes thickens towards the outer corner, then flicks up to a point
    const wing = 'M26 168Q94 186 150 168L218 116L170 178Q100 206 26 172z';
    return `<defs>${cyl(`b${u}`, c.hex, 'y')}${metal(`m${u}`)}${black(`k${u}`)}</defs>
      ${shadow(126, 140, 90, 8)}
      <path d="${wing}" fill="${c.hex}"/>
      <path d="M44 174q56 14 112-4" fill="none" stroke="#fff" stroke-width="2" opacity="${c.shimmer ? 0.5 : 0.18}"/>
      ${sparkles(c, [40, 160, 150, 26], 28, 15)}
      <g transform="translate(-6 -18) rotate(-38 126 92)">
        <rect x="30" y="80" width="150" height="24" rx="11" fill="url(#k${u})"/>
        <rect x="40" y="84" width="128" height="4" rx="2" fill="#fff" opacity=".25"/>
        <rect x="150" y="80" width="10" height="24" fill="url(#m${u})"/>
        <rect x="160" y="82" width="34" height="20" rx="3" fill="url(#b${u})"/>
        <path d="M194 84l26 8-26 8z" fill="${dark(c.hex, 0.2)}"/>
        <path d="M206 89l14 3-14 3z" fill="${c.hex}"/>
      </g>`;
  },
  gem(c, u) {
    // the gem, big, on a soft card
    const look = c.look, fire = look === 'iris' ? '<stop offset=".35" stop-color="#ffd2f2"/><stop offset=".55" stop-color="#c8f4ff"/><stop offset=".75" stop-color="#fff3c4"/>' : '';
    const grad = `<radialGradient id="g${u}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff"/>${fire}<stop offset="${look === 'pearl' ? '.5' : '.3'}" stop-color="${light(c.hex, look === 'metal' ? 0.3 : 0.15)}"/><stop offset=".75" stop-color="${c.hex}"/><stop offset="1" stop-color="${dark(c.hex, look === 'metal' ? 0.45 : 0.3)}"/></radialGradient>`;
    const t = 'translate(36 30) scale(7)', petals = Array.from({ length: 5 }, (_, k) => { const a = (k / 5) * 2 * Math.PI - Math.PI / 2; return [12 + 5.4 * Math.cos(a), 12.4 + 5.4 * Math.sin(a)]; });
    const ink = `fill="url(#g${u})" stroke="${INK}" stroke-width=".5" stroke-linejoin="round"`;
    const body = c.shape === 'pearl' ? `<circle cx="12" cy="12" r="9" ${ink}/>`
      : c.shape === 'flower' ? `${petals.map(([x, y]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4.4" ${ink}/>`).join('')}<circle cx="12" cy="12.4" r="3.4" ${ink}/>`
      : `<path d="${GEM[c.shape]}" ${ink}/>`;
    // facets: lines from the outline's corners to an inner table
    const facets = c.shape === 'stone' ? '<path d="M8.6 8.6h6.8v6.8H8.6zM12 2.5l-3.4 6.1M12 2.5l3.4 6.1M21.5 12l-6.1-3.4M21.5 12l-6.1 3.4M12 21.5l3.4-6.1M12 21.5l-3.4-6.1M2.5 12l6.1 3.4M2.5 12l6.1-3.4" fill="none" stroke="#fff" stroke-width=".35" opacity=".8"/>'
      : c.shape === 'pearl' ? '' : `<path d="${GEM[c.shape] || ''}" transform="translate(12 12) scale(.5) translate(-12 -12)" fill="#fff" opacity=".22"/>`;
    return `<defs>${grad}</defs>
      ${shadow(120, 206, 70, 9)}
      <g transform="${t}">${body}${facets}<ellipse cx="8.6" cy="7.6" rx="2.2" ry="1.3" fill="#fff" opacity=".85" transform="rotate(-30 8.6 7.6)"/></g>
      ${glint(178, 52, 14)}${glint(58, 176, 9, 0.85)}${glint(196, 160, 6, 0.7)}`;
  },
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
