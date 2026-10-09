import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { preloadFonts } from './lib/fonts'

createApp(App).mount('#app')
preloadFonts()
