import { reactive } from 'vue'
import curatedJson from './curated.json'

export interface CuratedIcon { name: string; category: string; keywords: string[]; body: string }

export const curated = curatedJson as CuratedIcon[]
export const curatedNames = curated.map(i => i.name)
export const categories = [...new Set(curated.map(i => i.category))]

/** Bodies of every icon we have resolved so far (curated + any picked from the full set). */
const bodies = reactive<Record<string, string>>(Object.fromEntries(curated.map(i => [i.name, i.body])))

let fullSet: Promise<Record<string, string>> | null = null
/** Lazily loads all ~7000 Material Design Icons (separate chunk, only when browsing). */
export function loadFullSet() {
  fullSet ??= import('@iconify-json/mdi/icons.json').then((mod) => {
    const data = (mod.default ?? mod) as { icons: Record<string, { body: string }>; aliases?: Record<string, { parent: string }> }
    const all: Record<string, string> = {}
    for (const [k, v] of Object.entries(data.icons)) all[k] = v.body
    for (const [k, v] of Object.entries(data.aliases ?? {})) if (all[v.parent]) all[k] = all[v.parent]
    return all
  })
  return fullSet
}

/** Returns the SVG inner markup (24×24 viewBox) for `mdi:<name>`, fetching from the full set if needed. */
export function iconBody(ref: string): string | null {
  if (!ref.startsWith('mdi:')) return null
  const name = ref.slice(4)
  const b = bodies[name]
  if (b !== undefined) return b
  loadFullSet().then(all => { bodies[name] = all[name] ?? '' })
  return null
}

export function rememberIcon(name: string, body: string) {
  bodies[name] = body
}

export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}/ ]+/gu, ' ').replace(/\s+/g, ' ').trim()

const index = curated.map(icon => ({
  icon,
  keys: [icon.name.replace(/-/g, ' '), ...icon.keywords].map(normalize),
}))

/**
 * Best-guess icon for a circuit name ("Bucătărie prize", "Bathroom lights" …).
 * Longer keyword matches win, so "bathroom lights" → lightbulb beats bathtub only
 * if "lights" is the more specific match; whole-word hits score higher than prefixes.
 */
export function suggestIcon(text: string): string {
  const t = ` ${normalize(text)} `
  if (!t.trim()) return ''
  let best = ''
  let bestScore = 0
  for (const { icon, keys } of index) {
    for (const k of keys) {
      if (!k) continue
      let score = 0
      if (t.includes(` ${k} `)) score = k.length * 2 + 2
      else if (t.includes(` ${k}`)) score = k.length * 1.5 // prefix of a word: "prize" ~ "priza"
      else if (k.length >= 5 && t.includes(k.slice(0, -1))) score = k.length // stem match (RO/RU inflections)
      // Lighting/sockets describe *what* is on the circuit; prefer them over the room.
      if (score && (icon.category === 'Lighting' || icon.category === 'Power')) score += 10
      if (score > bestScore) { bestScore = score; best = icon.name }
    }
  }
  return best ? `mdi:${best}` : ''
}

/** Suggested accent colour for an icon's category. */
export function suggestColor(iconRef: string, palette: string[]): string {
  const cat = curated.find(i => `mdi:${i.name}` === iconRef)?.category
  const map: Record<string, number> = { Lighting: 0, Power: 1, Water: 2, Outdoor: 3, Tech: 4, Kitchen: 5, Laundry: 2, Climate: 6, Protection: 7, Rooms: 8, Utility: 7, Misc: 7 }
  return cat !== undefined && map[cat] !== undefined ? palette[map[cat]] ?? '' : ''
}
