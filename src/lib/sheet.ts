import type { LabelItem, LabelSize, Panel, PrintSettings } from '../types'
import { PAPER } from '../defaults'

export interface PlacedLabel { item: LabelItem; size: LabelSize; x: number; y: number; key: string }
export interface SheetPage { labels: PlacedLabel[]; captions: { text: string; x: number; y: number }[] }

export const CAPTION_H = 4
export const RULER_H = 8

export function paperSize(p: PrintSettings): [number, number] {
  return p.paper === 'custom' ? [p.paperWidth, p.paperHeight] : PAPER[p.paper]
}

/** Packs the panel's labels onto pages, row by row, in reading order. Blank spacers are skipped. */
export function packSheets(panel: Panel, print: PrintSettings, sizeOf: (id: string) => LabelSize): SheetPage[] {
  const [W, H] = paperSize(print)
  const left = print.margin
  const right = W - print.margin
  const top = print.margin
  const bottom = H - print.margin - (print.ruler ? RULER_H : 0)
  const gap = Math.max(0, print.gap)
  const bleed = Math.max(0, print.bleed)

  const pages: SheetPage[] = [{ labels: [], captions: [] }]
  let page = pages[0]
  let x = left
  let y = top
  let lineH = 0

  const newPage = () => { page = { labels: [], captions: [] }; pages.push(page); x = left; y = top; lineH = 0 }
  const newLine = () => { if (lineH) { y += lineH + gap; lineH = 0 } x = left }

  const groups = print.groupByRow
    ? panel.rows.map(r => ({ name: r.name, items: r.items }))
    : [{ name: '', items: panel.rows.flatMap(r => r.items) }]

  for (let copy = 0; copy < Math.max(1, print.copies); copy++) {
    for (const group of groups) {
      const items = group.items.filter(i => !i.blank)
      if (!items.length) continue
      newLine()
      if (print.groupByRow && print.rowCaptions && group.name) {
        const firstH = sizeOf(items[0].sizeId).height + bleed * 2
        if (y + CAPTION_H + firstH > bottom && (page.labels.length || page.captions.length)) newPage()
        page.captions.push({ text: print.copies > 1 ? `${group.name} · copy ${copy + 1}` : group.name, x: left, y: y + CAPTION_H - 1.2 })
        y += CAPTION_H
      }
      for (const item of items) {
        const size = sizeOf(item.sizeId)
        const w = size.width + bleed * 2
        const h = size.height + bleed * 2
        if (x + w > right + 0.001 && x > left) newLine()
        if (y + h > bottom + 0.001 && (page.labels.length || page.captions.length)) newPage()
        page.labels.push({ item, size, x: x + bleed, y: y + bleed, key: `${copy}-${item.id}` })
        x += w + gap
        lineH = Math.max(lineH, h)
      }
    }
  }
  return pages.filter(p => p.labels.length)
}
