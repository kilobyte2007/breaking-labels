<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Ico from './Ico.vue'
import LabelSvg from './LabelSvg.vue'
import IconPicker from './IconPicker.vue'
import ColorPick from './ColorPick.vue'
import type { AccentMode, LabelItem, LabelLayout } from '../types'
import { duplicateSelected, locate, nudgeSelected, panel, removeSelected, selectedItems, selection, sizeById, sizes, state } from '../store'
import { FONTS, fontById } from '../lib/fonts'
import { DEFAULT_STYLE } from '../defaults'
import { iconBody, suggestColor, suggestIcon } from '../icons'

defineEmits<{ 'open-settings': [] }>()

const one = computed<LabelItem | null>(() => (selectedItems.value.length === 1 ? selectedItems.value[0] : null))
const many = computed(() => selectedItems.value.length > 1)
const style = computed(() => panel.value.style)
const textEl = ref<HTMLTextAreaElement>()
const showPicker = ref(false)

watch(() => one.value?.id, async (id) => {
  showPicker.value = false
  if (!id) return
  await nextTick()
  // New, empty labels get focus straight away so you can just type.
  if (one.value && !one.value.text) textEl.value?.focus()
})

const LAYOUTS: { id: LabelLayout; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'icon-left', label: 'Icon left' },
  { id: 'icon-top', label: 'Icon top' },
  { id: 'icon-only', label: 'Icon' },
  { id: 'text-only', label: 'Text' },
]
const ACCENTS: { id: AccentMode; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'stripe', label: 'Stripe' },
  { id: 'background', label: 'Fill' },
  { id: 'icon', label: 'Icon' },
]

const position = computed(() => {
  if (!one.value) return ''
  const loc = locate(one.value.id)
  if (!loc) return ''
  return `${loc.row.name} · position ${loc.index + 1} of ${loc.row.items.length}`
})

function autoIcon(item: LabelItem) {
  const s = suggestIcon(`${item.text} ${item.sub} ${item.notes}`)
  if (s) {
    item.icon = s
    if (!item.color) item.color = suggestColor(s, state.settings.palette)
  }
}

function setAll<K extends keyof LabelItem>(key: K, value: LabelItem[K]) {
  for (const i of selectedItems.value) i[key] = value
}

function autoIconAll() {
  for (const i of selectedItems.value) autoIcon(i)
}

function resetStyle() {
  Object.assign(panel.value.style, { ...DEFAULT_STYLE })
}

const previewScale = computed(() => {
  const s = one.value ? sizeById(one.value.sizeId) : null
  return s ? Math.min(300 / s.width, 110 / s.height) : 1
})
const weights = computed(() => fontById(style.value.fontId).weights)
</script>

<template>
  <aside>
    <!-- ============ single label ============ -->
    <template v-if="one">
      <div class="section preview-wrap">
        <div class="preview">
          <svg
            :width="sizeById(one.sizeId).width * previewScale" :height="sizeById(one.sizeId).height * previewScale"
            :viewBox="`0 0 ${sizeById(one.sizeId).width} ${sizeById(one.sizeId).height}`"
          >
            <LabelSvg :item="one" :size="sizeById(one.sizeId)" :panel-style="style" />
          </svg>
        </div>
        <div class="hint center">{{ position }} · {{ sizeById(one.sizeId).width }}×{{ sizeById(one.sizeId).height }} mm</div>
      </div>

      <div class="section">
        <div class="grid-num">
          <div class="field">
            <label>No.</label>
            <input v-model="one.number" class="input mono" placeholder="1" />
          </div>
          <div class="field">
            <label>Label text <span class="muted">(Enter = new line)</span></label>
            <textarea ref="textEl" v-model="one.text" class="textarea compact" rows="1" placeholder="e.g. Kitchen" />
          </div>
        </div>
        <div class="field">
          <label>Second line</label>
          <input v-model="one.sub" class="input" placeholder="e.g. 16A, Bedroom 2" />
        </div>
        <div class="field">
          <label>Size</label>
          <div class="seg">
            <button v-for="s in sizes" :key="s.id" :class="{ on: one.sizeId === s.id }" :title="s.name" @click="one.sizeId = s.id">{{ s.width }}×{{ s.height }}</button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="row">
          <span class="section-title grow">Icon</span>
          <button class="btn ghost sm" title="Pick an icon from the text" @click="autoIcon(one)"><Ico name="creation" /> Auto</button>
        </div>
        <button class="icon-current" @click="showPicker = !showPicker">
          <span class="icon-box">
            <img v-if="one.icon.startsWith('img:')" :src="one.icon.slice(4)" alt="" />
            <svg v-else-if="one.icon" viewBox="0 0 24 24"><g fill="currentColor" v-html="iconBody(one.icon)" /></svg>
            <Ico v-else name="checkbox-blank-off-outline" class="muted" />
          </span>
          <span class="grow">{{ one.icon ? (one.icon.startsWith('img:') ? 'Custom image' : one.icon.slice(4)) : 'No icon' }}</span>
          <Ico :name="showPicker ? 'chevron-up' : 'chevron-down'" />
        </button>
        <IconPicker v-if="showPicker" v-model="one.icon" :hint-text="`${one.text} ${one.sub} ${one.notes}`" />
      </div>

      <div class="section">
        <span class="section-title">Colour</span>
        <ColorPick v-model="one.color" :palette="state.settings.palette" allow-none />
        <div class="field">
          <label>Layout</label>
          <select v-model="one.layout" class="select sm">
            <option value="">Panel default ({{ LAYOUTS.find(l => l.id === style.layout)?.label }})</option>
            <option v-for="l in LAYOUTS.filter(l => l.id !== 'auto')" :key="l.id" :value="l.id">{{ l.label }}</option>
          </select>
        </div>
        <label class="switch"><span>Blank spacer <span class="muted">(not printed)</span></span><input v-model="one.blank" type="checkbox" /></label>
      </div>

      <div class="section">
        <div class="field">
          <label>Notes <span class="muted">(not printed)</span></label>
          <textarea v-model="one.notes" class="textarea" rows="2" placeholder="Full description from the electrician, rating, cable…" />
        </div>
        <div class="row actions">
          <button class="btn sm icon" title="Move left (⌥←)" @click="nudgeSelected(-1)"><Ico name="chevron-left" /></button>
          <button class="btn sm icon" title="Move right (⌥→)" @click="nudgeSelected(1)"><Ico name="chevron-right" /></button>
          <div class="grow" />
          <button class="btn sm" @click="duplicateSelected"><Ico name="content-copy" /> Duplicate</button>
          <button class="btn sm danger" @click="removeSelected"><Ico name="delete-outline" /> Delete</button>
        </div>
      </div>
    </template>

    <!-- ============ multi selection ============ -->
    <template v-else-if="many">
      <div class="section">
        <div class="row"><h3 class="grow">{{ selectedItems.length }} labels selected</h3><button class="btn ghost sm" @click="selection = []">Clear</button></div>
        <div class="field">
          <label>Size</label>
          <div class="seg"><button v-for="s in sizes" :key="s.id" @click="setAll('sizeId', s.id)">{{ s.width }}×{{ s.height }}</button></div>
        </div>
        <div class="field">
          <label>Colour</label>
          <ColorPick :model-value="''" :palette="state.settings.palette" allow-none @update:model-value="setAll('color', $event)" />
        </div>
        <div class="field">
          <label>Layout</label>
          <select class="select sm" @change="setAll('layout', ($event.target as HTMLSelectElement).value as LabelLayout)">
            <option value="" selected>Panel default</option>
            <option v-for="l in LAYOUTS.filter(l => l.id !== 'auto')" :key="l.id" :value="l.id">{{ l.label }}</option>
          </select>
        </div>
        <div class="row actions">
          <button class="btn sm" @click="autoIconAll"><Ico name="creation" /> Auto icons</button>
          <div class="grow" />
          <button class="btn sm" @click="duplicateSelected"><Ico name="content-copy" /> Duplicate</button>
          <button class="btn sm danger" @click="removeSelected"><Ico name="delete-outline" /> Delete</button>
        </div>
      </div>
    </template>

    <!-- ============ panel style ============ -->
    <template v-else>
      <div class="section">
        <div class="row"><h3 class="grow">Label style</h3><button class="btn ghost sm" title="Reset style" @click="resetStyle"><Ico name="refresh" /></button></div>
        <p class="hint" style="margin: 0">Applies to every label on this panel. Select a label to edit it.</p>
        <div class="field">
          <label>Layout</label>
          <div class="seg wrap5"><button v-for="l in LAYOUTS" :key="l.id" :class="{ on: style.layout === l.id }" @click="style.layout = l.id">{{ l.label }}</button></div>
          <span class="hint">Auto: icon on top for narrow labels, icon on the left for wide ones.</span>
        </div>
      </div>

      <div class="section">
        <span class="section-title">Text</span>
        <div class="field">
          <label>Font</label>
          <select v-model="style.fontId" class="select sm"><option v-for="f in FONTS" :key="f.id" :value="f.id">{{ f.label }}</option></select>
        </div>
        <div class="field">
          <label>Weight</label>
          <div class="seg"><button v-for="w in weights" :key="w" :class="{ on: style.fontWeight === w }" @click="style.fontWeight = w">{{ w === 400 ? 'Regular' : w === 600 ? 'Semibold' : 'Bold' }}</button></div>
        </div>
        <label class="switch"><span>UPPERCASE</span><input v-model="style.uppercase" type="checkbox" /></label>
        <div class="field">
          <label>Max text size · {{ style.maxFont.toFixed(1) }} mm</label>
          <input v-model.number="style.maxFont" type="range" min="2" max="8" step="0.1" />
        </div>
        <div class="field">
          <label>Warn below · {{ style.minFont.toFixed(1) }} mm</label>
          <input v-model.number="style.minFont" type="range" min="1" max="3" step="0.1" />
        </div>
      </div>

      <div class="section">
        <span class="section-title">Numbers</span>
        <label class="switch"><span>Show circuit numbers</span><input v-model="style.showNumber" type="checkbox" /></label>
        <div v-if="style.showNumber" class="seg">
          <button :class="{ on: style.numberStyle === 'badge' }" @click="style.numberStyle = 'badge'">Badge</button>
          <button :class="{ on: style.numberStyle === 'plain' }" @click="style.numberStyle = 'plain'">Plain</button>
        </div>
      </div>

      <div class="section">
        <span class="section-title">Colour</span>
        <div class="field">
          <label>Label colour used as</label>
          <div class="seg"><button v-for="a in ACCENTS" :key="a.id" :class="{ on: style.accentMode === a.id }" @click="style.accentMode = a.id">{{ a.label }}</button></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Text</label><div class="row"><input v-model="style.textColor" type="color" /><input v-model="style.textColor" class="input sm mono" /></div></div>
          <div class="field"><label>Background</label><div class="row"><input v-model="style.background" type="color" /><input v-model="style.background" class="input sm mono" /></div></div>
        </div>
      </div>

      <div class="section">
        <span class="section-title">Shape</span>
        <label class="switch"><span>Border</span><input v-model="style.border" type="checkbox" /></label>
        <div v-if="style.border" class="grid-2">
          <div class="field"><label>Colour</label><input v-model="style.borderColor" type="color" /></div>
          <div class="field"><label>Width · {{ style.borderWidth.toFixed(2) }} mm</label><input v-model.number="style.borderWidth" type="range" min="0.1" max="1" step="0.05" /></div>
        </div>
        <div class="field"><label>Padding · {{ style.padding.toFixed(1) }} mm</label><input v-model.number="style.padding" type="range" min="0.2" max="2.5" step="0.1" /></div>
        <div class="field">
          <label>Rounded corners · {{ style.radius ? `${style.radius.toFixed(1)} mm` : 'off' }}</label>
          <input v-model.number="style.radius" type="range" min="0" max="3" step="0.1" />
          <span class="hint">Only if you'll cut with a corner punch – hand-cut labels have square corners.</span>
        </div>
        <div class="field"><label>Icon size · {{ Math.round(style.iconScale * 100) }}%</label><input v-model.number="style.iconScale" type="range" min="0.5" max="1.2" step="0.05" /></div>
      </div>

      <div class="section">
        <span class="section-title">Label sizes</span>
        <div class="sizes">
          <div v-for="s in sizes" :key="s.id" class="size-chip"><b>{{ s.width }}×{{ s.height }}</b> <span class="muted">{{ s.name }}</span></div>
        </div>
        <button class="btn sm" @click="$emit('open-settings')"><Ico name="pencil-outline" /> Edit sizes</button>
      </div>
    </template>
  </aside>
</template>

<style scoped>
aside { display: flex; flex-direction: column; }
h3 { font-size: 15px; }
.preview-wrap { background: var(--surface-2); }
.preview { display: grid; place-items: center; min-height: 120px; }
.preview svg { filter: drop-shadow(0 1px 1px rgb(0 0 0 / 12%)) drop-shadow(0 4px 10px rgb(0 0 0 / 8%)); }
.center { text-align: center; }
.grid-num { display: grid; grid-template-columns: 64px 1fr; gap: 10px; }
.textarea.compact { min-height: 34px; height: 34px; padding-top: 6px; resize: vertical; }
.icon-current {
  display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 10px 0 4px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); cursor: pointer; text-align: left;
}
.icon-current:hover { border-color: var(--border-strong); }
.icon-current > svg { width: 16px; height: 16px; color: var(--text-3); }
.icon-box { width: 32px; height: 32px; border-radius: 6px; background: var(--surface-3); display: grid; place-items: center; }
.icon-box svg, .icon-box img { width: 22px; height: 22px; }
.actions { flex-wrap: wrap; }
.wrap5 { flex-wrap: wrap; }
.sizes { display: flex; flex-wrap: wrap; gap: 6px; }
.size-chip { font-size: 12.5px; padding: 4px 9px; border-radius: 6px; background: var(--surface-3); font-family: var(--mono); }
.size-chip .muted { font-family: Inter, sans-serif; }
</style>
