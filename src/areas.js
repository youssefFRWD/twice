/* Where someone buys and sells: the 20 Paris arrondissements (1-20) and the towns around Paris (21+).
   Stored as a number in profiles.arrondissement; centres are approximate (a pickup area, not an address). */

const ARR_CENTER = {
  1: [48.8625, 2.3364], 2: [48.8683, 2.344], 3: [48.863, 2.36], 4: [48.854, 2.357], 5: [48.8445, 2.35],
  6: [48.849, 2.333], 7: [48.856, 2.312], 8: [48.8745, 2.3105], 9: [48.877, 2.338], 10: [48.876, 2.36],
  11: [48.859, 2.378], 12: [48.835, 2.395], 13: [48.828, 2.362], 14: [48.829, 2.327], 15: [48.841, 2.293],
  16: [48.864, 2.274], 17: [48.887, 2.32], 18: [48.892, 2.348], 19: [48.887, 2.383], 20: [48.864, 2.4],
}

/** The banlieue: Hauts-de-Seine, Seine-Saint-Denis and Val-de-Marne towns next to Paris. */
const SUBURBS = [
  ['Arcueil', 48.8055, 2.3395], ['Asnières-sur-Seine', 48.9115, 2.2855], ['Aubervilliers', 48.9145, 2.3835],
  ['Bagnolet', 48.8685, 2.4175], ['Bobigny', 48.9065, 2.4395], ['Boulogne-Billancourt', 48.8355, 2.2395],
  ['Charenton-le-Pont', 48.8225, 2.4125], ['Clichy', 48.9035, 2.3055], ['Courbevoie', 48.8975, 2.2565],
  ['Gentilly', 48.8135, 2.3445], ['Issy-les-Moulineaux', 48.8245, 2.2745], ['Ivry-sur-Seine', 48.8115, 2.3845],
  ['La Garenne-Colombes', 48.9065, 2.2455], ['Le Kremlin-Bicêtre', 48.8115, 2.3585], ['Le Pré-Saint-Gervais', 48.8855, 2.4045],
  ['Les Lilas', 48.8795, 2.4195], ['Levallois-Perret', 48.8935, 2.2885], ['Malakoff', 48.8205, 2.2985],
  ['Montreuil', 48.8605, 2.4435], ['Montrouge', 48.8165, 2.3205], ['Nanterre', 48.8925, 2.2065],
  ['Neuilly-sur-Seine', 48.8845, 2.2685], ['Pantin', 48.8945, 2.4095], ['Puteaux', 48.8845, 2.2385],
  ['Saint-Denis', 48.9365, 2.3575], ['Saint-Mandé', 48.8445, 2.4195], ['Saint-Ouen', 48.9125, 2.3335],
  ['Vanves', 48.8225, 2.2885], ['Villeneuve-la-Garenne', 48.9365, 2.3265], ['Vincennes', 48.8475, 2.4385],
  ['Vitry-sur-Seine', 48.7875, 2.3925],
].sort((a, b) => a[0].localeCompare(b[0], 'fr'))

export const ARR_FIRST_SUBURB = 21
export const ARR_NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1)
export const SUBURB_NUMBERS = SUBURBS.map((_, i) => ARR_FIRST_SUBURB + i)

/** Display name: "Paris 3e" or "Saint-Denis". */
export function areaName(n) {
  if (!n) return null
  if (n < ARR_FIRST_SUBURB) return `Paris ${n}${n === 1 ? 'er' : 'e'}`
  return SUBURBS[n - ARR_FIRST_SUBURB]?.[0] || null
}

export const isSuburb = n => n >= ARR_FIRST_SUBURB

/** [lat, lon] for a pickup area. */
export function areaCenter(n) {
  if (n < ARR_FIRST_SUBURB) return ARR_CENTER[n]
  const s = SUBURBS[n - ARR_FIRST_SUBURB]
  return s && [s[1], s[2]]
}

/** The area an address like "rue X, Gentilly" or "Paris 3e" ends in, or null. */
export function areaFromAddress(address) {
  const m = address?.match(/Paris (\d+)/)
  if (m) return +m[1]
  const i = SUBURBS.findIndex(s => address?.endsWith(s[0]))
  return i < 0 ? null : ARR_FIRST_SUBURB + i
}
