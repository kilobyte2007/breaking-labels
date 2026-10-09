import { ref } from 'vue'

export const toastMsg = ref<{ text: string; error: boolean } | null>(null)
let timer: number | undefined

export function toast(text: string, error = false) {
  toastMsg.value = { text, error }
  clearTimeout(timer)
  timer = window.setTimeout(() => { toastMsg.value = null }, error ? 5000 : 2600)
}
