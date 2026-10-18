// Hairstyle catalogue. A style is chosen from the ones that suit the face's natural hair texture, with
// weights by presentation only; ancestry never selects a style directly. Head coverings are offered to
// every face at the same rate. Geometry for each style lives in hair.js.
//
// textures: which natural textures can wear the style (straight, wavy, curly, coily)
// w: weights for [feminine, androgynous, masculine]
const ALL = ['straight', 'wavy', 'curly', 'coily'];
export const HAIR_STYLES = {
  'long-straight': { textures: ['straight', 'wavy'], w: [10, 2, 0.5], length: 'long' },
  'long-wavy': { textures: ['wavy', 'curly'], w: [9, 2, 0.3], length: 'long' },
  'silk-press': { textures: ['coily', 'curly'], w: [5, 1, 0], length: 'long' }, // straightened natural hair
  lob: { textures: ['straight', 'wavy'], w: [6, 3, 0.5], length: 'shoulder' },
  bob: { textures: ['straight', 'wavy', 'curly'], w: [6, 4, 0.3], length: 'chin' },
  pixie: { textures: ['straight', 'wavy'], w: [3, 5, 1], length: 'short' },
  'curly-long': { textures: ['curly'], w: [9, 2, 0.3], length: 'long' },
  'curly-shoulder': { textures: ['curly', 'wavy'], w: [8, 4, 1], length: 'shoulder' },
  afro: { textures: ['coily', 'curly'], w: [8, 6, 4], length: 'volume' },
  'afro-puffs': { textures: ['coily', 'curly'], w: [4, 1, 0], length: 'puffs' },
  twa: { textures: ['coily'], w: [2, 5, 8], length: 'short' }, // short natural hair
  'box-braids': { textures: ['coily', 'curly'], w: [7, 3, 1], length: 'long' },
  locs: { textures: ['coily', 'curly'], w: [5, 4, 4], length: 'long' },
  cornrows: { textures: ['coily', 'curly'], w: [3, 3, 4], length: 'short' },
  'high-ponytail': { textures: ALL, w: [5, 2, 0], length: 'tied' },
  'low-bun': { textures: ALL, w: [5, 3, 0.5], length: 'tied' },
  'top-knot': { textures: ['straight', 'wavy', 'curly'], w: [3, 3, 2], length: 'tied' },
  'short-crop': { textures: ['straight', 'wavy'], w: [0.5, 4, 10], length: 'short' },
  'curly-top': { textures: ['curly', 'coily'], w: [0.5, 3, 8], length: 'short' },
  buzz: { textures: ALL, w: [0.6, 3, 6], length: 'shaved' },
  hijab: { textures: ALL, w: [5, 0.5, 0], length: 'covered' },
  headwrap: { textures: ALL, w: [4, 1, 0.2], length: 'covered' },
};
export const PRESENTATIONS = ['feminine', 'androgynous', 'masculine'];
