<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import Ico from './Ico.vue'
import { categories, curated, iconBody, loadFullSet, normalize, rememberIcon, suggestIcon } from '../icons'
import { downscaleImage, pickFile, readAsDataUrl } from '../lib/files'

const props = defineProps<{ modelValue: string; hintText?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const q = ref('')
const tab = ref<'curated' | 'all'>('curated')
const cat = ref<string>('')
const full = shallowRef<Record<string, string> | null>(null)
const loading = ref(false)

const suggestion = computed(() => (props.hintText ? suggestIcon(props.hintText) : ''))

const curatedList = computed(() => {
  const n = normalize(q.value)
  return curated.filter(i => (!cat.value || i.category === cat.value) && (!n || i.name.includes(n.replace(/ /g, '-')) || i.keywords.some(k => normalize(k).includes(n))))
})

watch(tab, async (t) => {
  if (t === 'all' && !full.value) {
    loading.value = true
    full.value = await loadFullSet()
    loading.value = false
  }
})

const allList = computed(() => {
  if (!full.value) return []
  const n = normalize(q.value).replace(/ /g, '-')
  const names = Object.keys(full.value)
  return (n ? names.filter(k => k.includes(n)) : names).slice(0, 240)
})

function pick(name: string, body?: string) {
  if (body) rememberIcon(name, body)
  emit('update:modelValue', `mdi:${name}`)
}

async function upload() {
  const file = await pickFile('image/svg+xml,image/png,image/jpeg,image/webp')
  if (!file) return
  const url = file.type === 'image/svg+xml' ? await readAsDataUrl(file) : await downscaleImage(file, 256, 0.92)
  emit('update:modelValue', `img:${url}`)
}
</script>

<template>
  <div class="picker">
    <div class="row">
      <div class="search grow">
        <Ico name="magnify" />
        <input v-model="q" class="input sm" placeholder="Search icons (any language)…" />
      </div>
      <button class="btn sm" title="Upload your own icon (SVG/PNG)" @click="upload"><Ico name="upload" /></button>
    </div>
    <div class="seg">
      <button :class="{ on: tab === 'curated' }" @click="tab = 'curated'">Home &amp; electrical</button>
      <button :class="{ on: tab === 'all' }" @click="tab = 'all'">All 7000+</button>
    </div>

    <div v-if="tab === 'curated'" class="cats">
      <button class="chip" :class="{ on: !cat }" @click="cat = ''">All</button>
      <button v-for="c in categories" :key="c" class="chip" :class="{ on: cat === c }" @click="cat = c">{{ c }}</button>
    </div>

    <div class="grid">
      <button class="cell none" :class="{ on: !modelValue }" title="No icon" @click="emit('update:modelValue', '')"><Ico name="checkbox-blank-off-outline" /></button>
      <button
        v-if="suggestion && tab === 'curated' && !q" class="cell suggest" :class="{ on: modelValue === suggestion }"
        :title="`Suggested: ${suggestion.slice(4)}`" @click="emit('update:modelValue', suggestion)"
      >
        <svg viewBox="0 0 24 24"><g fill="currentColor" v-html="iconBody(suggestion)" /></svg>
      </button>
      <template v-if="tab === 'curated'">
        <button v-for="i in curatedList" :key="i.name" class="cell" :class="{ on: modelValue === `mdi:${i.name}` }" :title="i.name" @click="pick(i.name)">
          <svg viewBox="0 0 24 24"><g fill="currentColor" v-html="i.body" /></svg>
        </button>
      </template>
      <template v-else>
        <div v-if="loading" class="hint" style="grid-column: 1 / -1; padding: 10px">Loading icons…</div>
        <button v-for="n in allList" :key="n" class="cell" :class="{ on: modelValue === `mdi:${n}` }" :title="n" @click="pick(n, full![n])">
          <svg viewBox="0 0 24 24"><g fill="currentColor" v-html="full![n]" /></svg>
        </button>
      </template>
    </div>
    <div v-if="tab === 'all' && full && allList.length === 240" class="hint">Showing first 240 – refine your search (English names).</div>
  </div>
</template>

<style scoped>
.picker { display: grid; gap: 8px; }
.search { position: relative; }
.search svg { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: var(--text-3); }
.search .input { padding-left: 28px; }
.cats { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { border: 1px solid var(--border); background: var(--surface); border-radius: 20px; height: 24px; padding: 0 9px; font-size: 12px; cursor: pointer; color: var(--text-2); }
.chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); gap: 4px; max-height: 220px; overflow: auto; padding: 2px; }
.cell { aspect-ratio: 1; border: 1px solid transparent; border-radius: 7px; background: var(--surface-2); cursor: pointer; display: grid; place-items: center; color: var(--text); padding: 0; }
.cell svg { width: 20px; height: 20px; }
.cell:hover { border-color: var(--border-strong); background: var(--surface); }
.cell.on { border-color: var(--focus); background: rgb(47 111 237 / 10%); box-shadow: 0 0 0 1px var(--focus); }
.cell.suggest { background: var(--accent-soft); }
.cell.none { color: var(--text-3); }
</style>
