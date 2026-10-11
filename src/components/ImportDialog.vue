<script setup lang="ts">
import { computed, ref } from 'vue'
import Ico from './Ico.vue'
import LabelSvg from './LabelSvg.vue'
import type { AnalyzeDoc, AnalyzedItem } from '../lib/ai-schema'
import { KINDS } from '../lib/ai-schema'
import { downscaleImage, fileToDoc, stripDataUrl } from '../lib/files'
import { parseCircuitList } from '../lib/parseMap'
import { aiAvailable, runAnalysis, serverAi } from '../lib/aiClient'
import { applyDraft, toLabel, type DraftRow, type ImportMode } from '../lib/applyImport'
import { curatedNames, iconBody } from '../icons'
import { panel, setPhoto, sizeById, sizes, state } from '../store'
import { toast } from '../lib/toast'

const emit = defineEmits<{ close: [] }>()

const step = ref<'sources' | 'review'>('sources')
const photo = ref<{ url: string; name: string } | null>(null)
const keepPhoto = ref(true)
const docs = ref<(AnalyzeDoc & { preview?: string })[]>([])
const pasted = ref('')
const instructions = ref('')
const busy = ref(false)
const error = ref('')
const draft = ref<DraftRow[]>([])
const summary = ref('')
const warnings = ref<string[]>([])
const unparsed = ref<string[]>([])
const hasExisting = panel.value.rows.some(r => r.items.length)
const mode = ref<ImportMode>(hasExisting ? 'merge' : 'replace')
/** A draft with its own row structure (several rows, or read from a photo) should replace the layout by default. */
function pickMode() {
  mode.value = !hasExisting || draft.value.length > 1 || photo.value ? 'replace' : 'merge'
}
const overPhoto = ref(false)
const overDoc = ref(false)

const textOnly = computed(() => !photo.value && docs.value.every(d => d.kind === 'text') && (pasted.value.trim() || docs.value.length))
const hasInput = computed(() => !!photo.value || docs.value.length > 0 || !!pasted.value.trim())
const ai = computed(() => aiAvailable())

async function addPhoto(file?: File | null) {
  if (!file) return
  if (!file.type.startsWith('image/')) { toast('The panel photo must be an image', true); return }
  photo.value = { url: await downscaleImage(file, 1800), name: file.name }
}

async function addDocs(files: FileList | File[] | null) {
  for (const f of Array.from(files ?? [])) {
    try {
      const doc = await fileToDoc(f)
      docs.value.push(doc.kind === 'image' ? { ...doc, preview: `data:image/jpeg;base64,${doc.data}` } : doc)
    } catch {
      toast(`Could not read ${f.name}`, true)
    }
  }
}

function pickInput(accept: string, multiple: boolean, cb: (files: FileList | null) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.multiple = multiple
  input.onchange = () => cb(input.files)
  input.click()
}

function allText() {
  return [pasted.value, ...docs.value.filter(d => d.kind === 'text').map(d => (d as { text: string }).text)].filter(Boolean).join('\n')
}

function parseLocally() {
  const res = parseCircuitList(allText())
  if (!res.items.length) { error.value = 'No “number – name” lines found. Try the AI import instead.'; return }
  draft.value = [{ name: 'Row 1', items: res.items }]
  pickMode()
  unparsed.value = res.unparsed
  summary.value = `Found ${res.items.length} circuits in the list.`
  warnings.value = []
  step.value = 'review'
}

async function analyze() {
  error.value = ''
  busy.value = true
  try {
    const allDocs: AnalyzeDoc[] = docs.value.map(({ preview: _p, ...d }) => d as AnalyzeDoc)
    if (pasted.value.trim()) allDocs.push({ kind: 'text', name: 'pasted', text: pasted.value })
    const result = await runAnalysis({
      photo: photo.value ? { media_type: 'image/jpeg', data: stripDataUrl(photo.value.url) } : undefined,
      docs: allDocs,
      sizes: state.settings.sizes.map(({ id, name, width, height }) => ({ id, name, width, height })),
      icons: curatedNames,
      instructions: instructions.value,
    })
    draft.value = result.rows
    pickMode()
    summary.value = result.summary
    warnings.value = result.warnings
    unparsed.value = []
    step.value = 'review'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function removeItem(row: DraftRow, i: number) {
  row.items.splice(i, 1)
}

function addDraftItem(row: DraftRow) {
  row.items.push({ number: '', text: '', sub: '', icon: '', sizeId: sizes.value[0]?.id ?? '', kind: 'breaker', notes: '' })
}

const draftCount = computed(() => draft.value.reduce((n, r) => n + r.items.length, 0))
const preview = (a: AnalyzedItem) => toLabel(a)

async function apply() {
  if (photo.value && keepPhoto.value) await setPhoto(photo.value.url)
  const { matched, added } = applyDraft(panel.value, draft.value, mode.value)
  toast(mode.value === 'merge' ? `Updated ${matched} label${matched === 1 ? '' : 's'}, added ${added}` : `Added ${added} label${added === 1 ? '' : 's'}`)
  emit('close')
}
</script>

<template>
  <div class="backdrop" @mousedown.self="emit('close')">
    <div class="modal wide">
      <div class="modal-head">
        <Ico name="creation" style="width: 20px; height: 20px" />
        <h2>{{ step === 'sources' ? 'Import panel map' : 'Review & apply' }}</h2>
        <button class="btn ghost icon" @click="emit('close')"><Ico name="close" /></button>
      </div>

      <!-- ===== step 1: sources ===== -->
      <div v-if="step === 'sources'" class="modal-body">
        <div class="cols">
          <div class="field">
            <label>1 · Photo of the panel <span class="muted">(optional)</span></label>
            <div
              v-if="!photo" class="drop tall" :class="{ over: overPhoto }"
              @click="pickInput('image/*', false, f => addPhoto(f?.[0]))"
              @dragover.prevent="overPhoto = true" @dragleave="overPhoto = false" @drop.prevent="overPhoto = false; addPhoto($event.dataTransfer?.files[0])"
            >
              <Ico name="image-plus-outline" />
              <b>Drop or choose a photo</b>
              <span class="hint">Shoot straight on, with the cover open so every breaker is visible. Used to find the rows, order and widths.</span>
            </div>
            <div v-else class="photo-prev">
              <img :src="photo.url" alt="" />
              <div class="row">
                <label class="switch grow"><span>Keep as reference photo</span><input v-model="keepPhoto" type="checkbox" /></label>
                <button class="btn sm ghost danger" @click="photo = null"><Ico name="delete-outline" /></button>
              </div>
            </div>
          </div>

          <div class="field">
            <label>2 · Electrician's circuit list <span class="muted">(optional)</span></label>
            <div
              class="drop" :class="{ over: overDoc }"
              @click="pickInput('image/*,.pdf,.docx,.txt,.csv,.md,text/plain', true, addDocs)"
              @dragover.prevent="overDoc = true" @dragleave="overDoc = false" @drop.prevent="overDoc = false; addDocs($event.dataTransfer?.files ?? null)"
            >
              <Ico name="file-document-outline" />
              <b>Drop photos, PDF, Word or text files</b>
              <span class="hint">Handwritten lists and scans work too (AI).</span>
            </div>
            <div v-if="docs.length" class="docs">
              <div v-for="(d, i) in docs" :key="i" class="doc">
                <img v-if="d.preview" :src="d.preview" alt="" />
                <Ico v-else :name="d.kind === 'pdf' ? 'file-pdf-box' : 'text-box-outline'" />
                <span class="grow ellipsis">{{ d.name }}</span>
                <span class="pill">{{ d.kind }}</span>
                <button class="btn ghost sm icon" @click="docs.splice(i, 1)"><Ico name="close" /></button>
              </div>
            </div>
            <textarea v-model="pasted" class="textarea mono-ish" rows="5" placeholder="…or paste it here:&#10;1 - Refrigerator&#10;2 - Bathroom lights&#10;3 - Kitchen sockets 16A" />
          </div>
        </div>

        <div class="field">
          <label>Instructions for the AI <span class="muted">(optional)</span></label>
          <input v-model="instructions" class="input" placeholder="e.g. Translate labels to English · The top row has the main switch · Numbers start at Q1" />
        </div>

        <div v-if="error" class="error"><Ico name="alert-circle-outline" /> {{ error }}</div>

        <div class="ai-status">
          <template v-if="ai">
            <span class="pill ok"><Ico name="check" /> AI ready</span>
            <span class="hint">{{ state.settings.ai.mode === 'key' ? 'Using your own API key from this browser.' : 'Using the server.' }} Photos and documents are sent to Claude for analysis.</span>
          </template>
          <template v-else>
            <span class="pill warn">AI unavailable</span>
            <span class="hint">{{ serverAi === null ? 'Checking server…' : 'No server key configured. Add your own Anthropic API key in Settings → AI, or use “Parse list” for plain text lists.' }}</span>
          </template>
        </div>
      </div>

      <!-- ===== step 2: review ===== -->
      <div v-else class="modal-body">
        <div class="summary">
          <p v-if="summary"><b>{{ summary }}</b></p>
          <ul v-if="warnings.length" class="warnings">
            <li v-for="(w, i) in warnings" :key="i"><Ico name="alert-circle-outline" /> {{ w }}</li>
          </ul>
          <details v-if="unparsed.length" class="hint">
            <summary>{{ unparsed.length }} line{{ unparsed.length === 1 ? '' : 's' }} skipped</summary>
            <pre>{{ unparsed.join('\n') }}</pre>
          </details>
        </div>

        <div v-for="(row, ri) in draft" :key="ri" class="draft-row">
          <div class="row">
            <input v-model="row.name" class="input sm" style="width: 160px; font-weight: 600" />
            <span class="hint">{{ row.items.length }} items</span>
            <div class="grow" />
            <button class="btn ghost sm" @click="addDraftItem(row)"><Ico name="plus" /> Item</button>
            <button class="btn ghost sm icon danger" title="Remove row" @click="draft.splice(ri, 1)"><Ico name="delete-outline" /></button>
          </div>
          <div class="table-wrap">
          <table>
            <thead><tr><th>Preview</th><th>No.</th><th>Label</th><th>2nd line</th><th>Icon</th><th>Size</th><th>Type</th><th /></tr></thead>
            <tbody>
              <tr v-for="(it, i) in row.items" :key="i" :title="it.notes">
                <td class="pv">
                  <svg
                    :width="sizeById(preview(it).sizeId).width * 3.4" :height="sizeById(preview(it).sizeId).height * 3.4"
                    :viewBox="`0 0 ${sizeById(preview(it).sizeId).width} ${sizeById(preview(it).sizeId).height}`"
                  ><LabelSvg :item="preview(it)" :size="sizeById(preview(it).sizeId)" :panel-style="panel.style" /></svg>
                </td>
                <td><input v-model="it.number" class="input sm mono" style="width: 56px" /></td>
                <td><input v-model="it.text" class="input sm" /></td>
                <td><input v-model="it.sub" class="input sm" style="width: 90px" /></td>
                <td>
                  <div class="row icon-cell">
                    <svg v-if="it.icon" viewBox="0 0 24 24"><g fill="currentColor" v-html="iconBody(`mdi:${it.icon}`)" /></svg>
                    <select v-model="it.icon" class="select sm">
                      <option value="">auto</option>
                      <option v-for="n in curatedNames" :key="n" :value="n">{{ n }}</option>
                    </select>
                  </div>
                </td>
                <td>
                  <select v-model="it.sizeId" class="select sm">
                    <option value="">smallest</option>
                    <option v-for="s in sizes" :key="s.id" :value="s.id">{{ s.width }}×{{ s.height }}</option>
                  </select>
                </td>
                <td><select v-model="it.kind" class="select sm"><option v-for="k in KINDS" :key="k" :value="k">{{ k }}</option></select></td>
                <td><button class="btn ghost sm icon" @click="removeItem(row, i)"><Ico name="close" /></button></td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>

        <div class="field">
          <label>How to apply</label>
          <div class="modes">
            <label class="mode" :class="{ on: mode === 'replace' }"><input v-model="mode" type="radio" value="replace" /><b>Replace layout</b><span class="hint">Rows and labels become exactly this.</span></label>
            <label class="mode" :class="{ on: mode === 'merge' }" :aria-disabled="!hasExisting"><input v-model="mode" type="radio" value="merge" :disabled="!hasExisting" /><b>Fill by number</b><span class="hint">Keep my layout, update labels with matching numbers. New ones go into rows of the same name.</span></label>
            <label class="mode" :class="{ on: mode === 'append' }"><input v-model="mode" type="radio" value="append" /><b>Add rows</b><span class="hint">Append below the existing rows.</span></label>
          </div>
        </div>
      </div>

      <div class="modal-foot">
        <template v-if="step === 'sources'">
          <button class="btn ghost" @click="emit('close')">Cancel</button>
          <div class="grow" />
          <button class="btn" :disabled="!textOnly" title="Offline parser for simple “number – name” lists" @click="parseLocally"><Ico name="format-list-numbered" /> Parse list</button>
          <button class="btn primary" :disabled="!hasInput || !ai || busy" @click="analyze">
            <span v-if="busy" class="spinner" /><Ico v-else name="creation" />
            {{ busy ? 'Analyzing… (up to a minute)' : 'Analyze with AI' }}
          </button>
        </template>
        <template v-else>
          <button class="btn ghost" @click="step = 'sources'"><Ico name="arrow-left" /> Back</button>
          <div class="grow" />
          <button class="btn primary" :disabled="!draftCount" @click="apply"><Ico name="check" /> Apply {{ draftCount }} label{{ draftCount === 1 ? '' : 's' }}</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
.drop.tall { min-height: 236px; align-content: center; }
.drop b { color: var(--text); }
.photo-prev { display: grid; gap: 8px; }
.photo-prev img { width: 100%; max-height: 240px; object-fit: contain; background: var(--surface-3); border-radius: var(--radius); }
.docs { display: grid; gap: 4px; }
.doc { display: flex; align-items: center; gap: 8px; padding: 4px 4px 4px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; }
.doc img { width: 28px; height: 28px; object-fit: cover; border-radius: 4px; }
.doc > svg { width: 20px; height: 20px; color: var(--text-3); }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mono-ish { font-family: var(--mono); font-size: 12.5px; }
.error { display: flex; gap: 8px; align-items: center; color: var(--danger); background: rgb(210 60 60 / 8%); padding: 10px 12px; border-radius: var(--radius-sm); }
.error svg { width: 18px; height: 18px; flex: none; }
.ai-status { display: flex; align-items: center; gap: 10px; }
.ai-status .pill svg { width: 13px; height: 13px; }
.summary p { margin: 0; }
.warnings { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.warnings li { display: flex; gap: 6px; align-items: flex-start; color: var(--warn); font-size: 13px; }
.warnings svg { width: 16px; height: 16px; flex: none; margin-top: 1px; }
pre { white-space: pre-wrap; font-size: 12px; }
.draft-row { border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; display: grid; gap: 8px; min-width: 0; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th { text-align: left; font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .05em; padding: 4px 4px; }
td { padding: 3px 4px; vertical-align: middle; }
td.pv svg { display: block; box-shadow: 0 0 0 1px var(--border); border-radius: 2px; }
.icon-cell { gap: 4px; flex-wrap: nowrap; }
.icon-cell svg { width: 18px; height: 18px; flex: none; }
.icon-cell .select { width: 150px; }
.mono { font-family: var(--mono); }
.modes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.mode { display: grid; gap: 2px; padding: 10px 12px; border: 1.5px solid var(--border); border-radius: var(--radius); cursor: pointer; position: relative; }
.mode input { position: absolute; opacity: 0; }
.mode.on { border-color: var(--text); background: var(--accent-soft); }
.mode[aria-disabled='true'] { opacity: .45; cursor: default; }
@media (max-width: 800px) { .cols, .modes { grid-template-columns: 1fr; } }
</style>
