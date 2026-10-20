// Hairstyle catalogue. Every style is long and leaves the hair visible around the face: players prefer long
// hair, so there are no short cuts, updos or head coverings. Which styles a face can get comes from its
// ancestry profile (STYLES in profiles.js); a style is only used when it suits the face's natural hair
// texture. Geometry for each style lives in hair.js.
//
// textures: natural textures that can wear the style (straight, wavy, curly, coily)
export const HAIR_STYLES = {
  'long-straight': { textures: ['straight', 'wavy'] },
  'long-layered': { textures: ['straight', 'wavy'] },   // shorter face-framing layers at the front
  'long-wavy': { textures: ['wavy', 'curly', 'straight'] },
  'silk-press': { textures: ['coily', 'curly'] },      // straightened natural hair
  'curly-long': { textures: ['curly', 'wavy', 'coily'] },
  'box-braids': { textures: ['coily', 'curly'] },
  locs: { textures: ['coily', 'curly'] },
  'cornrow-braids': { textures: ['coily', 'curly'] },  // cornrows into long braids
};
