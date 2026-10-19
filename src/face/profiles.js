// Ancestry profiles for the face generator. Every generated face is a young woman.
//
// A profile sets the base head (a mix of MakeHuman's three sculpted young-female heads, `BASE_HEADS`),
// a skin-tone range, undertone / hair-texture / natural hair-colour / iris weights, small extra shape
// tendencies, and the hairstyles that fit it (`STYLES`), so that face,
// skin and hair stay coherent with the ancestry (owner decision, 18 October 2026). Individual variation
// keeps faces from one profile different from each other. Shape tendencies follow published facial-
// anthropometry comparisons (e.g. Farkas et al. 2005, J Craniofac Surg 16:615) in direction only.
//
// Profile ids are internal. They are never shown to players and never decide tools, colours, difficulty,
// scores or what makeup a face "should" wear.

// skin tone: position on the continuous ramp in colors.js (0 = very fair, 1 = very deep)
// Natural lash and brow styles. Profiles without their own use the defaults; lashes: [lo, hi] ranges.
export const LASHES = { length: [1.0, 1.35], curl: [0.45, 0.85], density: [0.95, 1.2] };
export const BROWS = { 'soft-arch': 5, 'high-arch': 3, angled: 3, rounded: 2, straight: 2 };
const SHORT_STRAIGHT_LASHES = { length: [0.72, 0.95], curl: [0.15, 0.4], density: [0.8, 1.0] };
const SHORTER_LASHES = { length: [0.8, 1.05], curl: [0.2, 0.5], density: [0.85, 1.05] };
const FLAT_BROWS = { straight: 5, 'soft-arch': 4, rounded: 2, angled: 1 };
const SOFT_BROWS = { 'soft-arch': 5, straight: 4, rounded: 2, angled: 1 };

export const PROFILES = {
  'west-african': {
    tone: [0.6, 1.0], undertone: { neutral: 3, golden: 1, red: 1 },
    texture: { coily: 90, curly: 10 }, hair: { 'jet-black': 6, 'soft-black': 5, 'darkest-brown': 3 },
    iris: { 'dark-brown': 8, brown: 2 },
    shape: { 'nose-width': 0.45, 'nostril-width': 0.35, 'nose-depth': -0.15, 'nose-proj': -0.1, 'upper-lip-volume': 0.45,
      'lower-lip-volume': 0.45, 'mouth-width': 0.2, 'mouth-proj': 0.25, prognathism: 0.15, 'cheek-volume': 0.1 },
  },
  'east-african': {
    tone: [0.5, 0.9], undertone: { neutral: 3, golden: 2, red: 1 },
    texture: { coily: 50, curly: 45, wavy: 5 }, hair: { 'jet-black': 5, 'soft-black': 5, 'darkest-brown': 3, 'dark-brown': 1 },
    iris: { 'dark-brown': 6, brown: 4 },
    shape: { 'head-width': -0.25, 'head-height': 0.2, 'nose-width': 0.1, 'nose-proj': 0.1, 'nose-length': 0.1,
      'upper-lip-volume': 0.25, 'lower-lip-volume': 0.25, cheekbones: 0.15 },
  },
  'southern-central-african': {
    tone: [0.65, 1.0], undertone: { neutral: 3, red: 1, golden: 1 },
    texture: { coily: 95, curly: 5 }, hair: { 'jet-black': 6, 'soft-black': 5, 'darkest-brown': 3 },
    iris: { 'dark-brown': 8, brown: 2 },
    shape: { 'nose-width': 0.5, 'nostril-width': 0.4, 'nose-depth': -0.2, 'upper-lip-volume': 0.4, 'lower-lip-volume': 0.4,
      'mouth-proj': 0.2, cheekbones: 0.2, 'head-width': 0.1 },
  },
  'north-african-middle-eastern': {
    tone: [0.25, 0.6], undertone: { olive: 4, golden: 2, neutral: 2 },
    texture: { wavy: 45, curly: 35, straight: 20 },
    hair: { 'jet-black': 3, 'soft-black': 4, 'darkest-brown': 4, 'dark-brown': 4, chestnut: 2, 'medium-brown': 1, auburn: 0.4 },
    iris: { brown: 5, 'dark-brown': 4, hazel: 1.5, 'light-brown': 1, green: 0.5 },
    shape: { 'nose-length': 0.25, 'nose-proj': 0.3, 'nose-hump': 0.3, 'nose-width': -0.05, 'brow-proj': 0.15,
      'head-height': 0.15, 'eye-depth-1': 0.15 },
  },
  'mediterranean-european': {
    tone: [0.12, 0.42], undertone: { olive: 3, neutral: 3, golden: 1, pink: 1 },
    texture: { wavy: 45, straight: 35, curly: 20 },
    hair: { 'soft-black': 2, 'darkest-brown': 3, 'dark-brown': 5, chestnut: 4, 'medium-brown': 3, 'ash-brown': 1, 'light-brown': 1.5,
      'dark-blonde': 1, 'honey-blonde': 0.5, auburn: 0.8 },
    iris: { brown: 5, 'dark-brown': 2, hazel: 2.5, green: 1.2, 'light-brown': 1, blue: 0.8, grey: 0.3 },
    shape: { 'nose-proj': 0.25, 'nose-hump': 0.15, 'nose-length': 0.15, 'brow-proj': 0.15, 'upper-lip-volume': -0.05 },
  },
  'northern-european': {
    tone: [0.0, 0.3], undertone: { pink: 3, neutral: 3, red: 1.5, olive: 0.5 },
    texture: { straight: 60, wavy: 32, curly: 8 },
    hair: { 'dark-brown': 2, chestnut: 1.5, 'medium-brown': 3, 'ash-brown': 3, 'light-brown': 3, 'dark-blonde': 4, 'ash-blonde': 3,
      'honey-blonde': 2, 'golden-blonde': 2.5, 'light-blonde': 2, 'platinum-blonde': 0.8, 'strawberry-blonde': 1, copper: 1.3, auburn: 1.2 },
    iris: { blue: 5, grey: 2, green: 2, hazel: 2, 'light-brown': 1, brown: 2 },
    shape: { 'nose-width': -0.25, 'nostril-width': -0.2, 'nose-proj': 0.3, 'nose-length': 0.1, 'upper-lip-volume': -0.25,
      'lower-lip-volume': -0.15, 'brow-proj': 0.2, 'eye-depth-1': 0.2, 'head-depth': 0.1 },
  },
  'south-asian': {
    tone: [0.35, 0.82], undertone: { golden: 3, neutral: 2, olive: 1 },
    texture: { straight: 35, wavy: 50, curly: 15 }, hair: { 'jet-black': 5, 'soft-black': 5, 'darkest-brown': 4, 'dark-brown': 2 },
    iris: { brown: 5, 'dark-brown': 5, hazel: 0.6, 'light-brown': 0.8, green: 0.3, grey: 0.1 },
    shape: { 'nose-proj': 0.15, 'nose-length': 0.1, 'nose-width': 0.05, 'eye-size': 0.1, 'upper-lip-volume': 0.1,
      'lower-lip-volume': 0.1, 'head-width': -0.05, 'brow-proj': 0.05 },
  },
  'east-asian': {
    lashes: SHORT_STRAIGHT_LASHES, brows: FLAT_BROWS,
    tone: [0.08, 0.4], undertone: { golden: 4, neutral: 2, pink: 0.5 },
    texture: { straight: 88, wavy: 12 }, hair: { 'jet-black': 6, 'soft-black': 5, 'darkest-brown': 3, 'dark-brown': 1 },
    iris: { 'dark-brown': 7, brown: 3 },
    shape: { epicanthus: -0.75, 'lid-fold': 0.45, 'eye-outer-corner': 0.3, 'nose-depth': -0.3, 'nose-proj': -0.25, 'nose-width': 0.1, 'nose-length': -0.1,
      cheekbones: 0.35, 'head-width': 0.25, 'brow-proj': -0.25, 'eye-depth-1': -0.2, 'mouth-proj': -0.05 },
  },
  'southeast-asian': {
    lashes: SHORTER_LASHES, brows: SOFT_BROWS,
    tone: [0.3, 0.7], undertone: { golden: 4, olive: 1, neutral: 2 },
    texture: { straight: 70, wavy: 25, curly: 5 }, hair: { 'jet-black': 6, 'soft-black': 5, 'darkest-brown': 3, 'dark-brown': 1 },
    iris: { 'dark-brown': 6, brown: 4 },
    shape: { epicanthus: -0.45, 'lid-fold': 0.3, 'nose-width': 0.3, 'nose-depth': -0.25, 'nose-proj': -0.15,
      'upper-lip-volume': 0.2, 'lower-lip-volume': 0.2, cheekbones: 0.2, 'head-width': 0.15, 'mouth-proj': 0.1 },
  },
  'central-asian': {
    lashes: SHORTER_LASHES, brows: SOFT_BROWS,
    tone: [0.12, 0.45], undertone: { golden: 3, neutral: 2, olive: 1, pink: 1 },
    texture: { straight: 75, wavy: 25 }, hair: { 'jet-black': 4, 'soft-black': 4, 'darkest-brown': 4, 'dark-brown': 3, chestnut: 1, 'medium-brown': 1 },
    iris: { 'dark-brown': 4, brown: 4, hazel: 1.5, green: 0.6, 'light-brown': 1, blue: 0.3 },
    shape: { epicanthus: -0.45, 'lid-fold': 0.3, 'eye-outer-corner': 0.2, cheekbones: 0.35, 'head-width': 0.25, 'nose-proj': -0.05 },
  },
  'indigenous-americas': {
    lashes: SHORTER_LASHES, brows: SOFT_BROWS,
    tone: [0.3, 0.68], undertone: { golden: 3, red: 2, olive: 1, neutral: 1 },
    texture: { straight: 90, wavy: 10 }, hair: { 'jet-black': 7, 'soft-black': 4, 'darkest-brown': 2 },
    iris: { 'dark-brown': 7, brown: 3 },
    shape: { cheekbones: 0.4, 'head-width': 0.25, epicanthus: -0.25, 'lid-fold': 0.2, 'nose-proj': 0.1, 'nose-hump': 0.1, 'nose-width': 0.15 },
  },
  'pacific-islander': {
    tone: [0.42, 0.75], undertone: { golden: 3, neutral: 2, red: 1 },
    texture: { wavy: 45, curly: 35, straight: 20 }, hair: { 'jet-black': 4, 'soft-black': 4, 'darkest-brown': 4, 'dark-brown': 3 },
    iris: { 'dark-brown': 6, brown: 4 },
    shape: { 'head-width': 0.3, 'nose-width': 0.3, 'upper-lip-volume': 0.25, 'lower-lip-volume': 0.25, cheekbones: 0.15,
      'face-fat': 0.15, 'chin-width': 0.15 },
  },
  melanesian: {
    tone: [0.62, 1.0], undertone: { neutral: 3, red: 1, golden: 1 },
    texture: { coily: 75, curly: 25 }, hair: { 'jet-black': 5, 'soft-black': 4, 'darkest-brown': 3 },
    iris: { 'dark-brown': 8, brown: 2 },
    shape: { 'nose-width': 0.45, 'brow-proj': 0.3, 'upper-lip-volume': 0.35, 'lower-lip-volume': 0.35, 'mouth-proj': 0.2, 'nose-proj': -0.05 },
  },
  'aboriginal-australian': {
    tone: [0.6, 0.98], undertone: { neutral: 3, red: 1, golden: 1 },
    texture: { wavy: 40, curly: 45, straight: 15 }, hair: { 'jet-black': 3, 'soft-black': 4, 'darkest-brown': 4, 'dark-brown': 3 },
    iris: { 'dark-brown': 7, brown: 3 },
    shape: { 'brow-proj': 0.45, 'nose-width': 0.4, 'eye-depth-1': 0.3, 'upper-lip-volume': 0.2, 'lower-lip-volume': 0.2, 'mouth-proj': 0.15 },
  },
  'arctic-indigenous': {
    lashes: SHORT_STRAIGHT_LASHES, brows: FLAT_BROWS,
    tone: [0.22, 0.55], undertone: { golden: 3, neutral: 2, red: 1 },
    texture: { straight: 95, wavy: 5 }, hair: { 'jet-black': 7, 'soft-black': 4, 'darkest-brown': 2 },
    iris: { 'dark-brown': 7, brown: 3 },
    shape: { epicanthus: -0.7, 'lid-fold': 0.45, 'eye-outer-corner': 0.2, cheekbones: 0.4, 'head-width': 0.35, 'nose-width': -0.05, 'nose-proj': -0.15, 'face-fat': 0.1 },
  },
};

// Mixed heritage recipes: a face drawn from one of these blends two or three profiles with random weights.
export const BLENDS = {
  'latin-american': ['indigenous-americas', 'mediterranean-european', 'west-african'],
  'afro-caribbean': ['west-african', 'northern-european', 'south-asian'],
  'afro-latin': ['west-african', 'indigenous-americas', 'mediterranean-european'],
  'south-african-coloured': ['southern-central-african', 'northern-european', 'southeast-asian'],
  'central-asian-european': ['central-asian', 'northern-european'],
  'arab-african': ['north-african-middle-eastern', 'east-african'],
  'east-asian-european': ['east-asian', 'northern-european'],
  'south-asian-european': ['south-asian', 'northern-european'],
};

// Base head per profile: weights of MakeHuman's sculpted african / asian / caucasian young-female heads.
export const BASE_HEADS = {
  'west-african': { african: 1 },
  'east-african': { african: 0.7, caucasian: 0.3 },
  'southern-central-african': { african: 1 },
  'north-african-middle-eastern': { caucasian: 0.85, african: 0.15 },
  'mediterranean-european': { caucasian: 1 },
  'northern-european': { caucasian: 1 },
  'south-asian': { caucasian: 0.65, african: 0.2, asian: 0.15 },
  'east-asian': { asian: 1 },
  'southeast-asian': { asian: 0.8, african: 0.1, caucasian: 0.1 },
  'central-asian': { asian: 0.6, caucasian: 0.4 },
  'indigenous-americas': { asian: 0.75, caucasian: 0.25 },
  'pacific-islander': { asian: 0.5, african: 0.3, caucasian: 0.2 },
  melanesian: { african: 0.85, asian: 0.15 },
  'aboriginal-australian': { african: 0.75, caucasian: 0.25 },
  'arctic-indigenous': { asian: 1 },
};

// Hairstyles that fit each profile (weights; a style is only used if it suits the face's natural texture).
// All of them are long (see hair-styles.js).
const AFRICAN_STYLES = { 'box-braids': 8, 'silk-press': 6, 'cornrow-braids': 5, locs: 4, 'curly-long': 5 };
export const STYLES = {
  'west-african': AFRICAN_STYLES,
  'east-african': { ...AFRICAN_STYLES, 'curly-long': 6, 'long-wavy': 3 },
  'southern-central-african': AFRICAN_STYLES,
  'north-african-middle-eastern': { 'long-wavy': 7, 'long-straight': 6, 'curly-long': 5, 'long-layered': 3 },
  'mediterranean-european': { 'long-wavy': 7, 'long-straight': 6, 'long-layered': 4, 'curly-long': 3 },
  'northern-european': { 'long-straight': 7, 'long-wavy': 6, 'long-layered': 5, 'curly-long': 1 },
  'south-asian': { 'long-straight': 7, 'long-wavy': 7, 'curly-long': 3, 'long-layered': 2 },
  'east-asian': { 'long-straight': 10, 'long-layered': 5, 'long-wavy': 3 },
  'southeast-asian': { 'long-straight': 9, 'long-wavy': 4, 'long-layered': 3 },
  'central-asian': { 'long-straight': 8, 'long-wavy': 4, 'long-layered': 2 },
  'indigenous-americas': { 'long-straight': 10, 'long-wavy': 2, 'long-layered': 2 },
  'pacific-islander': { 'long-wavy': 8, 'curly-long': 6, 'long-straight': 5 },
  melanesian: { 'curly-long': 6, 'box-braids': 3, locs: 2, 'silk-press': 1 },
  'aboriginal-australian': { 'long-wavy': 6, 'curly-long': 6, 'long-straight': 3 },
  'arctic-indigenous': { 'long-straight': 10, 'long-layered': 2 },
};

// How often each kind of origin is drawn. Profiles are drawn evenly (not by world population) so every
// session meets a wide range of faces. Mixed heritage uses the named blends only.
export const ORIGIN_WEIGHTS = { single: 0.75, blend: 0.25 };
// Profile shape tendencies are applied at this strength on top of the sculpted base heads, except the eyelid
// fold, which defines the eye's look and stays natural at full strength.
export const PROFILE_SHAPE_SCALE = 0.5;
export const FULL_STRENGTH = new Set(['epicanthus', 'lid-fold']);
export const TRAITS = { highlights: 0.1 };
