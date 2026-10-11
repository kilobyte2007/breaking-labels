<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watchEffect } from 'vue'
import Ico from './Ico.vue'
import LabelSvg from './LabelSvg.vue'
import type { Panel } from '../types'
import { panel, selection, sizeById, state } from '../store'
import { CAPTION_H, RULER_H, packSheets, paperSize } from '../lib/sheet'
import { sheetsToPdf } from '../lib/pdf'
import { download } from '../lib/files'
import { fontById } from '../lib/fonts'
import { toast } from '../lib/toast'

const emit = defineEmits<{ close: [] }>()
const print = computed(() => state.settings.print)
const onlySelected = ref(false)
const busy = ref(false)

const source = computed<Panel>(() => {
  if (!onlySelected.value || !selection.value.length) return panel.value
  const ids = new Set(selection.value)
  return { ...panel.value, rows: panel.value.rows.map(r => ({ ...r, items: r.items.filter(i => ids.has(i.id)) })) }
})

const paper = computed(() => paperSize(print.value))
const pages = computed(() => packSheets(source.value, print.value, sizeById))
const labelCount = computed(() => pages.value.reduce((n, p) => n + p.labels.length, 0))

const previewWidth = ref(560)

/* ---- @page size for the browser's print dialog ---- */
const pageStyle = document.createElement('style')
document.head.appendChild(pageStyle)
watchEffect(() => {
  const [w, h] = paper.value
  pageStyle.textContent = `@page { size: ${w}mm ${h}mm; margin: 0; } @media print { .sheet { width: ${w}mm !important; height: ${h}mm !important; } }`
})
onBeforeUnmount(() => pageStyle.remove())

/* ---- calibration: user measures the printed rulers ---- */
const RULER_X = 100
const rulerY = computed(() => Math.min(50, paper.value[1] - print.value.margin * 2 - RULER_H))
const measuredX = computed({
  get: () => +(RULER_X / print.value.scaleX).toFixed(1),
  set: (v: number) => { if (v > 0) print.value.scaleX = RULER_X / v },
})
const measuredY = computed({
  get: () => +(rulerY.value / print.value.scaleY).toFixed(1),
  set: (v: number) => { if (v > 0) print.value.scaleY = rulerY.value / v },
})

function cutMarks(x: number, y: number, w: number, h: number) {
  const len = Math.min(2, Math.max(0, print.value.gap / 2 - 0.3) || 2)
  const off = 0.6
  const segs: [number, number, number, number][] = []
  for (const [cx, sx] of [[x, -1], [x + w, 1]] as const) {
    for (const [cy, sy] of [[y, -1], [y + h, 1]] as const) {
      segs.push([cx + sx * off, cy, cx + sx * (off + len), cy]) // horizontal tick
      segs.push([cx, cy + sy * off, cx, cy + sy * (off + len)]) // vertical tick
    }
  }
  return segs
}

/* ---- overview page ---- */
const overview = computed(() => {
  if (!print.value.overview) return null
  const [W] = paper.value
  const m = print.value.margin
  const contentW = W - m * 2
  let y = m + 12
  const rows = panel.value.rows.filter(r => r.items.length).map((r) => {
    const width = r.items.reduce((s, i) => s + sizeById(i.sizeId).width, 0) + (r.items.length - 1) * 0.6
    const scale = Math.min(1, contentW / width)
    let x = m
    const items = r.items.map((i) => {
      const size = sizeById(i.sizeId)
      const it = { item: i, size, x, scale }
      x += (size.width + 0.6) * scale
      return it
    })
    const h = Math.max(...r.items.map(i => sizeById(i.sizeId).height)) * scale
    const row = { name: r.name, y: y + 4, items, h }
    y += h + 9
    return row
  })
  const list = panel.value.rows.flatMap(r => r.items).filter(i => !i.blank && (i.text || i.number))
  return { rows, listTop: y + 4, list }
})

function overviewLines(top: number) {
  const [W, H] = paper.value
  const m = print.value.margin
  const lineH = 4.6
  const perCol = Math.max(1, Math.floor((H - m - top - 6) / lineH))
  const colW = (W - m * 2) / 2
  return (overview.value?.list ?? []).slice(0, perCol * 2).map((item, i) => ({
    item,
    x: m + Math.floor(i / perCol) * colW,
    y: top + 6 + (i % perCol) * lineH,
  }))
}

/* ---- output ---- */
const sheetEls = ref<SVGSVGElement[]>([])

function doPrint() {
  window.print()
}

async function doPdf() {
  busy.value = true
  try {
    const els = sheetEls.value.filter(Boolean)
    const [w, h] = paper.value
    const family = fontById(panel.value.style.fontId).family
    const blob = await sheetsToPdf(els, w, h, [family, 'Inter'])
    download(`${panel.value.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'labels'}-labels.pdf`, blob)
    toast('PDF ready – print it at 100% / “Actual size”')
  } catch (e) {
    console.error(e)
    toast('Could not create the PDF', true)
  } finally {
    busy.value = false
  }
}

function setPaper(p: string) {
  print.value.paper = p as typeof print.value.paper
}
</script>

<template>
  <div class="printview">
    <aside class="side no-print">
      <div class="side-head">
        <button class="btn ghost sm" @click="emit('close')"><Ico name="arrow-left" /> Back to editor</button>
      </div>

      <div class="section">
        <h3>Print labels</h3>
        <p class="hint" style="margin: 0">{{ labelCount }} label{{ labelCount === 1 ? '' : 's' }} on {{ pages.length + (overview ? 1 : 0) }} page{{ pages.length + (overview ? 1 : 0) === 1 ? '' : 's' }}. In the print dialog, choose <b>scale 100% / Actual size</b> and turn off “fit to page”.</p>
        <div class="row">
          <button class="btn primary grow" :disabled="!labelCount" @click="doPrint"><Ico name="printer-outline" /> Print</button>
          <button class="btn grow" :disabled="!labelCount || busy" @click="doPdf">
            <span v-if="busy" class="spinner" /><Ico v-else name="file-pdf-box" /> PDF
          </button>
        </div>
        <label v-if="selection.length" class="switch"><span>Only selected ({{ selection.length }})</span><input v-model="onlySelected" type="checkbox" /></label>
      </div>

      <div class="section">
        <span class="section-title">Paper</span>
        <div class="seg">
          <button v-for="p in ['A4', 'Letter', 'A5', 'custom']" :key="p" :class="{ on: print.paper === p }" @click="setPaper(p)">{{ p === 'custom' ? 'Custom' : p }}</button>
        </div>
        <div v-if="print.paper === 'custom'" class="grid-2">
          <div class="field"><label>Width (mm)</label><input v-model.number="print.paperWidth" type="number" min="30" class="input sm" /></div>
          <div class="field"><label>Height (mm)</label><input v-model.number="print.paperHeight" type="number" min="30" class="input sm" /></div>
        </div>
        <div class="grid-3">
          <div class="field"><label>Margin</label><input v-model.number="print.margin" type="number" min="0" step="0.5" class="input sm" /></div>
          <div class="field"><label>Gap</label><input v-model.number="print.gap" type="number" min="0" step="0.5" class="input sm" /></div>
          <div class="field"><label>Copies</label><input v-model.number="print.copies" type="number" min="1" max="10" class="input sm" /></div>
        </div>
      </div>

      <div class="section">
        <span class="section-title">Cutting</span>
        <label class="switch"><span>Cut marks</span><input v-model="print.cutMarks" type="checkbox" /></label>
        <label class="switch"><span>Thin outline</span><input v-model="print.outline" type="checkbox" /></label>
        <div class="field">
          <label>Bleed · {{ print.bleed.toFixed(1) }} mm <span class="muted">(extra paper around each label)</span></label>
          <input v-model.number="print.bleed" type="range" min="0" max="1.5" step="0.1" />
        </div>
        <label class="switch"><span>Group by panel row</span><input v-model="print.groupByRow" type="checkbox" /></label>
        <label v-if="print.groupByRow" class="switch"><span>Row captions</span><input v-model="print.rowCaptions" type="checkbox" /></label>
        <label class="switch"><span>Panel overview page</span><input v-model="print.overview" type="checkbox" /></label>
      </div>

      <div class="section">
        <span class="section-title">Printer calibration</span>
        <label class="switch"><span>Print rulers</span><input v-model="print.ruler" type="checkbox" /></label>
        <p class="hint" style="margin: 0">Print once, measure the rulers with a real ruler, and enter what you measured. Later prints are corrected to exact size.</p>
        <div class="grid-2">
          <div class="field"><label>{{ RULER_X }} mm ruler measured</label><input v-model.number="measuredX" type="number" step="0.1" class="input sm mono" /></div>
          <div class="field"><label>{{ rulerY }} mm ruler measured</label><input v-model.number="measuredY" type="number" step="0.1" class="input sm mono" /></div>
        </div>
        <button v-if="print.scaleX !== 1 || print.scaleY !== 1" class="btn sm" @click="print.scaleX = 1; print.scaleY = 1"><Ico name="refresh" /> Reset calibration</button>
      </div>

      <div class="section preview-size">
        <div class="field">
          <label>Preview size</label>
          <input v-model.number="previewWidth" type="range" min="320" max="1100" step="10" />
        </div>
      </div>
    </aside>

    <div class="pages">
      <div v-if="!labelCount" class="empty no-print card">Nothing to print yet – add some labels first.</div>

      <div v-for="(pg, pi) in pages" :key="pi" class="page">
        <svg
          :ref="el => { if (el) sheetEls[pi] = el as SVGSVGElement }"
          class="sheet" xmlns="http://www.w3.org/2000/svg"
          :viewBox="`0 0 ${paper[0]} ${paper[1]}`" :style="{ width: `${previewWidth}px`, aspectRatio: `${paper[0]} / ${paper[1]}` }"
        >
          <rect :width="paper[0]" :height="paper[1]" fill="#fff" />
          <g :transform="`scale(${print.scaleX} ${print.scaleY})`">
            <text
              v-for="(c, ci) in pg.captions" :key="`c${ci}`" :x="c.x" :y="c.y" font-size="2.6" font-family="Inter, sans-serif" font-weight="600" fill="#8a8a8a"
            >{{ c.text }}</text>
            <template v-for="l in pg.labels" :key="l.key">
              <rect
                v-if="print.bleed > 0" :x="l.x - print.bleed" :y="l.y - print.bleed" :width="l.size.width + print.bleed * 2" :height="l.size.height + print.bleed * 2"
                :fill="panel.style.accentMode === 'background' && l.item.color ? l.item.color : panel.style.background"
              />
              <LabelSvg :item="l.item" :size="l.size" :panel-style="panel.style" :x="l.x" :y="l.y" />
              <rect v-if="print.outline" :x="l.x" :y="l.y" :width="l.size.width" :height="l.size.height" fill="none" :stroke="print.outlineColor" stroke-width="0.1" />
              <g v-if="print.cutMarks" stroke="#555" stroke-width="0.12">
                <line v-for="(s, si) in cutMarks(l.x - print.bleed, l.y - print.bleed, l.size.width + print.bleed * 2, l.size.height + print.bleed * 2)" :key="si" :x1="s[0]" :y1="s[1]" :x2="s[2]" :y2="s[3]" />
              </g>
            </template>

            <g v-if="print.ruler" font-family="Inter, sans-serif" fill="#666">
              <!-- horizontal ruler -->
              <g :transform="`translate(${print.margin} ${paper[1] - print.margin - 2})`" stroke="#444" stroke-width="0.15">
                <line x1="0" y1="0" :x2="RULER_X" y2="0" />
                <line v-for="t in RULER_X + 1" :key="t" :x1="t - 1" :x2="t - 1" y1="0" :y2="(t - 1) % 10 === 0 ? -3 : (t - 1) % 5 === 0 ? -2 : -1" />
                <text :x="RULER_X + 2" y="0.8" font-size="2.4" stroke="none">{{ RULER_X }} mm · measure to calibrate</text>
              </g>
              <!-- vertical ruler in the left margin -->
              <g v-if="print.margin >= 5" :transform="`translate(${print.margin - 2} ${print.margin})`" stroke="#444" stroke-width="0.15">
                <line x1="0" y1="0" x2="0" :y2="rulerY" />
                <line v-for="t in Math.floor(rulerY) + 1" :key="t" x1="0" :x2="(t - 1) % 10 === 0 ? -2.5 : (t - 1) % 5 === 0 ? -1.8 : -1" :y1="t - 1" :y2="t - 1" />
              </g>
            </g>
          </g>
        </svg>
        <div class="page-num no-print">Page {{ pi + 1 }}</div>
      </div>

      <div v-if="overview && labelCount" class="page">
        <svg
          :ref="el => { if (el) sheetEls[pages.length] = el as SVGSVGElement }"
          class="sheet" xmlns="http://www.w3.org/2000/svg"
          :viewBox="`0 0 ${paper[0]} ${paper[1]}`" :style="{ width: `${previewWidth}px`, aspectRatio: `${paper[0]} / ${paper[1]}` }"
        >
          <rect :width="paper[0]" :height="paper[1]" fill="#fff" />
          <g :transform="`scale(${print.scaleX} ${print.scaleY})`" font-family="Inter, sans-serif">
            <text :x="print.margin" :y="print.margin + 5" font-size="6" font-weight="700" fill="#111">{{ panel.name }}</text>
            <text :x="paper[0] - print.margin" :y="print.margin + 5" font-size="2.6" fill="#888" text-anchor="end">{{ new Date().toLocaleDateString() }}</text>
            <g v-for="(r, ri) in overview.rows" :key="ri">
              <text :x="print.margin" :y="r.y - 1.4" font-size="2.6" font-weight="600" fill="#888">{{ r.name }}</text>
              <g v-for="it in r.items" :key="it.item.id" :transform="`translate(${it.x} ${r.y}) scale(${it.scale})`">
                <LabelSvg :item="it.item" :size="it.size" :panel-style="panel.style" />
                <rect :width="it.size.width" :height="it.size.height" fill="none" stroke="#bbb" stroke-width="0.15" />
              </g>
            </g>
            <line :x1="print.margin" :x2="paper[0] - print.margin" :y1="overview.listTop" :y2="overview.listTop" stroke="#ddd" stroke-width="0.2" />
            <g v-for="(ln, li) in overviewLines(overview.listTop)" :key="li">
              <text :x="ln.x" :y="ln.y" font-size="3" font-weight="700" fill="#111">{{ ln.item.number || '–' }}</text>
              <text :x="ln.x + 9" :y="ln.y" font-size="3" fill="#222">{{ ln.item.text.replace(/\n/g, ' ') }}<tspan v-if="ln.item.sub" fill="#888"> · {{ ln.item.sub }}</tspan><tspan v-if="ln.item.notes && ln.item.notes !== ln.item.text" fill="#999" font-size="2.4"> — {{ ln.item.notes.slice(0, 60) }}</tspan></text>
            </g>
          </g>
        </svg>
        <div class="page-num no-print">Overview</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.printview { flex: 1; min-height: 0; display: grid; grid-template-columns: 330px 1fr; }
.side { background: var(--surface); border-right: 1px solid var(--border); overflow: auto; }
.side-head { padding: 10px 12px; border-bottom: 1px solid var(--border); }
h3 { font-size: 16px; }
.pages { overflow: auto; padding: 28px; display: flex; flex-direction: column; align-items: safe center; gap: 22px; background: var(--surface-3); }
.page { display: grid; gap: 6px; justify-items: center; }
.sheet { display: block; background: #fff; box-shadow: var(--shadow-lg); border-radius: 2px; max-width: 100%; height: auto; }
.page-num { font-size: 12px; color: var(--text-3); }
.empty { padding: 30px; }
.mono { font-family: var(--mono); }

@media print {
  .printview { display: block; }
  .pages { padding: 0; gap: 0; background: #fff; overflow: visible; display: block; }
  .page { display: block; break-after: page; page-break-after: always; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  .sheet { box-shadow: none; border-radius: 0; max-width: none; }
}
@media (max-width: 900px) {
  .printview { grid-template-columns: 1fr; }
  .side { border-right: 0; border-bottom: 1px solid var(--border); overflow: visible; }
  .pages { padding: 16px; overflow: visible; }
  .preview-size { display: none; }
}
</style>
