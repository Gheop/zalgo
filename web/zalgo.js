// Logique pure, sans DOM : importée par app.js et par les tests unitaires.

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const chars = (cps) => cps.map((c) => String.fromCharCode(c));

// Mêmes listes que zalgo.py
export const OVERLAY = chars(range(0x334, 0x338));
export const ABOVE = chars([
  ...range(0x300, 0x315), 0x31a, 0x33d, 0x33e, 0x33f,
  0x346, 0x34a, 0x34b, 0x34c, 0x350, 0x351, 0x352, 0x357, 0x35b,
  ...range(0x363, 0x36f),
]);
export const BELOW = chars([
  ...range(0x316, 0x319), ...range(0x31b, 0x333), 0x339, 0x33a, 0x33b,
  0x33c, 0x345, 0x347, 0x348, 0x349, 0x34d, 0x34e, 0x353, 0x354,
  0x355, 0x356, 0x359, 0x35a,
]);
export const ALL_PARTS = { above: true, through: true, below: true };

const IS_BASE = /[\p{L}\p{N}]/u;

export function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand32 = () => (Math.random() * 2 ** 32) >>> 0;
const pick = (list, r) => list[Math.floor(r() * list.length)];

// Un générateur par position : taper une lettre de plus ne retire pas au sort
// celles déjà corrompues, le texte ne « saute » pas pendant la frappe.
export function corrupt(text, level, parts, seed) {
  if (level <= 0) return text;
  const max = Math.round(1 + 19 * level ** 1.6);
  const strike = Math.min(1, 0.15 + level * 1.7);
  let out = "";
  let i = 0;
  for (const c of text) {
    i++;
    out += c;
    if (!IS_BASE.test(c)) continue;
    const r = mulberry32(seed ^ Math.imul(i, 0x9e3779b1));
    if (parts.through && r() < strike) out += pick(OVERLAY, r);
    if (parts.below) for (let k = Math.floor(r() * (max + 1)); k > 0; k--) out += pick(BELOW, r);
    if (parts.above) for (let k = Math.floor(r() * (max + 1)); k > 0; k--) out += pick(ABOVE, r);
  }
  return out;
}

// Une marque seule n'est gardée que si elle forme une lettre accentuée du
// Latin-1 (é, ç, ñ…) ; tout le reste est de la corruption. Un « û » tiré au
// sort par le zalgo reste donc indiscernable d'un « û » tapé.
export const purify = (s) => s
  .normalize("NFD")
  .replace(/(\P{M})(\p{M}+)/gu, (_, base, marks) => {
    if ([...marks].length === 1) {
      const composed = (base + marks).normalize("NFC");
      if (composed.length === 1 && composed >= "\u00c0" && composed <= "\u00ff") return composed;
    }
    return base;
  })
  .normalize("NFC");
