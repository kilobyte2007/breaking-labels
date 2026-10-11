<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Ico from './Ico.vue'
import LabelSvg from './LabelSvg.vue'
import type { LabelItem, PanelRow } from '../types'
import { addItem, addRow, clearPhoto, moveItem, panel, photoUrl, removeRow, renumber, selection, sizeById, sizes, state } from '../store'
import { computeLabel } from '../lib/layout'
import { fontsTick } from '../lib/fonts'

defineEmits<{ import: [] }>()

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

const zoom = ref<number>(read('bl:zoom', 6))
const deviceView = ref<boolean>(read('bl:device', true))
const showPhoto = ref<boolean>(read('bl:photo', true))
watch(zoom, v => write('bl:zoom', v))
watch(deviceView, v => write('bl:device', v))
watch(showPhoto, v => write('bl:photo', v))
const lightbox = ref(false)

/** Breaker body around the label window (mm). */
const BODY_PAD_X = 1.75
const BODY_TOP = 5
const BODY_BOTTOM = 16

const isEmpty = computed(() => panel.value.rows.every(r => !r.items.length))
const total = computed(() => panel.value.rows.reduce((n, r) => n + r.items.length, 0))

function rowWidth(row: PanelRow) {
  return row.items.reduce((w, i) => w + sizeById(i.sizeId).width, 0)
}

function tight(item: LabelItem) {
  void fontsTick.value
  return computeLabel(item, sizeById(item.sizeId), panel.value.style).tight
}

function select(item: LabelItem, e: MouseEvent) {
  if (e.shiftKey || e.metaKey || e.ctrlKey) {
    const s = new Set(selection.value)
    if (s.has(item.id)) s.delete(item.id)
    else s.add(item.id)
    selection.value = [...s]
  } else {
    selection.value = [item.id]
  }
}

/* ---------- drag & drop ---------- */
const dragId = ref<string | null>(null)
const dropAt = ref<{ rowId: string; index: number } | null>(null)

function onDragStart(item: LabelItem, e: DragEvent) {
  dragId.value = item.id
  e.dataTransfer?.setData('text/plain', item.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(row: PanelRow, e: DragEvent) {
  if (!dragId.value) return
  e.preventDefault()
  const rail = e.currentTarget as HTMLElement
  const slots = Array.from(rail.querySelectorAll<HTMLElement>('[data-slot]'))
  let index = slots.length
  for (let i = 0; i < slots.length; i++) {
    const r = slots[i].getBoundingClientRect()
    if (e.clientX < r.left + r.width / 2) { index = i; break }
  }
  dropAt.value = { rowId: row.id, index }
}

function onDrop(row: PanelRow) {
  if (dragId.value && dropAt.value) moveItem(dragId.value, row, dropAt.value.index)
  onDragEnd()
}
function onDragEnd() { dragId.value = null; dropAt.value = null }

function moveRow(row: PanelRow, dir: -1 | 1) {
  const rows = panel.value.rows
  const i = rows.indexOf(row)
  const j = i + dir
  if (j < 0 || j >= rows.length) return
  ;[rows[i], rows[j]] = [rows[j], rows[i]]
}

/** Same corner radius as LabelSvg's clip, so the window frame hugs the label. */
const cornerOf = (item: LabelItem) => Math.min(panel.value.style.radius, sizeById(item.sizeId).height / 2)

const sortedSizes = computed(() => [...sizes.value].sort((a, b) => a.width - b.width))
const px = (mm: number) => `${mm * zoom.value}px`
</script>

<template>
  <section class="wrap" @click.self="selection = []">
    <div class="toolbar">
      <div class="row">
        <button class="btn sm" @click="addRow()"><Ico name="table-row-plus-after" /> Add row</button>
        <button class="btn sm" title="Number all labels 1, 2, 3… left→right, top→bottom" @click="renumber()"><Ico name="format-list-numbered" /> Renumber</button>
      </div>
      <div class="grow" />
      <span class="hint">{{ total }} label{{ total === 1 ? '' : 's' }} · {{ panel.rows.length }} row{{ panel.rows.length === 1 ? '' : 's' }}</span>
      <label class="switch compact"><span>Device view</span><input v-model="deviceView" type="checkbox" /></label>
      <label v-if="photoUrl" class="switch compact"><span>Photo</span><input v-model="showPhoto" type="checkbox" /></label>
      <div class="zoom">
        <button class="btn ghost sm icon" title="Zoom out" @click="zoom = Math.max(2, zoom - 1)"><Ico name="magnify-minus-outline" /></button>
        <input v-model.number="zoom" type="range" min="2" max="14" step="0.5" aria-label="Zoom" />
        <button class="btn ghost sm icon" title="Zoom in" @click="zoom = Math.min(14, zoom + 1)"><Ico name="magnify-plus-outline" /></button>
      </div>
    </div>

    <div class="scroll" @click.self="selection = []">
      <div v-if="photoUrl && showPhoto" class="photo card">
        <img :src="photoUrl" alt="Panel reference photo" @click="lightbox = true" />
        <div class="photo-actions">
          <span class="hint">Reference photo</span>
          <button class="btn ghost sm" @click="clearPhoto()"><Ico name="delete-outline" /> Remove</button>
        </div>
      </div>

      <div v-if="isEmpty" class="empty card">
        <div class="empty-art">
          <span v-for="s in sortedSizes" :key="s.id" class="ghost-label" :style="{ width: `${s.width * 4}px`, height: `${s.height * 4}px` }" />
        </div>
        <h2>Start your panel</h2>
        <p class="muted">Upload a photo of the panel and/or the circuit list from your electrician and let it build the map, or add labels by hand.</p>
        <div class="row" style="justify-content: center">
          <button class="btn primary" @click="$emit('import')"><Ico name="creation" /> Import photo or map</button>
          <button class="btn" @click="addItem(panel.rows[0], { sizeId: sortedSizes[0]?.id })"><Ico name="plus" /> Add a label</button>
        </div>
      </div>

      <div v-for="(row, ri) in panel.rows" :key="row.id" class="rowcard">
        <div class="row-head">
          <input v-model="row.name" class="row-name" spellcheck="false" aria-label="Row name" />
          <span class="hint mono">{{ row.items.length }} · {{ rowWidth(row) }} mm</span>
          <div class="grow" />
          <button class="btn ghost sm icon" title="Move row up" :disabled="ri === 0" @click="moveRow(row, -1)"><Ico name="chevron-up" /></button>
          <button class="btn ghost sm icon" title="Move row down" :disabled="ri === panel.rows.length - 1" @click="moveRow(row, 1)"><Ico name="chevron-down" /></button>
          <button class="btn ghost sm icon" title="Insert row below" @click="addRow(ri + 1)"><Ico name="table-row-plus-after" /></button>
          <button class="btn ghost sm icon danger" title="Delete row" @click="removeRow(row)"><Ico name="delete-outline" /></button>
        </div>

        <div class="rail-scroll">
        <div
          class="rail" :class="{ device: deviceView }"
          :style="{ '--rail-h': px(deviceView ? 15 : 0) }"
          @dragover="onDragOver(row, $event)" @drop.prevent="onDrop(row)" @dragleave.self="dropAt = null"
          @click.self="selection = []"
        >
          <template v-for="(item, i) in row.items" :key="item.id">
            <div v-if="dropAt?.rowId === row.id && dropAt.index === i" class="drop-ind" />
            <div
              data-slot
              class="slot" :class="{ selected: selection.includes(item.id), dragging: dragId === item.id, blank: item.blank }"
              draggable="true"
              :title="[item.number, item.text, item.notes].filter(Boolean).join(' · ')"
              @dragstart="onDragStart(item, $event)" @dragend="onDragEnd"
              @click.stop="select(item, $event)"
            >
              <div
                v-if="deviceView" class="body"
                :style="{ width: px(sizeById(item.sizeId).width + BODY_PAD_X * 2), height: px(sizeById(item.sizeId).height + BODY_TOP + BODY_BOTTOM), paddingTop: px(BODY_TOP) }"
              >
                <div class="window" :style="{ borderRadius: px(cornerOf(item)) }">
                  <svg :width="px(sizeById(item.sizeId).width)" :height="px(sizeById(item.sizeId).height)" :viewBox="`0 0 ${sizeById(item.sizeId).width} ${sizeById(item.sizeId).height}`">
                    <LabelSvg :item="item" :size="sizeById(item.sizeId)" :panel-style="panel.style" />
                  </svg>
                </div>
                <div class="lever" :style="{ width: px(Math.min(6, sizeById(item.sizeId).width * 0.4)), height: px(8), marginTop: px(3) }" />
              </div>
              <svg v-else class="bare" :style="{ borderRadius: px(cornerOf(item)) }" :width="px(sizeById(item.sizeId).width)" :height="px(sizeById(item.sizeId).height)" :viewBox="`0 0 ${sizeById(item.sizeId).width} ${sizeById(item.sizeId).height}`">
                <LabelSvg :item="item" :size="sizeById(item.sizeId)" :panel-style="panel.style" />
              </svg>
              <span v-if="!item.blank && tight(item)" class="tight" title="Text is very small on this label – shorten it or use a bigger size">!</span>
            </div>
          </template>
          <div v-if="dropAt?.rowId === row.id && dropAt.index === row.items.length" class="drop-ind" />

          <div class="adders">
            <button
              v-for="s in sortedSizes" :key="s.id" class="adder" :title="`Add ${s.name} (${s.width}×${s.height} mm)`"
              :style="{ width: px(Math.max(s.width, 10)), height: px(s.height) }"
              @click.stop="addItem(row, { sizeId: s.id })"
            >
              <Ico name="plus" /><span v-if="s.width * zoom >= 60">{{ s.width }}</span>
            </button>
          </div>
        </div>
        </div>
      </div>

      <button class="btn add-row" @click="addRow()"><Ico name="plus" /> Add row</button>
      <p class="hint keys">
        <span class="kbd">Click</span> select · <span class="kbd">⇧ Click</span> multi-select · drag to reorder ·
        <span class="kbd">⌥ ←/→</span> move · <span class="kbd">⌘D</span> duplicate · <span class="kbd">⌫</span> delete · <span class="kbd">⌘Z</span> undo
      </p>
    </div>

    <div v-if="lightbox" class="backdrop" @click="lightbox = false"><img :src="photoUrl" class="lightbox" alt="" /></div>
  </section>
</template>

<style scoped>
.wrap { display: flex; flex-direction: column; min-height: 0; }
.toolbar { display: flex; align-items: center; gap: 14px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--surface-2); flex-wrap: wrap; }
.switch.compact { gap: 8px; font-size: 12.5px; color: var(--text-2); }
.zoom { display: flex; align-items: center; gap: 2px; width: 170px; }
.scroll { flex: 1; overflow: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }
.mono { font-family: var(--mono); }

.photo { padding: 8px; max-width: 100%; }
.photo img { display: block; max-height: 260px; max-width: 100%; border-radius: 6px; cursor: zoom-in; }
.photo-actions { display: flex; align-items: center; justify-content: space-between; padding: 6px 2px 0; }
.lightbox { max-width: 96vw; max-height: 92vh; border-radius: 8px; box-shadow: var(--shadow-lg); }

.empty { padding: 34px 28px; text-align: center; display: grid; gap: 10px; max-width: 520px; align-self: center; margin-top: 4vh; }
.empty h2 { font-size: 20px; }
.empty p { margin: 0 0 8px; }
.empty-art { display: flex; gap: 6px; justify-content: center; margin-bottom: 6px; }
.ghost-label { border-radius: 4px; background: repeating-linear-gradient(-45deg, var(--surface-3), var(--surface-3) 4px, var(--surface-2) 4px, var(--surface-2) 8px); border: 1px solid var(--border); }

.rowcard { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); min-width: min(100%, 520px); max-width: 100%; }
.row-head { display: flex; align-items: center; gap: 6px; padding: 8px 10px 8px 12px; border-bottom: 1px solid var(--border); }
.row-name { border: 1px solid transparent; background: transparent; font-weight: 650; border-radius: 6px; height: 28px; padding: 0 6px; width: 140px; outline: none; }
.row-name:hover { border-color: var(--border); }
.row-name:focus { border-color: var(--focus); }

.rail-scroll { overflow-x: auto; border-radius: 0 0 var(--radius) var(--radius); }
/* Sized to its content (not the card), so the DIN rail and the end padding scroll along with the breakers. */
.rail { position: relative; display: flex; align-items: center; gap: 0; padding: 18px 16px; min-height: 70px; width: max-content; min-width: 100%; }
.rail.device::before {
  content: ''; position: absolute; left: 0; right: 0; top: 50%; height: var(--rail-h); transform: translateY(-50%);
  background: linear-gradient(var(--rail-line), var(--rail-line)) 0 18% / 100% 1px no-repeat, linear-gradient(var(--rail-line), var(--rail-line)) 0 82% / 100% 1px no-repeat, var(--rail);
}
.slot { position: relative; flex: none; cursor: grab; border-radius: 3px; transition: transform .1s; z-index: 1; }
.bare { display: block; box-shadow: 0 0 0 1px var(--border-strong); margin-right: 3px; }
.slot.dragging { opacity: .35; }
.body {
  display: flex; flex-direction: column; align-items: center; box-sizing: border-box;
  background: linear-gradient(#fbfbf9, #ecebe6); border: 1px solid #c9c6bc; border-radius: 3px;
  box-shadow: inset 0 1px 0 #fff, 0 1px 2px rgb(0 0 0 / 10%);
}
.window { line-height: 0; box-shadow: 0 0 0 1px #b5b2a7; overflow: hidden; background: #fff; }
.window svg { display: block; }
.lever { background: linear-gradient(#55534c, #2c2b27); border-radius: 2px; box-shadow: 0 1px 2px rgb(0 0 0 / 30%); }
.slot.blank .body { background: repeating-linear-gradient(-45deg, #ecebe6, #ecebe6 5px, #e3e1da 5px, #e3e1da 10px); }
.slot.blank .lever { opacity: 0; }
.slot.selected { outline: 2.5px solid var(--focus); outline-offset: 2px; z-index: 2; }
.slot:hover:not(.selected) { outline: 1.5px solid var(--border-strong); outline-offset: 2px; }
.tight {
  position: absolute; top: -7px; right: -7px; width: 16px; height: 16px; border-radius: 50%; background: var(--warn); color: #fff;
  font-size: 11px; font-weight: 800; display: grid; place-items: center; box-shadow: 0 0 0 2px var(--surface);
}
.drop-ind { width: 3px; align-self: stretch; background: var(--focus); border-radius: 3px; margin: 0 2px; flex: none; z-index: 3; }

.adders { display: flex; gap: 6px; margin-left: 12px; flex: none; position: relative; z-index: 1; }
.adder {
  display: inline-flex; align-items: center; justify-content: center; gap: 2px; border: 1.5px dashed var(--border-strong); border-radius: 4px;
  background: color-mix(in srgb, var(--surface) 85%, transparent); color: var(--text-3); cursor: pointer; font-size: 11px; font-weight: 600; font-family: var(--mono);
  transition: border-color .12s, color .12s, background .12s; padding: 0;
}
.adder:hover { border-color: var(--text); color: var(--text); background: var(--accent-soft); }
.adder svg { width: 14px; height: 14px; }

.add-row { border-style: dashed; }
.keys { margin: 4px 0 0; line-height: 2; }
</style>
