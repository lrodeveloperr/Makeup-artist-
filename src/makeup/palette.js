// Colour catalogue for the four tools and the contact lenses (contract §4: stable ids, per-tool availability).
// Saved work stores the id, so once released an id's colour and finish never change and a retired colour stays
// here (unoffered) for old saves. Every colour here is a base colour, available from the start; the daily
// rotation will add one extra colour for one target.
//
// hex: sRGB. Optional finish: gloss (wet shine, lips) and shimmer (fine sparkle) in 0..1. Optional sheer: a
// lighter product (clear gloss, highlighter) whose colour builds more slowly while its shine does not; it is a
// property of the colour, not a setting.
const c = (id, name, hex, extra = {}) => ({ id, name, hex, ...extra });

// The base colours: everyday shades, all available from the start (owner decision, 19 October 2026: basic colours
// here; shimmers, glosses and fantasy shades are colours of the day, below).
export const PALETTE = {
  // blush, bronzer and contour, eyeshadow and face colour
  brush: [
    c('brush-rose', 'Rose', '#e48a98'),
    c('brush-peach', 'Peach', '#f2a07b'),
    c('brush-coral', 'Coral', '#ee7a6a'),
    c('brush-berry', 'Berry', '#b0476b'),
    c('brush-bronze', 'Bronze', '#a86a45'),
    c('brush-taupe', 'Taupe', '#8d7466'),
    c('brush-plum', 'Plum', '#6f3a63'),
    c('brush-charcoal', 'Charcoal', '#3a3538'),
  ],
  // brows, eyeliner, fine marks and face art
  pencil: [
    c('pencil-black', 'Black', '#141214'),
    c('pencil-espresso', 'Espresso', '#3a2a22'),
    c('pencil-brown', 'Brown', '#6b4c3a'),
    c('pencil-taupe', 'Taupe', '#8a7468'),
    c('pencil-auburn', 'Auburn', '#7a3b25'),
    c('pencil-blonde', 'Blonde', '#b08a5a'),
    c('pencil-white', 'White', '#f4f1ec'),
  ],
  mascara: [
    c('mascara-black', 'Black', '#0d0c0e'),
    c('mascara-brown-black', 'Brown black', '#2a1d18'),
    c('mascara-brown', 'Brown', '#4a3226'),
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
  ],
  // contact lenses: four iris stops from the pupil edge to the limbal ring (as IRIS in face/colors.js)
  lens: [
    c('lens-brown', 'Brown', '#8a6038', { iris: ['#8a6038', '#5a3a1e', '#3d2612', '#22150a'] }),
    c('lens-hazel', 'Hazel', '#8d7a45', { iris: ['#c9b27a', '#8d7a45', '#5f5a33', '#3a331c'] }),
    c('lens-honey', 'Honey', '#c99a3c', { iris: ['#e0b65a', '#c99a3c', '#8a6020', '#4a300c'] }),
    c('lens-green', 'Green', '#6f8e55', { iris: ['#b5c49a', '#6f8e55', '#4d6b3a', '#2c3f22'] }),
    c('lens-blue', 'Blue', '#5d90b3', { iris: ['#a8c4d6', '#5d90b3', '#34688d', '#1d3c55'] }),
    c('lens-grey', 'Grey', '#8b9aa3', { iris: ['#c4cdd2', '#8b9aa3', '#5f6e78', '#36424a'] }),
  ],
};

// Colours of the day (owner decisions, 19 October 2026): everything beyond the everyday base, for every tool: the
// shimmers, glosses, metallics, neons and fantasy shades, as many coherent, tellable-apart colours as each tool can
// carry (tests/makeup.mjs checks every pair). One is offered each day (src/game/daily.js); one rewarded video adds
// it to that tool's colours for good.
const lens = (id, name, iris) => c(id, name, iris[1], { iris });
export const DAILY = {
  // eyeshadow, blush, highlighter and face colour
  brush: [
    // pinks and reds
    c('brush-baby-pink', 'Baby pink', '#f7b8cc'),
    c('brush-bubblegum', 'Bubblegum', '#ff8fc8'),
    c('brush-hot-pink', 'Hot pink', '#ff4fa3'),
    c('brush-neon-pink', 'Neon pink', '#ff2a8f'),
    c('brush-magenta', 'Magenta', '#d4188a'),
    c('brush-cherry', 'Cherry', '#d0244a'),
    c('brush-scarlet', 'Scarlet', '#ea3a2e'),
    c('brush-sunset', 'Sunset', '#ff7a3d'),
    c('brush-tangerine', 'Tangerine', '#ffa02e'),
    c('brush-terracotta', 'Terracotta', '#c8623f'),
    // purples
    c('brush-lavender', 'Lavender', '#cdb8ee'),
    c('brush-lilac', 'Lilac', '#b496d6'),
    c('brush-orchid', 'Orchid', '#c85bb8'),
    c('brush-electric-violet', 'Electric violet', '#8b3dff'),
    c('brush-grape', 'Grape', '#6a2d91'),
    // blues
    c('brush-periwinkle', 'Periwinkle', '#9aa8f4'),
    c('brush-sky', 'Sky', '#79b3e3'),
    c('brush-aqua', 'Aqua', '#5ad4e0'),
    c('brush-turquoise', 'Turquoise', '#19b8c8', { shimmer: 0.6 }),
    c('brush-teal', 'Teal', '#148f8f'),
    c('brush-cobalt', 'Cobalt', '#2448c8'),
    c('brush-navy', 'Navy', '#223061'),
    // greens and yellows
    c('brush-mint', 'Mint', '#7fe0c0'),
    c('brush-lime', 'Lime', '#a8e03a'),
    c('brush-emerald', 'Emerald', '#2e8a63'),
    c('brush-forest', 'Forest', '#1f5c3a'),
    c('brush-olive', 'Olive', '#7f8a3a'),
    c('brush-lemon', 'Lemon', '#f6e24a'),
    // neutrals and darks
    c('brush-white', 'White', '#fbfbfb'),
    c('brush-chocolate', 'Chocolate', '#4a2c22'),
    c('brush-black', 'Black', '#1a1718'),
    // shimmers and metallics
    c('brush-pearl', 'Pearl', '#f6efe6', { shimmer: 0.9, sheer: 0.4 }),
    c('brush-opal', 'Opal', '#f3dff0', { shimmer: 1, sheer: 0.5 }),
    c('brush-holographic', 'Holographic', '#dcd0f4', { shimmer: 1, sheer: 0.5 }),
    c('brush-moonstone', 'Moonstone', '#c4bcd0', { shimmer: 0.9 }),
    c('brush-icy-blue', 'Icy blue', '#bfe3f7', { shimmer: 0.9 }),
    c('brush-champagne', 'Champagne', '#ecd3a8', { shimmer: 0.8, sheer: 0.6 }),
    c('brush-peach-shimmer', 'Peach shimmer', '#ffc29a', { shimmer: 0.9 }),
    c('brush-rose-gold', 'Rose gold', '#d9967f', { shimmer: 0.9 }),
    c('brush-gold', 'Gold', '#d2a14a', { shimmer: 0.9 }),
    c('brush-amber', 'Amber', '#d98a2b', { shimmer: 0.9 }),
    c('brush-copper', 'Copper', '#c06a3a', { shimmer: 0.9 }),
    c('brush-bronze-shimmer', 'Bronze shimmer', '#9c5a2e', { shimmer: 0.9 }),
    c('brush-silver', 'Silver', '#c9ccd4', { shimmer: 1 }),
    c('brush-gunmetal', 'Gunmetal', '#6b6f7a', { shimmer: 0.9 }),
    c('brush-plum-shimmer', 'Plum shimmer', '#8a3f82', { shimmer: 0.9 }),
    c('brush-pink-glitter', 'Pink glitter', '#ff7acb', { shimmer: 1 }),
  ],
  // eyeliner, brows, fine lines and face art
  pencil: [
    c('pencil-grey', 'Grey', '#8a8f99'),
    c('pencil-charcoal', 'Charcoal', '#3c3a40'),
    c('pencil-burgundy', 'Burgundy', '#6e1a2e'),
    c('pencil-red', 'Red', '#d42a2a'),
    c('pencil-orange', 'Orange', '#ff7a2a'),
    c('pencil-yellow', 'Yellow', '#f2d33a'),
    c('pencil-hot-pink', 'Hot pink', '#ff5fa8'),
    c('pencil-magenta', 'Magenta', '#d0218a'),
    c('pencil-plum', 'Plum', '#5a2752'),
    c('pencil-violet', 'Violet', '#7b3fbf'),
    c('pencil-lavender', 'Lavender', '#b39ddb'),
    c('pencil-navy', 'Navy', '#1f2f66'),
    c('pencil-cobalt', 'Cobalt', '#1e3fb0'),
    c('pencil-electric-blue', 'Electric blue', '#1f6bff'),
    c('pencil-sky', 'Sky blue', '#7fb9ee'),
    c('pencil-turquoise', 'Turquoise', '#1fb5c0'),
    c('pencil-teal', 'Teal', '#0f7f84'),
    c('pencil-emerald', 'Emerald', '#145c46'),
    c('pencil-forest', 'Forest', '#1d5a34'),
    c('pencil-neon-green', 'Neon green', '#35d46a'),
    c('pencil-lime', 'Lime', '#9bd82a'),
    c('pencil-olive', 'Olive', '#7a7f33'),
    c('pencil-copper', 'Copper', '#b86a3a', { shimmer: 0.8 }),
    c('pencil-gold', 'Gold', '#c9a043', { shimmer: 0.8 }),
    c('pencil-rose-gold', 'Rose gold', '#d29a84', { shimmer: 0.8 }),
    c('pencil-silver', 'Silver', '#c4c8d0', { shimmer: 0.9 }),
    c('pencil-icy-white', 'Icy white', '#eef4ff', { shimmer: 0.9 }),
    c('pencil-black-glitter', 'Black glitter', '#1c1a22', { shimmer: 1 }),
  ],
  mascara: [
    c('mascara-grey', 'Grey', '#7a7d85'),
    c('mascara-white', 'White', '#e8e6e2'),
    c('mascara-burgundy', 'Burgundy', '#5a1726'),
    c('mascara-red', 'Red', '#c0282e'),
    c('mascara-orange', 'Orange', '#e0602a'),
    c('mascara-pink', 'Pink', '#e86aa8'),
    c('mascara-magenta', 'Magenta', '#b8237a'),
    c('mascara-plum', 'Plum', '#4d1f4a'),
    c('mascara-violet', 'Violet', '#5b2a9a'),
    c('mascara-purple', 'Purple', '#8a4fd0'),
    c('mascara-navy', 'Navy', '#1c2c62'),
    c('mascara-electric-blue', 'Electric blue', '#1f4fd8'),
    c('mascara-sky', 'Sky blue', '#5aa0e0'),
    c('mascara-turquoise', 'Turquoise', '#1f9fb0'),
    c('mascara-teal', 'Teal', '#0d5f63'),
    c('mascara-emerald', 'Emerald', '#134d3a'),
    c('mascara-green', 'Green', '#2a7a3a'),
    c('mascara-lime', 'Lime', '#7cbf2a'),
    c('mascara-copper', 'Copper', '#a0522a', { shimmer: 0.8 }),
    c('mascara-gold', 'Gold', '#c9982e', { shimmer: 0.8 }),
    c('mascara-silver', 'Silver', '#b8bcc6', { shimmer: 0.8 }),
  ],
  // lipsticks, glosses and metallics (one applicator)
  lip: [
    // pinks and nudes
    c('lip-baby-pink', 'Baby pink', '#f5a6c4'),
    c('lip-bubblegum', 'Bubblegum', '#ff7fc0'),
    c('lip-hot-pink', 'Hot pink', '#ff2e8a'),
    c('lip-fuchsia', 'Fuchsia', '#d6247a'),
    c('lip-magenta', 'Magenta', '#b0147a'),
    c('lip-peach', 'Peach', '#ffab8a'),
    c('lip-terracotta', 'Terracotta', '#c76a4a'),
    c('lip-chocolate', 'Chocolate', '#5a3222'),
    // reds and oranges
    c('lip-scarlet', 'Scarlet', '#ef2d2d'),
    c('lip-brick', 'Brick', '#a63a2a'),
    c('lip-orange', 'Orange', '#f2552c'),
    c('lip-tangerine', 'Tangerine', '#ff8a3a'),
    c('lip-black-cherry', 'Black cherry', '#4a0f1f'),
    // purples and fantasy
    c('lip-lavender', 'Lavender', '#b79fdc'),
    c('lip-violet', 'Violet', '#6b2a8a'),
    c('lip-cobalt', 'Cobalt', '#2a4fd0'),
    c('lip-teal', 'Teal', '#1b8f8a'),
    c('lip-mint', 'Mint', '#7fd6b8'),
    c('lip-green', 'Green', '#2f8a4a'),
    c('lip-lime', 'Lime', '#a3d53a'),
    c('lip-yellow', 'Yellow', '#f2d23a'),
    c('lip-grey', 'Grey', '#8a8c92'),
    c('lip-white', 'White', '#f4efe9'),
    c('lip-black', 'Black', '#1a1416'),
    // glosses
    c('lip-clear-gloss', 'Clear gloss', '#f3d4cf', { gloss: 1, sheer: 0.25 }),
    c('lip-nude-gloss', 'Nude gloss', '#d9a08e', { gloss: 1 }),
    c('lip-rose-gloss', 'Rose gloss', '#d9748a', { gloss: 1 }),
    c('lip-pink-gloss', 'Pink gloss', '#ef8fab', { gloss: 1 }),
    c('lip-coral-gloss', 'Coral gloss', '#ef7a66', { gloss: 1 }),
    c('lip-red-gloss', 'Red gloss', '#c42a3a', { gloss: 1 }),
    c('lip-berry-gloss', 'Berry gloss', '#9c1f4f', { gloss: 1 }),
    c('lip-plum-gloss', 'Plum gloss', '#6b2d55', { gloss: 1 }),
    c('lip-lilac-gloss', 'Lilac gloss', '#c9a6e6', { gloss: 1 }),
    // metallics and glitter
    c('lip-holo-gloss', 'Holographic gloss', '#f2d6f0', { gloss: 1, shimmer: 1, sheer: 0.4 }),
    c('lip-gold-gloss', 'Gold gloss', '#d8a64a', { gloss: 1, shimmer: 0.9 }),
    c('lip-rose-gold', 'Rose gold', '#cf8f72', { shimmer: 0.9 }),
    c('lip-copper', 'Copper', '#b8633a', { shimmer: 0.9 }),
    c('lip-bronze', 'Bronze', '#8f5a35', { shimmer: 0.8 }),
    c('lip-silver', 'Silver', '#c0c4cc', { shimmer: 0.9 }),
    c('lip-pink-glitter', 'Pink glitter', '#f06aa8', { gloss: 1, shimmer: 1 }),
    c('lip-red-glitter', 'Red glitter', '#d81b4a', { gloss: 1, shimmer: 1 }),
  ],
  // contact lenses (four iris stops from the pupil edge to the limbal ring)
  lens: [
    lens('lens-ice', 'Ice blue', ['#e4f2fb', '#a9d3ee', '#6aa6cf', '#2d5e80']),
    lens('lens-aqua', 'Aqua', ['#a9e4e6', '#3fb0b8', '#227d86', '#114448']),
    lens('lens-sapphire', 'Sapphire', ['#9ab6ff', '#3a5fe0', '#2240a8', '#121f55']),
    lens('lens-sea', 'Sea green', ['#c8eee0', '#58b89a', '#2e8068', '#154536']),
    lens('lens-emerald', 'Emerald', ['#a8e6b8', '#2fa35a', '#1d7340', '#0d3d22']),
    lens('lens-lime', 'Lime', ['#dff5a0', '#9fd63a', '#6a9a22', '#3a5510']),
    lens('lens-forest', 'Forest', ['#9fcf9a', '#3f7f3f', '#2a5a2a', '#13301a']),
    lens('lens-gold', 'Gold', ['#f7e08a', '#d9a62b', '#a3741a', '#5a3d0a']),
    lens('lens-yellow', 'Yellow', ['#fff3a0', '#f2d23a', '#b89a12', '#5a4a08']),
    lens('lens-orange', 'Orange', ['#ffc28a', '#f07a2a', '#b04a12', '#5a2408']),
    lens('lens-ruby', 'Ruby', ['#ff9aa8', '#e0304a', '#a01a30', '#500a18']),
    lens('lens-rose', 'Rose', ['#f7c6d4', '#e07a9a', '#b04a6e', '#5e2038']),
    lens('lens-pink', 'Pink', ['#ffc6e6', '#f07ac0', '#b8408a', '#5a1a44']),
    lens('lens-violet', 'Violet', ['#c8b6e6', '#8a6cc0', '#5c4390', '#33244f']),
    lens('lens-amethyst', 'Amethyst', ['#e0c4f2', '#a76fd6', '#7440a8', '#3d1f5c']),
    lens('lens-snow', 'Snow', ['#ffffff', '#e8ecf0', '#b0b8c0', '#60686f']),
    lens('lens-black', 'Black', ['#6a6a70', '#2a2a30', '#141418', '#050507']),
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
