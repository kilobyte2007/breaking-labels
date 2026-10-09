import { ref } from 'vue'
import '@fontsource/roboto-condensed/400.css'
import '@fontsource/roboto-condensed/600.css'
import '@fontsource/roboto-condensed/700.css'
import '@fontsource/barlow-semi-condensed/400.css'
import '@fontsource/barlow-semi-condensed/600.css'
import '@fontsource/barlow-semi-condensed/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'

export interface FontDef { id: string; label: string; family: string; weights: number[] }

export const FONTS: FontDef[] = [
  { id: 'roboto-condensed', label: 'Roboto Condensed', family: 'Roboto Condensed', weights: [400, 600, 700] },
  { id: 'barlow-semi-condensed', label: 'Barlow Semi Condensed', family: 'Barlow Semi Condensed', weights: [400, 600, 700] },
  { id: 'inter', label: 'Inter', family: 'Inter', weights: [400, 600, 700] },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', family: 'JetBrains Mono', weights: [400, 700] },
]

export const fontById = (id: string) => FONTS.find(f => f.id === id) ?? FONTS[0]

export function nearestWeight(font: FontDef, w: number) {
  return font.weights.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a))
}

/** Bumps whenever web fonts finish loading so measured layouts recompute. */
export const fontsTick = ref(0)

const SAMPLE = 'AaĂăȘșȚțÎîÂâЖжД 0123'
export async function preloadFonts() {
  await Promise.all(FONTS.flatMap(f => f.weights.map(w => document.fonts.load(`${w} 16px "${f.family}"`, SAMPLE).catch(() => {}))))
  measureCache.clear()
  fontsTick.value++
}
document.fonts?.addEventListener?.('loadingdone', () => { measureCache.clear(); fontsTick.value++ })

const ctx = document.createElement('canvas').getContext('2d')!
const measureCache = new Map<string, number>()

/** Advance width of `text` at font-size 1 (same unit as the caller – we use mm). */
export function measure(text: string, family: string, weight: number): number {
  const key = `${family}|${weight}|${text}`
  let w = measureCache.get(key)
  if (w === undefined) {
    ctx.font = `${weight} 100px "${family}", sans-serif`
    w = ctx.measureText(text).width / 100
    measureCache.set(key, w)
  }
  return w
}

/**
 * Builds a CSS block with every @font-face for `family`, sources inlined as data URIs.
 * Needed when rasterising SVG for the PDF: an SVG drawn via <img> can't reach the page's fonts.
 */
export async function embeddedFontCss(families: string[]): Promise<string> {
  const wanted = new Set(families.map(f => f.toLowerCase()))
  const rules: CSSFontFaceRule[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList
    try { list = sheet.cssRules } catch { continue }
    for (const r of Array.from(list)) {
      if (r instanceof CSSFontFaceRule && wanted.has(r.style.getPropertyValue('font-family').replace(/["']/g, '').trim().toLowerCase())) rules.push(r)
    }
  }
  const parts = await Promise.all(rules.map(async (r) => {
    const src = r.style.getPropertyValue('src')
    const m = src.match(/url\(["']?([^"')]+\.woff2[^"')]*)["']?\)/) ?? src.match(/url\(["']?([^"')]+)["']?\)/)
    if (!m) return ''
    try {
      const blob = await (await fetch(new URL(m[1], (r.parentStyleSheet?.href ?? location.href)).href)).blob()
      const data = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob) })
      return `@font-face{font-family:${r.style.getPropertyValue('font-family')};font-style:${r.style.getPropertyValue('font-style') || 'normal'};font-weight:${r.style.getPropertyValue('font-weight') || '400'};unicode-range:${r.style.getPropertyValue('unicode-range') || 'U+0-10FFFF'};src:url(${data}) format('woff2');}`
    } catch { return '' }
  }))
  return parts.join('\n')
}
