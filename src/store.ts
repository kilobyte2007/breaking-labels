import { computed, reactive, ref, watch } from 'vue'
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval'
import type { LabelItem, LabelSize, Panel, PanelRow, Settings } from './types'
import { DEFAULT_PRINT, DEFAULT_SETTINGS, DEFAULT_STYLE, newItem, newPanel, newRow, samplePanel, uid } from './defaults'

const STORAGE_KEY = 'breaker-labels:v1'

interface Persisted {
  panels: Panel[]
  currentId: string
  settings: Settings
  /** Bumped when a stored default has to be migrated. */
  rev?: number
}

const REV = 1

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as Persisted
      // Forward-fill fields added in later versions.
      data.settings = {
        ...structuredClone(DEFAULT_SETTINGS),
        ...data.settings,
        print: { ...DEFAULT_PRINT, ...data.settings?.print },
        ai: { ...DEFAULT_SETTINGS.ai, ...data.settings?.ai },
      }
      for (const p of data.panels) p.style = { ...DEFAULT_STYLE, ...p.style }
      // rev 1: corner radius default went 0.6 → 0 (labels are cut square by hand).
      if ((data.rev ?? 0) < 1) for (const p of data.panels) if (p.style.radius === 0.6) p.style.radius = 0
      data.rev = REV
      if (data.panels.length) return data
    }
  } catch { /* corrupted or blocked storage – start fresh */ }
  const p = samplePanel()
  return { panels: [p], currentId: p.id, settings: structuredClone(DEFAULT_SETTINGS), rev: REV }
}

export const state = reactive<Persisted>(load())

const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* quota / private mode */ } }
save() // persists any migration done in load()

let saveTimer: number | undefined
watch(state, () => {
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(save, 250)
}, { deep: true })

export const panel = computed<Panel>(() => state.panels.find(p => p.id === state.currentId) ?? state.panels[0])
export const sizes = computed(() => state.settings.sizes)
export const sizeById = (id: string): LabelSize =>
  state.settings.sizes.find(s => s.id === id) ?? state.settings.sizes[0] ?? { id, name: '?', width: 14, height: 10 }

/* ---------- selection ---------- */

export const selection = ref<string[]>([])
export const selectedItems = computed<LabelItem[]>(() => {
  const ids = new Set(selection.value)
  return panel.value.rows.flatMap(r => r.items).filter(i => ids.has(i.id))
})

export function locate(itemId: string): { row: PanelRow; index: number } | null {
  for (const row of panel.value.rows) {
    const index = row.items.findIndex(i => i.id === itemId)
    if (index >= 0) return { row, index }
  }
  return null
}

/* ---------- undo / redo (snapshots of the current panel) ---------- */

const undoStack: string[] = []
const redoStack: string[] = []
const historyTick = ref(0)
let lastSnapshot = JSON.stringify(panel.value)
let snapshotTimer: number | undefined
let restoring = false

watch(() => JSON.stringify(panel.value), (now) => {
  if (restoring) { lastSnapshot = now; restoring = false; return }
  clearTimeout(snapshotTimer)
  // Coalesce bursts (typing) into one undo step.
  const before = lastSnapshot
  snapshotTimer = window.setTimeout(() => {
    if (before === now) return
    undoStack.push(before)
    if (undoStack.length > 200) undoStack.shift()
    redoStack.length = 0
    lastSnapshot = now
    historyTick.value++
  }, 350)
})

/** Commit a pending (debounced) edit so undo sees it. */
function flush() {
  clearTimeout(snapshotTimer)
  const now = JSON.stringify(panel.value)
  if (now !== lastSnapshot) {
    undoStack.push(lastSnapshot)
    redoStack.length = 0
    lastSnapshot = now
  }
}

watch(() => state.currentId, () => {
  undoStack.length = 0
  redoStack.length = 0
  lastSnapshot = JSON.stringify(panel.value)
  selection.value = []
  historyTick.value++
})

function restore(json: string) {
  restoring = json !== JSON.stringify(panel.value)
  const idx = state.panels.findIndex(p => p.id === state.currentId)
  state.panels[idx] = JSON.parse(json)
}

export const canUndo = computed(() => (historyTick.value, undoStack.length > 0))
export const canRedo = computed(() => (historyTick.value, redoStack.length > 0))

export function undo() {
  flush()
  const prev = undoStack.pop()
  if (!prev) return
  redoStack.push(JSON.stringify(panel.value))
  restore(prev)
  historyTick.value++
}

export function redo() {
  const next = redoStack.pop()
  if (!next) return
  undoStack.push(JSON.stringify(panel.value))
  restore(next)
  historyTick.value++
}

/* ---------- mutations ---------- */

export function addItem(row: PanelRow, partial: Partial<LabelItem> = {}, at = row.items.length) {
  const item = newItem({ number: String(nextNumber()), ...partial })
  row.items.splice(at, 0, item)
  selection.value = [item.id]
  return item
}

export function nextNumber(): number {
  const nums = panel.value.rows.flatMap(r => r.items).map(i => parseInt(i.number.replace(/\D+/g, ''), 10)).filter(n => !isNaN(n))
  return nums.length ? Math.max(...nums) + 1 : 1
}

export function addRow(at = panel.value.rows.length) {
  const row = newRow(`Row ${panel.value.rows.length + 1}`)
  panel.value.rows.splice(at, 0, row)
  return row
}

export function removeRow(row: PanelRow) {
  const rows = panel.value.rows
  rows.splice(rows.indexOf(row), 1)
  if (!rows.length) rows.push(newRow('Row 1'))
}

export function removeSelected() {
  const ids = new Set(selection.value)
  for (const row of panel.value.rows) row.items = row.items.filter(i => !ids.has(i.id))
  selection.value = []
}

export function duplicateSelected() {
  const created: string[] = []
  for (const id of selection.value) {
    const loc = locate(id)
    if (!loc) continue
    const copy = { ...structuredClone(loc.row.items[loc.index]), id: uid() }
    loc.row.items.splice(loc.index + 1, 0, copy)
    created.push(copy.id)
  }
  selection.value = created
}

export function moveItem(itemId: string, toRow: PanelRow, toIndex: number) {
  const loc = locate(itemId)
  if (!loc) return
  const [item] = loc.row.items.splice(loc.index, 1)
  if (loc.row === toRow && loc.index < toIndex) toIndex--
  toRow.items.splice(Math.max(0, Math.min(toIndex, toRow.items.length)), 0, item)
}

export function nudgeSelected(dir: -1 | 1) {
  const id = selection.value[0]
  const loc = id && locate(id)
  if (!loc) return
  const target = loc.index + dir
  if (target < 0 || target >= loc.row.items.length) return
  const items = loc.row.items
  ;[items[loc.index], items[target]] = [items[target], items[loc.index]]
}

/** Renumber all non-blank labels left→right, top→bottom, keeping any prefix (e.g. "Q"). */
export function renumber(start = 1) {
  let n = start
  for (const row of panel.value.rows) {
    for (const item of row.items) {
      if (item.blank) continue
      const prefix = item.number.match(/^[A-Za-z]+/)?.[0] ?? ''
      if (/^(rcd|rcbo|spd|main)/i.test(item.number)) continue
      item.number = prefix + n++
    }
  }
}

/* ---------- panels ---------- */

export function createPanel(name?: string) {
  const p = newPanel(name ?? `Panel ${state.panels.length + 1}`)
  state.panels.push(p)
  state.currentId = p.id
  return p
}

export function duplicatePanel() {
  const copy: Panel = { ...structuredClone(JSON.parse(JSON.stringify(panel.value))), id: uid(), name: `${panel.value.name} (copy)`, photoKey: '' }
  state.panels.push(copy)
  state.currentId = copy.id
}

export async function deletePanel(id: string) {
  const idx = state.panels.findIndex(p => p.id === id)
  if (idx < 0) return
  const [p] = state.panels.splice(idx, 1)
  if (p.photoKey) await idbDel(p.photoKey).catch(() => {})
  if (!state.panels.length) state.panels.push(newPanel('My panel'))
  if (state.currentId === id) state.currentId = state.panels[0].id
}

/* ---------- reference photo (IndexedDB – too big for localStorage) ---------- */

export const photoUrl = ref('')
export async function loadPhoto() {
  const key = panel.value.photoKey
  photoUrl.value = key ? ((await idbGet<string>(key).catch(() => '')) ?? '') : ''
}
watch(() => panel.value.photoKey, loadPhoto, { immediate: true })

export async function setPhoto(dataUrl: string) {
  const key = panel.value.photoKey || `photo:${panel.value.id}`
  await idbSet(key, dataUrl)
  panel.value.photoKey = key
  photoUrl.value = dataUrl
}

export async function clearPhoto() {
  if (panel.value.photoKey) await idbDel(panel.value.photoKey).catch(() => {})
  panel.value.photoKey = ''
  photoUrl.value = ''
}

/* ---------- import / export ---------- */

export function exportPanelJson(): string {
  return JSON.stringify({ app: 'breaker-labels', version: 1, panel: panel.value, sizes: state.settings.sizes }, null, 2)
}

export function importPanelJson(text: string) {
  const data = JSON.parse(text)
  const p: Panel = data.panel ?? data
  if (!Array.isArray(p.rows)) throw new Error('Not a breaker-labels panel file')
  // Bring along any sizes the file uses that we don't have.
  for (const s of (data.sizes ?? []) as LabelSize[]) {
    if (!state.settings.sizes.some(x => x.id === s.id)) state.settings.sizes.push(s)
  }
  const copy: Panel = { ...p, id: uid(), photoKey: '', style: { ...DEFAULT_STYLE, ...p.style } }
  state.panels.push(copy)
  state.currentId = copy.id
}
