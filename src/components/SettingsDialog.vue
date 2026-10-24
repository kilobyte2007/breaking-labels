<script setup lang="ts">
import { computed, ref } from 'vue'
import Ico from './Ico.vue'
import LabelSvg from './LabelSvg.vue'
import { panel, state } from '../store'
import { DEFAULT_SIZES, PALETTE, newItem, uid } from '../defaults'
import { serverAi, checkServer } from '../lib/aiClient'
import { download } from '../lib/files'

const emit = defineEmits<{ close: [] }>()
const tab = ref<'sizes' | 'ai' | 'colors' | 'data'>('sizes')
const s = state.settings

const used = computed(() => {
  const ids = new Set<string>()
  for (const p of state.panels) for (const r of p.rows) for (const i of r.items) ids.add(i.sizeId)
  return ids
})

function addSize() {
  s.sizes.push({ id: uid(), name: 'Custom', width: 18, height: 10 })
}

function removeSize(id: string) {
  if (s.sizes.length <= 1) return
  if (used.value.has(id)) {
    const fallback = s.sizes.find(x => x.id !== id)!.id
    if (!confirm('Some labels use this size. They will switch to another size. Continue?')) return
    for (const p of state.panels) for (const r of p.rows) for (const i of r.items) if (i.sizeId === id) i.sizeId = fallback
  }
  s.sizes.splice(s.sizes.findIndex(x => x.id === id), 1)
}

function resetSizes() {
  for (const d of DEFAULT_SIZES) if (!s.sizes.some(x => x.id === d.id)) s.sizes.push({ ...d })
}

const sample = (sizeId: string) => newItem({ sizeId, number: '12', text: 'Kitchen', icon: 'mdi:power-socket-eu', color: '#f97316' })

function exportAll() {
  download('breaking-labels-backup.json', JSON.stringify({ app: 'breaker-labels', version: 1, ...state }, null, 2))
}

function resetAll() {
  if (!confirm('Erase all panels and settings stored in this browser?')) return
  try { localStorage.clear() } catch { /* ignore */ }
  indexedDB.deleteDatabase('keyval-store')
  location.reload()
}
</script>

<template>
  <div class="backdrop" @mousedown.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h2>Settings</h2>
        <button class="btn ghost icon" @click="emit('close')"><Ico name="close" /></button>
      </div>
      <div class="tabs">
        <button :class="{ on: tab === 'sizes' }" @click="tab = 'sizes'">Label sizes</button>
        <button :class="{ on: tab === 'ai' }" @click="tab = 'ai'">AI import</button>
        <button :class="{ on: tab === 'colors' }" @click="tab = 'colors'">Colours</button>
        <button :class="{ on: tab === 'data' }" @click="tab = 'data'">Data</button>
      </div>

      <div class="modal-body">
        <template v-if="tab === 'sizes'">
          <p class="hint" style="margin: 0">The paper windows on your devices. Measure the visible window (width × height) in millimetres.</p>
          <div class="sizes">
            <div v-for="sz in s.sizes" :key="sz.id" class="size-row">
              <div class="pv">
                <svg :width="sz.width * 3.2" :height="sz.height * 3.2" :viewBox="`0 0 ${sz.width} ${sz.height}`"><LabelSvg :item="sample(sz.id)" :size="sz" :panel-style="panel.style" /></svg>
              </div>
              <input v-model="sz.name" class="input sm" placeholder="Name" />
              <div class="dims">
                <input v-model.number="sz.width" type="number" min="5" max="200" step="0.5" class="input sm mono" />
                <span class="muted">×</span>
                <input v-model.number="sz.height" type="number" min="4" max="60" step="0.5" class="input sm mono" />
                <span class="muted">mm</span>
              </div>
              <button class="btn ghost sm icon danger" :disabled="s.sizes.length <= 1" title="Remove size" @click="removeSize(sz.id)"><Ico name="delete-outline" /></button>
            </div>
          </div>
          <div class="row">
            <button class="btn sm" @click="addSize"><Ico name="plus" /> Add size</button>
            <button class="btn sm ghost" @click="resetSizes"><Ico name="refresh" /> Restore defaults</button>
          </div>
        </template>

        <template v-else-if="tab === 'ai'">
          <p class="hint" style="margin: 0">AI import reads panel photos and the electrician's list (photos, scans, PDF, Word) using Claude.</p>
          <div class="seg">
            <button :class="{ on: s.ai.mode === 'server' }" @click="s.ai.mode = 'server'">Use the server</button>
            <button :class="{ on: s.ai.mode === 'key' }" @click="s.ai.mode = 'key'">Use my own API key</button>
          </div>
          <template v-if="s.ai.mode === 'server'">
            <div class="row">
              <span v-if="serverAi?.ai" class="pill ok"><Ico name="check" /> Server AI is configured</span>
              <span v-else class="pill warn">Server has no API key</span>
              <button class="btn ghost sm" @click="checkServer"><Ico name="refresh" /> Recheck</button>
            </div>
            <div v-if="serverAi?.accessCode || s.ai.accessCode" class="field">
              <label>Access code</label>
              <input v-model="s.ai.accessCode" class="input" type="password" autocomplete="off" placeholder="Set by whoever deployed this tool" />
            </div>
          </template>
          <template v-else>
            <div class="field">
              <label>Anthropic API key</label>
              <input v-model="s.ai.apiKey" class="input mono" type="password" autocomplete="off" placeholder="sk-ant-…" />
              <span class="hint">Stored only in this browser's local storage and sent straight to api.anthropic.com.</span>
            </div>
          </template>
        </template>

        <template v-else-if="tab === 'colors'">
          <p class="hint" style="margin: 0">Swatches offered for label colours. The first ones are used for auto-colouring: lighting, power, water, outdoor, tech, kitchen, climate, misc.</p>
          <div class="palette">
            <div v-for="(c, i) in s.palette" :key="i" class="pal">
              <input v-model="s.palette[i]" type="color" />
              <button class="btn ghost sm icon" @click="s.palette.splice(i, 1)"><Ico name="close" /></button>
            </div>
            <button class="btn sm" @click="s.palette.push('#888888')"><Ico name="plus" /></button>
          </div>
          <button class="btn sm ghost" style="justify-self: start" @click="s.palette.splice(0, s.palette.length, ...PALETTE)"><Ico name="refresh" /> Restore defaults</button>
        </template>

        <template v-else>
          <p class="hint" style="margin: 0">Everything is stored locally in this browser. Export a backup to move it to another device.</p>
          <div class="row">
            <button class="btn" @click="exportAll"><Ico name="download" /> Export everything</button>
            <button class="btn danger" @click="resetAll"><Ico name="delete-outline" /> Erase all data</button>
          </div>
        </template>
      </div>
      <div class="modal-foot"><button class="btn dark" @click="emit('close')">Done</button></div>
    </div>
  </div>
</template>

<style scoped>
.tabs { display: flex; gap: 2px; padding: 0 16px; border-bottom: 1px solid var(--border); }
.tabs button { border: 0; background: transparent; padding: 10px 10px; font-weight: 600; color: var(--text-3); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tabs button.on { color: var(--text); border-bottom-color: var(--text); }
.sizes { display: grid; gap: 8px; }
.size-row { display: grid; grid-template-columns: 180px 1fr auto auto; gap: 10px; align-items: center; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius); }
.pv { display: grid; place-items: center start; }
.pv svg { box-shadow: 0 0 0 1px var(--border); border-radius: 2px; max-width: 170px; height: auto; }
.dims { display: flex; align-items: center; gap: 6px; }
.dims .input { width: 70px; }
.mono { font-family: var(--mono); }
.palette { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.pal { display: flex; align-items: center; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 2px; }
@media (max-width: 640px) { .size-row { grid-template-columns: 1fr 1fr; } }
</style>
