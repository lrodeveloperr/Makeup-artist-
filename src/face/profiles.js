// Ancestry profiles for the face generator.
//
// A profile is a set of *tendencies*: a skin-tone range, undertone / hair-texture / hair-colour / iris
// weights, and small mean offsets on the head-shape dimensions (see tools/makehuman/dims.mjs). Every face
// also gets individual variation that is larger than any profile offset, so faces from one profile differ
// from each other more than profiles differ on average. Offsets are capped (|mean| <= 0.5) so nobody is
// drawn as a caricature. Shape tendencies follow published facial-anthropometry comparisons (e.g. Farkas
// et al. 2005, J Craniofac Surg 16:615) only in direction and roughly in size; they are not measurements.
//
// Profile ids are internal. They are never shown to players and never decide tools, colours, difficulty,
// scores or what makeup a face "should" wear. Cultural choices (head coverings, braids vs. loose hair as a
// style, dyed colours) are not profile traits: they are drawn from texture-compatible style lists the same
// way for everyone (see hair-styles.js).

// skin tone: position on the continuous ramp in colors.js (0 = very fair, 1 = very deep)
export const PROFILES = {
  'west-african': {
    tone: [0.6, 1.0], undertone: { neutral: 3, golden: 1, red: 1 },
    texture: { coily: 90, curly: 10 }, hair: { 'jet-black': 7, 'soft-black': 4 },
    iris: { 'dark-brown': 8, brown: 2 },
    shape: { 'nose-width': 0.45, 'nostril-width': 0.35, 'nose-depth': -0.15, 'nose-proj': -0.1, 'upper-lip-volume': 0.45,
      'lower-lip-volume': 0.45, 'mouth-width': 0.2, 'mouth-proj': 0.25, prognathism: 0.15, 'cheek-volume': 0.1 },
  },
  'east-african': {
    tone: [0.5, 0.9], undertone: { neutral: 3, golden: 2, red: 1 },
    texture: { coily: 50, curly: 45, wavy: 5 }, hair: { 'jet-black': 6, 'soft-black': 5 },
    iris: { 'dark-brown': 6, brown: 4 },
    shape: { 'head-width': -0.25, 'head-height': 0.2, 'nose-width': 0.1, 'nose-proj': 0.1, 'nose-length': 0.1,
      'upper-lip-volume': 0.25, 'lower-lip-volume': 0.25, cheekbones: 0.15 },
  },
  'southern-central-african': {
    tone: [0.65, 1.0], undertone: { neutral: 3, red: 1, golden: 1 },
    texture: { coily: 95, curly: 5 }, hair: { 'jet-black': 7, 'soft-black': 4 },
    iris: { 'dark-brown': 8, brown: 2 },
    shape: { 'nose-width': 0.5, 'nostril-width': 0.4, 'nose-depth': -0.2, 'upper-lip-volume': 0.4, 'lower-lip-volume': 0.4,
      'mouth-proj': 0.2, cheekbones: 0.2, 'head-width': 0.1 },
  },
  'north-african-middle-eastern': {
    tone: [0.25, 0.6], undertone: { olive: 4, golden: 2, neutral: 2 },
    texture: { wavy: 45, curly: 35, straight: 20 },
    hair: { 'jet-black': 2, 'soft-black': 4, 'dark-brown': 5, 'medium-brown': 2 },
    iris: { brown: 5, 'dark-brown': 4, hazel: 1.5, 'light-brown': 1, green: 0.5 },
    shape: { 'nose-length': 0.25, 'nose-proj': 0.3, 'nose-hump': 0.3, 'nose-width': -0.05, 'brow-proj': 0.15,
      'head-height': 0.15, 'eye-depth-1': 0.15 },
  },
  'mediterranean-european': {
    tone: [0.12, 0.42], undertone: { olive: 3, neutral: 3, golden: 1, pink: 1 },
    texture: { wavy: 45, straight: 35, curly: 20 },
    hair: { 'soft-black': 2, 'dark-brown': 5, 'medium-brown': 4, 'light-brown': 1.5, auburn: 0.5 },
    iris: { brown: 5, 'dark-brown': 2, hazel: 2.5, green: 1.2, 'light-brown': 1, blue: 0.8, grey: 0.3 },
    shape: { 'nose-proj': 0.25, 'nose-hump': 0.15, 'nose-length': 0.15, 'brow-proj': 0.15, 'upper-lip-volume': -0.05 },
  },
  'northern-european': {
    tone: [0.0, 0.3], undertone: { pink: 3, neutral: 3, red: 1.5, olive: 0.5 },
    texture: { straight: 60, wavy: 32, curly: 8 },
    hair: { 'dark-brown': 3, 'medium-brown': 4, 'light-brown': 4, 'dark-blonde': 4, 'golden-blonde': 2, 'light-blonde': 1.5,
      'strawberry-blonde': 0.8, copper: 1.2, auburn: 0.8 },
    iris: { blue: 5, grey: 2, green: 2, hazel: 2, 'light-brown': 1, brown: 2 },
    shape: { 'nose-width': -0.25, 'nostril-width': -0.2, 'nose-proj': 0.3, 'nose-length': 0.1, 'upper-lip-volume': -0.25,
      'lower-lip-volume': -0.15, 'brow-proj': 0.2, 'eye-depth-1': 0.2, 'head-depth': 0.1 },
  },
  'south-asian': {
    tone: [0.35, 0.82], undertone: { golden: 3, neutral: 2, olive: 1 },
    texture: { straight: 35, wavy: 50, curly: 15 }, hair: { 'jet-black': 5, 'soft-black': 5, 'dark-brown': 3 },
    iris: { brown: 5, 'dark-brown': 5, hazel: 0.6, 'light-brown': 0.8, green: 0.3, grey: 0.1 },
    shape: { 'nose-proj': 0.15, 'nose-length': 0.1, 'nose-width': 0.05, 'eye-size': 0.1, 'upper-lip-volume': 0.1,
      'lower-lip-volume': 0.1, 'head-width': -0.05, 'brow-proj': 0.05 },
  },
  'east-asian': {
    tone: [0.08, 0.4], undertone: { golden: 4, neutral: 2, pink: 0.5 },
    texture: { straight: 88, wavy: 12 }, hair: { 'jet-black': 6, 'soft-black': 5, 'dark-brown': 2 },
    iris: { 'dark-brown': 7, brown: 3 },
    shape: { epicanthus: 0.5, 'lid-fold': 0.45, 'nose-depth': -0.3, 'nose-proj': -0.25, 'nose-width': 0.1, 'nose-length': -0.1,
      cheekbones: 0.35, 'head-width': 0.25, 'brow-proj': -0.25, 'eye-depth-1': -0.2, 'mouth-proj': -0.05 },
  },
  'southeast-asian': {
    tone: [0.3, 0.7], undertone: { golden: 4, olive: 1, neutral: 2 },
    texture: { straight: 70, wavy: 25, curly: 5 }, hair: { 'jet-black': 6, 'soft-black': 4, 'dark-brown': 2 },
    iris: { 'dark-brown': 6, brown: 4 },
    shape: { epicanthus: 0.3, 'lid-fold': 0.25, 'nose-width': 0.3, 'nose-depth': -0.25, 'nose-proj': -0.15,
      'upper-lip-volume': 0.2, 'lower-lip-volume': 0.2, cheekbones: 0.2, 'head-width': 0.15, 'mouth-proj': 0.1 },
  },
  'central-asian': {
    tone: [0.12, 0.45], undertone: { golden: 3, neutral: 2, olive: 1, pink: 1 },
    texture: { straight: 75, wavy: 25 }, hair: { 'jet-black': 4, 'soft-black': 4, 'dark-brown': 4, 'medium-brown': 1 },
    iris: { 'dark-brown': 4, brown: 4, hazel: 1.5, green: 0.6, 'light-brown': 1, blue: 0.3 },
    shape: { epicanthus: 0.3, 'lid-fold': 0.25, cheekbones: 0.35, 'head-width': 0.25, 'nose-proj': -0.05 },
  },
  'indigenous-americas': {
    tone: [0.3, 0.68], undertone: { golden: 3, red: 2, olive: 1, neutral: 1 },
    texture: { straight: 90, wavy: 10 }, hair: { 'jet-black': 7, 'soft-black': 4 },
    iris: { 'dark-brown': 7, brown: 3 },
    shape: { cheekbones: 0.4, 'head-width': 0.25, epicanthus: 0.2, 'lid-fold': 0.15, 'nose-proj': 0.1, 'nose-hump': 0.1, 'nose-width': 0.15 },
  },
  'pacific-islander': {
    tone: [0.42, 0.75], undertone: { golden: 3, neutral: 2, red: 1 },
    texture: { wavy: 45, curly: 35, straight: 20 }, hair: { 'jet-black': 5, 'soft-black': 4, 'dark-brown': 3 },
    iris: { 'dark-brown': 6, brown: 4 },
    shape: { 'head-width': 0.3, 'nose-width': 0.3, 'upper-lip-volume': 0.25, 'lower-lip-volume': 0.25, cheekbones: 0.15,
      'face-fat': 0.15, 'chin-width': 0.15 },
  },
  melanesian: {
    tone: [0.62, 1.0], undertone: { neutral: 3, red: 1, golden: 1 },
    // naturally blond hair occurs in some Melanesian populations (a distinct TYRP1 variant)
    texture: { coily: 75, curly: 25 }, hair: { 'jet-black': 6, 'soft-black': 3, 'golden-blonde': 0.6, 'dark-blonde': 0.4 },
    iris: { 'dark-brown': 8, brown: 2 },
    shape: { 'nose-width': 0.45, 'brow-proj': 0.3, 'upper-lip-volume': 0.35, 'lower-lip-volume': 0.35, 'mouth-proj': 0.2, 'nose-proj': -0.05 },
  },
  'aboriginal-australian': {
    tone: [0.6, 0.98], undertone: { neutral: 3, red: 1, golden: 1 },
    texture: { wavy: 40, curly: 45, straight: 15 }, hair: { 'jet-black': 4, 'soft-black': 4, 'dark-brown': 3, 'dark-blonde': 0.5 },
    iris: { 'dark-brown': 7, brown: 3 },
    shape: { 'brow-proj': 0.45, 'nose-width': 0.4, 'eye-depth-1': 0.3, 'upper-lip-volume': 0.2, 'lower-lip-volume': 0.2, 'mouth-proj': 0.15 },
  },
  'arctic-indigenous': {
    tone: [0.22, 0.55], undertone: { golden: 3, neutral: 2, red: 1 },
    texture: { straight: 95, wavy: 5 }, hair: { 'jet-black': 7, 'soft-black': 4 },
    iris: { 'dark-brown': 7, brown: 3 },
    shape: { epicanthus: 0.45, 'lid-fold': 0.35, cheekbones: 0.4, 'head-width': 0.35, 'nose-width': -0.05, 'nose-proj': -0.15, 'face-fat': 0.1 },
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

// How often each kind of origin is drawn. Profiles are drawn evenly (not by world population) so every
// session meets a wide range of faces; blends and free two-profile mixes are common.
export const ORIGIN_WEIGHTS = { single: 0.62, blend: 0.22, mix: 0.16 };

// Traits independent of ancestry
export const TRAITS = {
  presentation: { feminine: 80, androgynous: 14, masculine: 6 },
  albinism: 0.01,
  vitiligo: 0.02,
  dyedHair: 0.08,
  highlights: 0.1,
};
