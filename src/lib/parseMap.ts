import type { AnalyzedItem } from './ai-schema'
import { suggestIcon } from '../icons'

// "1 - Refrigerator", "1. Frigider", "Q3: Iluminat", "F12  Prize bucătărie 16A", "2) lights", "1;Kitchen;16A" …
const LINE_RE = /^\s*(?:#|nr\.?\s*|no\.?\s*)?([A-Za-z]{0,4}\s?\d{1,3}(?:[./-]\d{1,2})?)\s*(?:[-–—:.)\]|;,\t]+|\s{2,}|\s+)\s*(.+?)\s*$/
const RATING_RE = /\b(?:[BCDK]\s?\d{1,3}(?:\s?A)?|\d{1,3}\s?A(?:\s?\/?\s?\d{1,3}\s?mA)?|\d{1,3}\s?mA)\b/i
const KIND_HINTS: [RegExp, AnalyzedItem['kind']][] = [
  [/\b(rcd|rccb|узо|diferential|diferențial|differential)\b/i, 'rcd'],
  [/\b(rcbo|дифавтомат)\b/i, 'rcbo'],
  [/\b(spd|surge|descarcator|descărcător|уздп|supratensiune)\b/i, 'spd'],
  [/\b(main|general|principal|вводной|общий)\b/i, 'main'],
  [/\b(contactor|контактор)\b/i, 'contactor'],
  [/\b(rezerv[aă]|spare|reserve|резерв|liber|free)\b/i, 'blank'],
]

export interface ParsedMap { items: AnalyzedItem[]; unparsed: string[] }

/** Offline parser for simple "number – description" lists. Anything fancier goes to the AI. */
export function parseCircuitList(text: string): ParsedMap {
  const items: AnalyzedItem[] = []
  const unparsed: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) continue
    const m = line.match(LINE_RE)
    if (!m || /^\d{4}$/.test(m[1])) { unparsed.push(line.trim()); continue }
    const number = m[1].replace(/\s+/g, '')
    let desc = m[2].replace(/^["'“”]+|["'“”]+$/g, '').trim()
    const rating = desc.match(RATING_RE)?.[0] ?? ''
    if (rating) desc = desc.replace(rating, '').replace(/[\s,;()–-]+$/, '').replace(/\(\s*\)/, '').trim()
    const kind = KIND_HINTS.find(([re]) => re.test(desc))?.[1] ?? 'breaker'
    items.push({
      number,
      text: shorten(desc),
      sub: rating.replace(/\s+/g, '').replace(/(\d)A(\d)/i, '$1A/$2'),
      icon: suggestIcon(desc).replace(/^mdi:/, ''),
      sizeId: '',
      kind: kind === 'blank' ? 'breaker' : kind,
      notes: desc.length > 18 ? m[2].trim() : '',
    })
  }
  return { items, unparsed }
}

/** Label-friendly text: first letter upper-case, trailing punctuation removed. */
function shorten(s: string) {
  const t = s.replace(/\s+/g, ' ').replace(/[.;:,]+$/, '').trim()
  return t.charAt(0).toLocaleUpperCase() + t.slice(1)
}
