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
    const text = shorten(desc)
    items.push({
      number,
      text,
      sub: rating.replace(/\s+/g, '').replace(/(\d)A(\d)/i, '$1A/$2'),
      icon: suggestIcon(desc).replace(/^mdi:/, ''),
      sizeId: '',
      kind: kind === 'blank' ? 'breaker' : kind,
      notes: text !== desc ? m[2].trim() : '',
    })
  }
  return { items, unparsed }
}

// Common long phrases → label-sized forms. Only applied when a name is too long for a small label.
// `\b` is ASCII-only in JS, so word boundaries are spelled out with Unicode letter classes.
const w = (src: string) => new RegExp(`(?<![\\p{L}\\d])(?:${src})(?![\\p{L}])`, 'giu')
const ABBREV: [RegExp, string][] = [
  [w('aer\\s+condi[tțţ]ionat'), 'AC'],
  [w('air\\s+condition(?:er|ing)'), 'AC'],
  [w('кондиционер'), 'Кондиц.'],
  [w('ma[sșş]in[aă]\\s+de\\s+sp[aă]lat\\s+vase'), 'MSV'],
  [w('ma[sșş]in[aă]\\s+de\\s+sp[aă]lat(?:\\s+rufe)?'), 'MSR'],
  [w('washing\\s+machine'), 'Washer'],
  [w('стиральная\\s+машина'), 'Стиралка'],
  [w('посудомоечная\\s+машина'), 'ПММ'],
  [w('central[aă]\\s+termic[aă]'), 'CT'],
  [w('iluminat(?:ul)?'), 'Ilum.'],
  [w('lighting'), 'Lights'],
  [w('освещение'), 'Свет'],
  [w('dormitor(?:ul)?'), 'dorm.'],
  [w('bedroom'), 'bedrm'],
  [w('спальня'), 'спальн.'],
  [w('buc[aă]t[aă]ri[ea]'), 'bucăt.'],
  [w('kitchen'), 'kitch.'],
  [w('кухня'), 'кухня'],
  [w('sufragerie'), 'sufrag.'],
  [w('living\\s*room'), 'living'],
  [w('bathroom'), 'bath'],
  [w('hallway'), 'hall'],
  [w('cuptor\\s+electric'), 'Cuptor'],
  [w('plit[aă]\\s+(?:electric[aă]|(?:cu\\s+)?induc[tțţ]ie)'), 'Plită'],
  [w('exterior'), 'ext.'],
  [w('outdoor'), 'outdr'],
  [w('(?:etaj(?:ul)?|floor)\\s*(\\d)'), 'E$1'],
]
const FILLER = w('si|și|şi|and|и|de|din|la|pentru|for|the|в|для')

/** Label-friendly text: first letter upper-case, trailing punctuation removed, long phrases abbreviated. */
export function shorten(s: string, max = 14) {
  let t = s.replace(/\s+/g, ' ').replace(/[.;:,]+$/, '').trim()
  if (t.length > max) for (const [re, to] of ABBREV) t = t.replace(re, to)
  if (t.length > max) t = t.replace(FILLER, ' ')
  t = t.replace(/\s+/g, ' ').replace(/\.(?=\s*$)/, '').trim()
  return t.charAt(0).toLocaleUpperCase() + t.slice(1)
}
