<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Ico from './components/Ico.vue'
import PanelCanvas from './components/PanelCanvas.vue'
import Inspector from './components/Inspector.vue'
import PrintView from './components/PrintView.vue'
import ImportDialog from './components/ImportDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import {
  canRedo, canUndo, createPanel, deletePanel, duplicatePanel, duplicateSelected, exportPanelJson, importPanelJson,
  nudgeSelected, panel, redo, removeSelected, selection, state, undo,
} from './store'
import { download, pickFile } from './lib/files'
import { toast, toastMsg } from './lib/toast'
import { checkServer } from './lib/aiClient'

const view = ref<'editor' | 'print'>(location.hash === '#print' ? 'print' : 'editor')
watch(view, v => { if ((location.hash === '#print') !== (v === 'print')) location.hash = v === 'print' ? 'print' : '' })
window.addEventListener('hashchange', () => { view.value = location.hash === '#print' ? 'print' : 'editor' })
const showImport = ref(false)
const showSettings = ref(false)
const menuOpen = ref(false)
const panelMenuOpen = ref(false)

// Phones: the inspector is a bottom sheet that opens when a label is selected.
const sheetOpen = ref(false)
watch(() => selection.value.length, (n, old) => { if (n && !old) sheetOpen.value = true; else if (!n) sheetOpen.value = false })
// The sheet shrinks the canvas, so keep the tapped label visible above it.
watch(sheetOpen, open => { if (open) nextTick(() => setTimeout(() => document.querySelector('.slot.selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }), 50)) })
const sheetTitle = computed(() => {
  const ids = selection.value
  if (!ids.length) return 'Label style'
  if (ids.length > 1) return `${ids.length} labels selected`
  const it = panel.value.rows.flatMap(r => r.items).find(i => i.id === ids[0])
  return it ? [it.number, it.text.replace(/\n/g, ' ')].filter(Boolean).join(' · ') || 'Label' : 'Label'
})

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'panel'

function exportJson() {
  download(`${slug(panel.value.name)}.breaker-labels.json`, exportPanelJson())
  menuOpen.value = false
}

async function importJson() {
  menuOpen.value = false
  const file = await pickFile('.json,application/json')
  if (!file) return
  try {
    importPanelJson(await file.text())
    toast(`Imported “${panel.value.name}”`)
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not import file', true)
  }
}

function confirmDelete() {
  menuOpen.value = false
  if (confirm(`Delete “${panel.value.name}”? This cannot be undone.`)) deletePanel(panel.value.id)
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  const typing = t.closest('input, textarea, select, [contenteditable]')
  const mod = e.metaKey || e.ctrlKey
  if (view.value !== 'editor' || showImport.value || showSettings.value) {
    if (e.key === 'Escape' && view.value === 'print') view.value = 'editor'
    return
  }
  if (mod && e.key.toLowerCase() === 'z') {
    if (typing) return
    e.preventDefault()
    if (e.shiftKey) { redo() } else { undo() }
    return
  }
  if (mod && e.key.toLowerCase() === 'y') { if (!typing) { e.preventDefault(); redo() } return }
  if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); view.value = 'print'; return }
  if (typing) { if (e.key === 'Escape') (t as HTMLInputElement).blur(); return }
  if (!selection.value.length) return
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected() }
  else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected() }
  else if (e.key === 'ArrowLeft' && e.altKey) { e.preventDefault(); nudgeSelected(-1) }
  else if (e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); nudgeSelected(1) }
  else if (e.key === 'Escape') selection.value = []
}

function closeMenus(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.menu-wrap')) { menuOpen.value = false; panelMenuOpen.value = false }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('mousedown', closeMenus)
  checkServer()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('mousedown', closeMenus)
})
</script>

<template>
  <div class="shell" :class="{ printing: view === 'print' }">
    <header class="top no-print">
      <div class="brand">
        <svg viewBox="0 0 32 32" class="logo"><rect width="32" height="32" rx="7" fill="currentColor" /><rect x="5" y="11" width="22" height="10" rx="2" fill="#f2b705" /><path d="M17.5 12.5 13 17h3l-1.5 3 4.5-4.5h-3z" fill="#1c1b18" /></svg>
        <span>Breaker Labels</span>
      </div>

      <div class="menu-wrap panel-switch">
        <input v-model="panel.name" class="panel-name" spellcheck="false" aria-label="Panel name" />
        <button class="btn ghost sm icon" title="Switch panel" @click="panelMenuOpen = !panelMenuOpen"><Ico name="chevron-down" /></button>
        <div v-if="panelMenuOpen" class="menu">
          <div class="menu-label">Panels</div>
          <button
            v-for="p in state.panels" :key="p.id" class="menu-item" :class="{ on: p.id === state.currentId }"
            @click="state.currentId = p.id; panelMenuOpen = false"
          >
            <span class="grow">{{ p.name }}</span>
            <span class="muted">{{ p.rows.reduce((n, r) => n + r.items.length, 0) }}</span>
          </button>
          <div class="menu-sep" />
          <button class="menu-item" @click="createPanel(); panelMenuOpen = false"><Ico name="plus" /> New panel</button>
          <button class="menu-item" @click="duplicatePanel(); panelMenuOpen = false"><Ico name="content-copy" /> Duplicate this panel</button>
        </div>
      </div>

      <div class="grow" />

      <div class="row tools">
        <button class="btn ghost icon" :disabled="!canUndo" title="Undo (⌘Z)" @click="undo"><Ico name="undo" /></button>
        <button class="btn ghost icon" :disabled="!canRedo" title="Redo (⇧⌘Z)" @click="redo"><Ico name="redo" /></button>
        <span class="divider" />
        <button class="btn" title="Import map" @click="showImport = true"><Ico name="creation" /><span class="btn-label">Import map</span></button>
        <button class="btn primary" title="Print" @click="view = 'print'"><Ico name="printer-outline" /><span class="btn-label">Print</span></button>
        <div class="menu-wrap">
          <button class="btn ghost icon" title="More" @click="menuOpen = !menuOpen"><Ico name="dots-horizontal" /></button>
          <div v-if="menuOpen" class="menu right">
            <button class="menu-item" @click="exportJson"><Ico name="download" /> Export panel (.json)</button>
            <button class="menu-item" @click="importJson"><Ico name="upload" /> Open panel file…</button>
            <div class="menu-sep" />
            <button class="menu-item" @click="showSettings = true; menuOpen = false"><Ico name="cog-outline" /> Settings &amp; label sizes</button>
            <div class="menu-sep" />
            <button class="menu-item danger" @click="confirmDelete"><Ico name="delete-outline" /> Delete panel</button>
          </div>
        </div>
      </div>
    </header>

    <main v-show="view === 'editor'" class="editor no-print">
      <PanelCanvas class="canvas" @import="showImport = true" />
      <div class="sheet" :class="{ open: sheetOpen }">
        <button class="sheet-handle" @click="sheetOpen = !sheetOpen">
          <span class="grip" />
          <span class="grow sheet-title">{{ sheetTitle }}</span>
          <Ico :name="sheetOpen ? 'chevron-down' : 'chevron-up'" />
        </button>
        <Inspector class="inspector" @open-settings="showSettings = true" />
      </div>
    </main>

    <PrintView v-if="view === 'print'" @close="view = 'editor'" />

    <ImportDialog v-if="showImport" @close="showImport = false" />
    <SettingsDialog v-if="showSettings" @close="showSettings = false" />

    <div v-if="toastMsg" class="toast no-print" :class="{ error: toastMsg.error }">{{ toastMsg.text }}</div>
  </div>
</template>

<style scoped>
.shell { height: 100%; display: flex; flex-direction: column; }
.top {
  height: 56px; flex: none; display: flex; align-items: center; gap: 14px; padding: 0 14px 0 16px;
  background: var(--surface); border-bottom: 1px solid var(--border); position: relative; z-index: 20;
}
.brand { display: flex; align-items: center; gap: 9px; font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; }
.logo { width: 26px; height: 26px; color: var(--text); }
.panel-switch { display: flex; align-items: center; gap: 2px; padding-left: 14px; border-left: 1px solid var(--border); }
.panel-name {
  border: 1px solid transparent; background: transparent; border-radius: 6px; height: 32px; padding: 0 8px; font-weight: 600;
  width: clamp(120px, 22vw, 280px); outline: none;
}
.panel-name:hover { border-color: var(--border); }
.panel-name:focus { border-color: var(--focus); background: var(--surface); }
.tools .divider { width: 1px; height: 22px; background: var(--border); margin: 0 4px; }
.editor { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 340px; }
.canvas { min-width: 0; }
.inspector { border-left: 1px solid var(--border); background: var(--surface); min-height: 0; overflow: auto; }
.shell.printing { height: auto; min-height: 100%; }

.menu-wrap { position: relative; }
.menu {
  position: absolute; top: calc(100% + 6px); left: 0; min-width: 240px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; box-shadow: var(--shadow-lg); padding: 5px; z-index: 30; display: grid; animation: pop .12s ease-out;
}
.menu.right { left: auto; right: 0; }
.menu-label { font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .06em; padding: 6px 9px 4px; }
.menu-item {
  display: flex; align-items: center; gap: 9px; height: 34px; padding: 0 9px; border: 0; background: transparent; border-radius: 6px;
  cursor: pointer; text-align: left; font-size: 13.5px;
}
.menu-item:hover { background: var(--surface-3); }
.menu-item.on { background: var(--accent-soft); font-weight: 600; }
.menu-item.danger { color: var(--danger); }
.menu-item svg { width: 17px; height: 17px; color: var(--text-2); }
.menu-item.danger svg { color: var(--danger); }
.menu-sep { height: 1px; background: var(--border); margin: 4px 0; }

.sheet { display: contents; }
.sheet-handle { display: none; }

@media (max-width: 900px) {
  .shell { height: 100dvh; }
  .editor { grid-template-columns: 1fr; grid-template-rows: 1fr auto; }
  .sheet {
    display: flex; flex-direction: column; min-height: 0; background: var(--surface); border-top: 1px solid var(--border);
    box-shadow: 0 -6px 24px rgb(0 0 0 / 8%); border-radius: 14px 14px 0 0; padding-bottom: env(safe-area-inset-bottom);
  }
  .sheet-handle {
    display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 16px; border: 0; background: transparent; cursor: pointer;
    font-weight: 650; text-align: left; position: relative; flex: none;
  }
  .sheet-handle .grip { position: absolute; top: 6px; left: 50%; width: 36px; height: 4px; margin-left: -18px; border-radius: 4px; background: var(--border-strong); }
  .sheet-handle svg { width: 20px; height: 20px; color: var(--text-3); }
  .sheet-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .inspector { border-left: 0; border-top: 1px solid var(--border); max-height: 0; overflow: hidden; }
  .sheet.open .inspector { max-height: 58dvh; overflow: auto; }
  .sheet:not(.open) .inspector { border-top: 0; }
  .brand span { display: none; }
  .tools .btn:not(.icon) { padding: 0 9px; }
}
@media (max-width: 640px) {
  .top { gap: 6px; padding: 0 8px 0 10px; }
  .panel-switch { padding-left: 6px; flex: 1; min-width: 0; }
  .panel-name { width: 100%; min-width: 0; padding: 0 6px; }
  .top > .grow, .tools .divider { display: none; }
  .tools { gap: 2px; }
  .tools .btn:not(.icon) { width: 36px; padding: 0; }
  .btn-label { display: none; }
}
</style>
