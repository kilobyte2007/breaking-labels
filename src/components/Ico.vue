<script setup lang="ts">
import ui from '../icons/ui.json'
defineProps<{ name: keyof typeof ui }>()
</script>

<template>
  <svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor" v-html="ui[name]" /></svg>
</template>
