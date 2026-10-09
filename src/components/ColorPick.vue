<script setup lang="ts">
defineProps<{ modelValue: string; palette: string[]; allowNone?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <div class="swatches">
    <button v-if="allowNone" class="sw none" :class="{ on: !modelValue }" title="No colour" @click="emit('update:modelValue', '')" />
    <button
      v-for="c in palette" :key="c" class="sw" :class="{ on: modelValue.toLowerCase() === c.toLowerCase() }"
      :style="{ background: c }" :title="c" @click="emit('update:modelValue', c)"
    />
    <label class="sw custom" title="Custom colour" :style="modelValue && !palette.includes(modelValue) ? { background: modelValue } : {}">
      <input type="color" :value="modelValue || '#888888'" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
    </label>
  </div>
</template>

<style scoped>
.swatches { display: flex; flex-wrap: wrap; gap: 6px; }
.sw { width: 26px; height: 26px; border-radius: 50%; border: 0; cursor: pointer; box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%); position: relative; padding: 0; }
.sw.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text); }
.sw.none { background: linear-gradient(135deg, transparent 45%, var(--danger) 45%, var(--danger) 55%, transparent 55%), var(--surface); box-shadow: inset 0 0 0 1px var(--border-strong); }
.sw.none.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text); }
.sw.custom { background: conic-gradient(#f44, #fd0, #4d4, #0cf, #44f, #f4f, #f44); overflow: hidden; }
.sw.custom input { opacity: 0; width: 100%; height: 100%; cursor: pointer; }
</style>
