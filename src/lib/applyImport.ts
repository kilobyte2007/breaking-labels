import type { AnalyzedItem } from './ai-schema'
import type { LabelItem, Panel, PanelRow } from '../types'
import { newItem, newRow } from '../defaults'
import { state } from '../store'
import { suggestColor, suggestIcon } from '../icons'

export type ImportMode = 'replace' | 'merge' | 'append'

export interface DraftRow { name: string; items: AnalyzedItem[] }

const normNum = (n: string) => n.toLowerCase().replace(/[\s.]/g, '').replace(/^0+(?=\d)/, '')

function smallestSizeId() {
  return [...state.settings.sizes].sort((a, b) => a.width - b.width)[0]?.id ?? 's14'
}

export function toLabel(a: AnalyzedItem): LabelItem {
  const icon = a.icon ? `mdi:${a.icon}` : (a.text ? suggestIcon(`${a.text} ${a.notes}`) : '')
  const sizeId = state.settings.sizes.some(s => s.id === a.sizeId) ? a.sizeId : smallestSizeId()
  return newItem({
    sizeId,
    number: a.number,
    text: a.kind === 'blank' ? '' : a.text,
    sub: a.sub,
    icon: a.kind === 'blank' ? '' : icon,
    notes: a.notes,
    blank: a.kind === 'blank',
    color: suggestColor(icon, state.settings.palette),
  })
}

/**
 * - replace: the draft becomes the panel layout.
 * - merge:   keep the existing layout; fill labels whose number matches, append the rest to the last row.
 * - append:  add the draft rows below the existing ones.
 */
export function applyDraft(panel: Panel, rows: DraftRow[], mode: ImportMode): { matched: number; added: number } {
  const built: PanelRow[] = rows.filter(r => r.items.length).map(r => newRow(r.name || 'Row', r.items.map(toLabel)))
  if (mode === 'replace') {
    panel.rows = built.length ? built : [newRow('Row 1')]
    return { matched: 0, added: built.reduce((n, r) => n + r.items.length, 0) }
  }
  if (mode === 'append') {
    panel.rows.push(...built)
    return { matched: 0, added: built.reduce((n, r) => n + r.items.length, 0) }
  }
  const existing = new Map<string, LabelItem>()
  for (const item of panel.rows.flatMap(r => r.items)) if (item.number) existing.set(normNum(item.number), item)
  let matched = 0
  let added = 0
  const leftovers: LabelItem[] = []
  for (const item of built.flatMap(r => r.items)) {
    const target = item.number ? existing.get(normNum(item.number)) : undefined
    if (target) {
      Object.assign(target, { text: item.text, sub: item.sub || target.sub, icon: item.icon || target.icon, notes: item.notes || target.notes, color: target.color || item.color, blank: item.blank })
      matched++
    } else {
      leftovers.push(item)
    }
  }
  if (leftovers.length) {
    const last = panel.rows[panel.rows.length - 1] ?? (panel.rows.push(newRow('Row 1')), panel.rows[0])
    last.items.push(...leftovers)
    added = leftovers.length
  }
  return { matched, added }
}
