// Pictures of the tools in a colour, in the sticker style of the controls (ink outlines). The colour of the day is
// shown as its tool in that colour: no words needed. Gloss adds a wet highlight, shimmer adds sparkles.
const INK = '#2a1d15';
let ids = 0;

const sparkle = (x, y, r) => `<path d="M${x} ${y - r}l${r * 0.28} ${r * 0.72} ${r * 0.72} ${r * 0.28}-${r * 0.72} ${r * 0.28}-${r * 0.28} ${r * 0.72}-${r * 0.28}-${r * 0.72}-${r * 0.72}-${r * 0.28} ${r * 0.72}-${r * 0.28}z" fill="#fff" opacity=".95"/>`;
const sparkles = (c, points) => (c.shimmer ? points.map(([x, y, r]) => sparkle(x, y, r)).join('') : '');

const ART = {
  // a lipstick, bullet out
  lip: (c) => `
    <rect x="38" y="70" width="44" height="42" rx="7" fill="#3a2a22" stroke="${INK}" stroke-width="3"/>
    <rect x="45" y="77" width="7" height="28" rx="3.5" fill="#fff" opacity=".18"/>
    <rect x="41" y="57" width="38" height="15" rx="3" fill="#e9c46a" stroke="${INK}" stroke-width="3"/>
    <path d="M47 57V31q0-7 7-10.5L73 11v46z" fill="${c.hex}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M52.5 53V32q0-3.5 3.5-5.2l1.5-.7V53z" fill="#fff" opacity="${c.gloss ? 0.7 : 0.3}"/>
    ${c.gloss ? '<ellipse cx="65" cy="24" rx="3" ry="6" fill="#fff" opacity=".8" transform="rotate(-25 65 24)"/>' : ''}
    ${sparkles(c, [[63, 36, 5], [57, 47, 3.5], [68, 50, 3]])}`,
  // a powder compact in the colour, with its brush
  brush: (c) => `
    <circle cx="44" cy="76" r="31" fill="#fff6e6" stroke="${INK}" stroke-width="3"/>
    <circle cx="44" cy="76" r="23" fill="${c.hex}" stroke="${INK}" stroke-width="2.5"/>
    <ellipse cx="36" cy="68" rx="9" ry="5" fill="#fff" opacity=".28" transform="rotate(-30 36 68)"/>
    ${sparkles(c, [[34, 82, 5], [52, 70, 4], [48, 88, 3]])}
    <path d="M106 110L82 68" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>
    <path d="M106 110L82 68" stroke="#7a4a32" stroke-width="7" stroke-linecap="round"/>
    <path d="M84 72L74 54" stroke="${INK}" stroke-width="16" stroke-linecap="round"/>
    <path d="M84 72L74 54" stroke="#d8d6de" stroke-width="10" stroke-linecap="round"/>
    <path d="M75 55C60 40 60 18 72 9c13 4 18 25 9 43z" fill="url(#g${ids})" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  // a pencil, sharpened
  pencil: (c) => `
    <g transform="rotate(-40 60 60)">
      <rect x="10" y="49" width="12" height="22" rx="3" fill="#e9c46a" stroke="${INK}" stroke-width="3"/>
      <rect x="20" y="49" width="62" height="22" fill="${c.hex}" stroke="${INK}" stroke-width="3"/>
      <rect x="22" y="52.5" width="58" height="4" fill="#fff" opacity=".3"/>
      <path d="M82 49l22 11-22 11z" fill="#f3d2a2" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M96 56l8 4-8 4z" fill="${c.hex}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      ${sparkles(c, [[40, 60, 5], [62, 63, 4]])}
    </g>`,
  // a mascara tube and its wand
  mascara: (c) => `
    <rect x="16" y="34" width="34" height="74" rx="11" fill="${c.hex}" stroke="${INK}" stroke-width="3"/>
    <rect x="22" y="42" width="6" height="56" rx="3" fill="#fff" opacity=".3"/>
    <rect x="13" y="26" width="40" height="12" rx="4" fill="#e9c46a" stroke="${INK}" stroke-width="3"/>
    ${sparkles(c, [[36, 64, 5], [30, 86, 3.5]])}
    <path d="M62 104L92 46" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <rect x="56" y="98" width="16" height="14" rx="3" fill="#e9c46a" stroke="${INK}" stroke-width="3" transform="rotate(27 64 105)"/>
    <g transform="rotate(27 98 32)">
      <rect x="90" y="8" width="16" height="46" rx="8" fill="${INK}"/>
      ${Array.from({ length: 9 }, (_, k) => `<path d="M86 ${12 + k * 4.6}h24" stroke="${c.hex}" stroke-width="3.2" stroke-linecap="round"/>`).join('')}
    </g>`,
  // an eye wearing the lens
  lens: (c) => `
    <path d="M8 62Q60 16 112 62 60 108 8 62z" fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="60" cy="62" r="27" fill="url(#g${ids})" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="60" cy="62" r="10" fill="${INK}"/>
    <circle cx="69" cy="52" r="5.5" fill="#fff"/>
    <path d="M24 38l-6-8M40 28l-3-9M60 24v-9M80 28l3-9M96 38l6-8" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
};

// gradients the pictures use: the brush tip dipped in the colour; the lens iris from its stops
const DEFS = {
  brush: (c, id) => `<linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.hex}"/><stop offset=".55" stop-color="${c.hex}"/><stop offset="1" stop-color="#f5e6d6"/></linearGradient>`,
  lens: (c, id) => `<radialGradient id="g${id}"><stop offset=".3" stop-color="${c.iris[0]}"/><stop offset=".6" stop-color="${c.iris[1]}"/><stop offset=".85" stop-color="${c.iris[2]}"/><stop offset="1" stop-color="${c.iris[3]}"/></radialGradient>`,
};

// the picture of a colour's tool in that colour (c: a palette entry with its target)
export function toolArt(c) {
  ids++;
  const defs = DEFS[c.target] ? `<defs>${DEFS[c.target](c, ids)}</defs>` : '';
  return `<svg viewBox="0 0 120 120" aria-hidden="true">${defs}${ART[c.target](c)}</svg>`;
}
