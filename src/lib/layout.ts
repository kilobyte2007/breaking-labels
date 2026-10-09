import type { LabelItem, LabelLayout, LabelSize, PanelStyle } from '../types'
import { fontById, measure, nearestWeight } from './fonts'

export interface TextLine { text: string; x: number; y: number; fs: number; weight: number; color: string; anchor: 'start' | 'middle' }

export interface LabelGeometry {
  w: number
  h: number
  family: string
  background: string
  stripe: { x: number; y: number; w: number; h: number; color: string } | null
  icon: { ref: string; x: number; y: number; size: number; color: string } | null
  badge: { x: number; y: number; w: number; h: number; text: string; fs: number; fill: string; color: string; plain: boolean } | null
  lines: TextLine[]
  /** Text had to shrink below the panel's minimum font size. */
  tight: boolean
  fontSize: number
}

const LINE = 1.12 // line height factor
const CAP = 0.7 // cap-height / font-size, close enough for our fonts

export function contrastText(hex: string): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i)
  if (!m) return '#111111'
  const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111111' : '#ffffff'
}

export function resolveLayout(item: LabelItem, size: LabelSize, style: PanelStyle): Exclude<LabelLayout, 'auto'> {
  const l = item.layout || style.layout
  if (l === 'auto') return size.width / size.height < 1.8 ? 'icon-top' : 'icon-left'
  return l
}

/** Splits text into 1–3 line candidates (balanced at word boundaries). */
function lineCandidates(text: string): string[][] {
  const explicit = text.split('\n').map(s => s.trim()).filter(Boolean)
  if (explicit.length > 1) return [explicit]
  const words = text.trim().split(/\s+/).filter(Boolean)
  const out: string[][] = [[words.join(' ')]]
  for (let i = 1; i < words.length; i++) out.push([words.slice(0, i).join(' '), words.slice(i).join(' ')])
  if (words.length >= 3) {
    for (let i = 1; i < words.length - 1; i++)
      for (let j = i + 1; j < words.length; j++)
        out.push([words.slice(0, i).join(' '), words.slice(i, j).join(' '), words.slice(j).join(' ')])
  }
  return out
}

export function computeLabel(item: LabelItem, size: LabelSize, style: PanelStyle): LabelGeometry {
  const W = size.width
  const H = size.height
  const font = fontById(style.fontId)
  const weight = nearestWeight(font, style.fontWeight)
  const family = font.family
  const accent = item.color || ''
  const bgMode = style.accentMode === 'background' && accent
  const background = bgMode ? accent : style.background
  const fg = bgMode ? contrastText(accent) : style.textColor
  const iconColor = style.accentMode === 'icon' && accent ? accent : fg

  const g: LabelGeometry = { w: W, h: H, family, background, stripe: null, icon: null, badge: null, lines: [], tight: false, fontSize: 0 }
  if (item.blank) return g

  const p = style.padding
  let x0 = p
  const x1 = W - p
  const y0 = p
  const y1 = H - p

  if (style.accentMode === 'stripe' && accent) {
    const sw = Math.max(0.8, Math.min(1.4, W * 0.07))
    g.stripe = { x: 0, y: 0, w: sw, h: H, color: accent }
    x0 = sw + p * 0.8
  }

  const tf = (s: string) => (style.uppercase ? s.toLocaleUpperCase() : s)
  const text = tf(item.text)
  const sub = tf(item.sub)
  const number = style.showNumber ? item.number.trim() : ''
  const layout = resolveLayout(item, size, style)
  const hasIcon = !!item.icon && layout !== 'text-only'
  const badgeFill = fg
  const badgeColor = background
  const plain = style.numberStyle === 'plain'
  const wNum = number ? measure(number, family, 700) : 0

  // ---- text block fitting inside (ax, ay, aw, ah); `inlineNumber` prefixes the first line with a badge.
  const fitText = (ax: number, ay: number, aw: number, ah: number, inlineNumber: boolean, center: boolean) => {
    if (!text && !sub && !(inlineNumber && number)) return
    const subRatio = 0.72
    const nf = 0.82 // number font relative to main font
    const badgeExtra = inlineNumber && number ? (plain ? wNum * nf + 0.35 : wNum * nf + 0.5 + 0.35) : 0 // in units of fs
    let best: { lines: string[]; fs: number } | null = null
    for (const lines of text ? lineCandidates(text) : [['']]) {
      const widths = lines.map((l, i) => measure(l, family, weight) + (i === 0 ? badgeExtra : 0))
      const subW = sub ? measure(sub, family, 400) * subRatio : 0
      const maxW = Math.max(...widths, subW, 0.01)
      const units = lines.length * LINE + (sub ? subRatio * LINE : 0)
      const fs = Math.min(style.maxFont, aw / maxW, ah / units)
      // Prefer fewer lines unless more lines give a clearly bigger font.
      if (!best || fs > best.fs * (1 + 0.12 * (lines.length - best.lines.length))) best = { lines, fs }
    }
    if (!best) return
    let fs = best.fs
    if (fs < style.minFont) g.tight = true
    g.fontSize = fs
    const units = best.lines.length * LINE + (sub ? subRatio * LINE : 0)
    const blockH = units * fs
    let y = ay + (ah - blockH) / 2
    const anchor = center ? 'middle' : 'start'
    best.lines.forEach((l, i) => {
      const lineH = fs * LINE
      const baseline = y + (lineH + fs * CAP) / 2
      let lx = center ? ax + aw / 2 : ax
      if (i === 0 && inlineNumber && number) {
        const nfs = fs * nf
        const bw = plain ? wNum * nfs : wNum * nfs + fs * 0.5
        const lineW = measure(l, family, weight) * fs + (l ? bw + fs * 0.35 : bw)
        const startX = center ? ax + (aw - lineW) / 2 : ax
        const bh = Math.min(lineH * 0.92, fs * 1.0)
        g.badge = { x: startX, y: baseline - fs * CAP / 2 - bh / 2, w: bw, h: bh, text: number, fs: nfs, fill: badgeFill, color: plain ? fg : badgeColor, plain }
        lx = startX + bw + fs * 0.35
        if (l) g.lines.push({ text: l, x: lx, y: baseline, fs, weight, color: fg, anchor: 'start' })
      } else if (l) {
        g.lines.push({ text: l, x: lx, y: baseline, fs, weight, color: fg, anchor })
      }
      y += lineH
    })
    if (sub) {
      const sfs = fs * subRatio
      const lineH = sfs * LINE
      g.lines.push({ text: sub, x: center ? ax + aw / 2 : ax, y: y + (lineH + sfs * CAP) / 2, fs: sfs, weight: 400, color: fg, anchor })
    }
  }

  const cornerBadge = () => {
    if (!number) return
    const nfs = Math.min(2.3, H * 0.23)
    const bw = plain ? wNum * nfs : wNum * nfs + nfs * 0.55
    const bh = nfs * 1.05
    g.badge = { x: x0 - p * 0.5, y: y0 - p * 0.5, w: bw, h: bh, text: number, fs: nfs, fill: badgeFill, color: plain ? fg : badgeColor, plain }
    return { w: bw, h: bh }
  }

  const aw = x1 - x0
  const ah = y1 - y0

  if (layout === 'icon-left') {
    if (hasIcon) {
      const s = Math.min(ah, aw * 0.45) * style.iconScale
      g.icon = { ref: item.icon, x: x0, y: y0 + (ah - s) / 2, size: s, color: iconColor }
      const gap = Math.max(0.5, s * 0.12)
      fitText(x0 + s + gap, y0, aw - s - gap, ah, true, false)
    } else {
      fitText(x0, y0, aw, ah, true, false)
    }
  } else if (layout === 'text-only') {
    fitText(x0, y0, aw, ah, true, true)
  } else if (layout === 'icon-only') {
    const b = cornerBadge()
    const s = Math.min(ah, aw) * 0.92 * style.iconScale
    if (hasIcon) g.icon = { ref: item.icon, x: x0 + (aw - s) / 2 + (b ? b.w * 0.3 : 0), y: y0 + (ah - s) / 2, size: s, color: iconColor }
  } else {
    // icon-top
    const b = cornerBadge()
    const textH = text || sub ? Math.min(ah * (sub ? 0.5 : 0.4), style.maxFont * LINE * (sub ? 1.8 : 1.05)) : 0
    if (hasIcon) {
      const room = ah - textH - (textH ? 0.3 : 0)
      const s = Math.min(room * 1.08, aw - (b ? b.w * 1.1 : 0)) * style.iconScale
      g.icon = { ref: item.icon, x: x0 + (aw - s) / 2, y: y0 + (room - s) / 2, size: s, color: iconColor }
      if (textH) fitText(x0, y1 - textH, aw, textH, false, true)
    } else {
      const top = b ? b.h * 0.6 : 0
      fitText(x0, y0 + top, aw, ah - top, false, true)
    }
  }

  return g
}
