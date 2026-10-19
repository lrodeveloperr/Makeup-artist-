// Colour catalogue for the four tools and the contact lenses (contract §4: stable ids, per-tool availability).
// Saved work stores the id, so once released an id's colour and finish never change and a retired colour stays
// here (unoffered) for old saves. Every colour here is a base colour, available from the start; the daily
// rotation will add one extra colour for one target.
//
// hex: sRGB. Optional finish: gloss (wet shine, lips) and shimmer (fine sparkle) in 0..1. Optional sheer: a
// lighter product (clear gloss, highlighter) whose colour builds more slowly while its shine does not; it is a
// property of the colour, not a setting.
const c = (id, name, hex, extra = {}) => ({ id, name, hex, ...extra });

export const PALETTE = {
  // blush, bronzer and contour, eyeshadow, highlighter and face colour
  brush: [
    c('brush-rose', 'Rose', '#e48a98'),
    c('brush-peach', 'Peach', '#f2a07b'),
    c('brush-coral', 'Coral', '#ee7a6a'),
    c('brush-berry', 'Berry', '#b0476b'),
    c('brush-bronze', 'Bronze', '#a86a45'),
    c('brush-taupe', 'Taupe', '#8d7466'),
    c('brush-champagne', 'Champagne', '#ecd3a8', { shimmer: 0.8, sheer: 0.6 }),
    c('brush-gold', 'Gold', '#d2a14a', { shimmer: 0.9 }),
    c('brush-plum', 'Plum', '#6f3a63'),
    c('brush-lilac', 'Lilac', '#b496d6'),
    c('brush-sky', 'Sky', '#79b3e3'),
    c('brush-emerald', 'Emerald', '#2e8a63'),
    c('brush-charcoal', 'Charcoal', '#3a3538'),
    c('brush-pearl', 'Pearl', '#f6efe6', { shimmer: 0.9, sheer: 0.4 }),
  ],
  // brows, eyeliner, fine marks and face art
  pencil: [
    c('pencil-black', 'Black', '#141214'),
    c('pencil-espresso', 'Espresso', '#3a2a22'),
    c('pencil-brown', 'Brown', '#6b4c3a'),
    c('pencil-taupe', 'Taupe', '#8a7468'),
    c('pencil-auburn', 'Auburn', '#7a3b25'),
    c('pencil-blonde', 'Blonde', '#b08a5a'),
    c('pencil-navy', 'Navy', '#1f2f66'),
    c('pencil-emerald', 'Emerald', '#145c46'),
    c('pencil-plum', 'Plum', '#5a2752'),
    c('pencil-white', 'White', '#f4f1ec'),
    c('pencil-gold', 'Gold', '#c9a043', { shimmer: 0.8 }),
  ],
  mascara: [
    c('mascara-black', 'Black', '#0d0c0e'),
    c('mascara-brown-black', 'Brown black', '#2a1d18'),
    c('mascara-brown', 'Brown', '#4a3226'),
    c('mascara-navy', 'Navy', '#1c2c62'),
    c('mascara-plum', 'Plum', '#4d1f4a'),
    c('mascara-emerald', 'Emerald', '#134d3a'),
  ],
  // lipsticks and glosses share the applicator (no separate gloss tool)
  lip: [
    c('lip-nude', 'Nude', '#c58f7f'),
    c('lip-mauve', 'Mauve', '#a9686f'),
    c('lip-rose', 'Rose', '#cf6e7c'),
    c('lip-pink', 'Pink', '#e46d97'),
    c('lip-coral', 'Coral', '#e86a58'),
    c('lip-red', 'Red', '#b8202e'),
    c('lip-berry', 'Berry', '#8c2346'),
    c('lip-plum', 'Plum', '#5e2443'),
    c('lip-brown', 'Brown', '#7a4436'),
    c('lip-clear-gloss', 'Clear gloss', '#f3d4cf', { gloss: 1, sheer: 0.25 }),
    c('lip-pink-gloss', 'Pink gloss', '#ef8fab', { gloss: 1 }),
    c('lip-red-gloss', 'Red gloss', '#c42a3a', { gloss: 1 }),
  ],
  // contact lenses: four iris stops from the pupil edge to the limbal ring (as IRIS in face/colors.js)
  lens: [
    c('lens-brown', 'Brown', '#8a6038', { iris: ['#8a6038', '#5a3a1e', '#3d2612', '#22150a'] }),
    c('lens-hazel', 'Hazel', '#8d7a45', { iris: ['#c9b27a', '#8d7a45', '#5f5a33', '#3a331c'] }),
    c('lens-honey', 'Honey', '#c99a3c', { iris: ['#e0b65a', '#c99a3c', '#8a6020', '#4a300c'] }),
    c('lens-green', 'Green', '#6f8e55', { iris: ['#b5c49a', '#6f8e55', '#4d6b3a', '#2c3f22'] }),
    c('lens-blue', 'Blue', '#5d90b3', { iris: ['#a8c4d6', '#5d90b3', '#34688d', '#1d3c55'] }),
    c('lens-aqua', 'Aqua', '#3fb0b8', { iris: ['#a9e4e6', '#3fb0b8', '#227d86', '#114448'] }),
    c('lens-grey', 'Grey', '#8b9aa3', { iris: ['#c4cdd2', '#8b9aa3', '#5f6e78', '#36424a'] }),
    c('lens-violet', 'Violet', '#8a6cc0', { iris: ['#c8b6e6', '#8a6cc0', '#5c4390', '#33244f'] }),
  ],
};

// Colours of the day (owner decision, 19 October 2026): special shades that are not in the base catalogue. One
// is offered each day (src/game/daily.js); one rewarded video adds it to its tool's colours for good.
const lens = (id, name, iris) => c(id, name, iris[1], { iris });
export const DAILY = {
  brush: [
    c('brush-neon-pink', 'Neon pink', '#ff3d9a'),
    c('brush-rose-gold', 'Rose gold', '#d9967f', { shimmer: 0.9 }),
    c('brush-opal', 'Opal', '#f3dff0', { shimmer: 1, sheer: 0.5 }),
    c('brush-electric-violet', 'Electric violet', '#8b3dff'),
    c('brush-sunset', 'Sunset', '#ff7a3d'),
    c('brush-mint', 'Mint', '#7fe0c0'),
    c('brush-copper', 'Copper', '#c06a3a', { shimmer: 0.9 }),
    c('brush-turquoise', 'Turquoise', '#19b8c8', { shimmer: 0.6 }),
    c('brush-silver', 'Silver', '#c9ccd4', { shimmer: 1 }),
    c('brush-cherry', 'Cherry', '#d0244a'),
  ],
  pencil: [
    c('pencil-electric-blue', 'Electric blue', '#1f6bff'),
    c('pencil-neon-green', 'Neon green', '#35d46a'),
    c('pencil-silver', 'Silver', '#c4c8d0', { shimmer: 0.9 }),
    c('pencil-rose-gold', 'Rose gold', '#d29a84', { shimmer: 0.8 }),
    c('pencil-burgundy', 'Burgundy', '#6e1a2e'),
    c('pencil-teal', 'Teal', '#0f7f84'),
  ],
  mascara: [
    c('mascara-electric-blue', 'Electric blue', '#1f4fd8'),
    c('mascara-violet', 'Violet', '#5b2a9a'),
    c('mascara-burgundy', 'Burgundy', '#5a1726'),
    c('mascara-teal', 'Teal', '#0d5f63'),
  ],
  lip: [
    c('lip-black-cherry', 'Black cherry', '#4a0f1f'),
    c('lip-fuchsia', 'Fuchsia', '#d6247a'),
    c('lip-orange', 'Orange', '#f2552c'),
    c('lip-holo-gloss', 'Holographic gloss', '#f2d6f0', { gloss: 1, shimmer: 1, sheer: 0.4 }),
    c('lip-nude-gloss', 'Nude gloss', '#d9a08e', { gloss: 1 }),
    c('lip-berry-gloss', 'Berry gloss', '#9c1f4f', { gloss: 1 }),
    c('lip-violet', 'Violet', '#6b2a8a'),
    c('lip-gold-gloss', 'Gold gloss', '#d8a64a', { gloss: 1, shimmer: 0.9 }),
  ],
  lens: [
    lens('lens-ice', 'Ice blue', ['#e4f2fb', '#a9d3ee', '#6aa6cf', '#2d5e80']),
    lens('lens-amethyst', 'Amethyst', ['#e0c4f2', '#a76fd6', '#7440a8', '#3d1f5c']),
    lens('lens-emerald', 'Emerald', ['#a8e6b8', '#2fa35a', '#1d7340', '#0d3d22']),
    lens('lens-gold', 'Gold', ['#f7e08a', '#d9a62b', '#a3741a', '#5a3d0a']),
    lens('lens-rose', 'Rose', ['#f7c6d4', '#e07a9a', '#b04a6e', '#5e2038']),
    lens('lens-sea', 'Sea green', ['#c8eee0', '#58b89a', '#2e8068', '#154536']),
  ],
};

export const TOOL_IDS = ['brush', 'pencil', 'mascara', 'lip'];
const BY_ID = new Map([
  ...Object.entries(PALETTE).flatMap(([target, list]) => list.map((e) => [e.id, { ...e, target }])),
  ...Object.entries(DAILY).flatMap(([target, list]) => list.map((e) => [e.id, { ...e, target, daily: true }])),
]);
// a catalogue colour by id (undefined if unknown); `target` is the tool (or 'lens') it belongs to; `daily` marks a
// colour of the day (usable once the player has earned it)
export const colourById = (id) => BY_ID.get(id);
// the colours a tool offers: the player's colours of the day (newest first), then the base catalogue
export const coloursFor = (tool, owned = []) => [...[...owned].reverse().map(colourById).filter((x) => x?.target === tool), ...PALETTE[tool]];
// the colour a new save starts with (contract §3: soft brush and an available base colour)
export const DEFAULT_SELECTION = { tool: 'brush', colour: { brush: 'brush-rose', pencil: 'pencil-espresso', mascara: 'mascara-black', lip: 'lip-rose', lens: 'lens-blue' } };
