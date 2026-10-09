<script setup lang="ts">
import { computed } from 'vue'
import type { LabelItem, LabelSize, PanelStyle } from '../types'
import { computeLabel } from '../lib/layout'
import { fontsTick } from '../lib/fonts'
import { iconBody } from '../icons'

const props = withDefaults(defineProps<{
  item: LabelItem
  size: LabelSize
  panelStyle: PanelStyle
  x?: number
  y?: number
  /** Draw the panel border (if enabled). Off for print, where cut lines are drawn by the sheet. */
  border?: boolean
}>(), { x: 0, y: 0, border: true })

let seq = 0
const clipId = `clip-${props.item.id}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`

const g = computed(() => {
  void fontsTick.value
  return computeLabel(props.item, props.size, props.panelStyle)
})

const icon = computed(() => {
  const ic = g.value.icon
  if (!ic) return null
  if (ic.ref.startsWith('img:')) return { ...ic, href: ic.ref.slice(4), body: null }
  return { ...ic, href: null, body: iconBody(ic.ref) }
})

const radius = computed(() => Math.min(props.panelStyle.radius, props.size.height / 2))
const fontFamily = computed(() => `'${g.value.family}', sans-serif`)

defineExpose({ geometry: g })
</script>

<template>
  <svg :x="x" :y="y" :width="size.width" :height="size.height" :viewBox="`0 0 ${size.width} ${size.height}`" overflow="hidden">
    <defs>
      <clipPath :id="clipId"><rect :width="size.width" :height="size.height" :rx="radius" /></clipPath>
    </defs>
    <g :clip-path="`url(#${clipId})`">
      <rect :width="size.width" :height="size.height" :fill="g.background" />
      <rect v-if="g.stripe" :x="g.stripe.x" :y="g.stripe.y" :width="g.stripe.w" :height="g.stripe.h" :fill="g.stripe.color" />
      <template v-if="icon">
        <image v-if="icon.href" :href="icon.href" :x="icon.x" :y="icon.y" :width="icon.size" :height="icon.size" preserveAspectRatio="xMidYMid meet" />
        <svg v-else-if="icon.body" :x="icon.x" :y="icon.y" :width="icon.size" :height="icon.size" viewBox="0 0 24 24" :color="icon.color" :style="{ color: icon.color }">
          <g fill="currentColor" v-html="icon.body" />
        </svg>
      </template>
      <g v-if="g.badge">
        <rect v-if="!g.badge.plain" :x="g.badge.x" :y="g.badge.y" :width="g.badge.w" :height="g.badge.h" :rx="g.badge.h * 0.22" :fill="g.badge.fill" />
        <text
          :x="g.badge.x + g.badge.w / 2" :y="g.badge.y + g.badge.h / 2 + g.badge.fs * 0.35"
          :font-size="g.badge.fs" font-weight="700" :font-family="fontFamily" :fill="g.badge.color" text-anchor="middle"
        >{{ g.badge.text }}</text>
      </g>
      <text
        v-for="(l, i) in g.lines" :key="i"
        :x="l.x" :y="l.y" :font-size="l.fs" :font-weight="l.weight" :font-family="fontFamily" :fill="l.color" :text-anchor="l.anchor"
      >{{ l.text }}</text>
    </g>
    <rect
      v-if="border && panelStyle.border"
      :x="panelStyle.borderWidth / 2" :y="panelStyle.borderWidth / 2"
      :width="size.width - panelStyle.borderWidth" :height="size.height - panelStyle.borderWidth"
      :rx="Math.max(0, radius - panelStyle.borderWidth / 2)"
      fill="none" :stroke="panelStyle.borderColor" :stroke-width="panelStyle.borderWidth"
    />
  </svg>
</template>
