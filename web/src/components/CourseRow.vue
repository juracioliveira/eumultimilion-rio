<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import Icon from './ui/Icon.vue'

/** Carrossel horizontal estilo streaming: rolagem com snap, setas no desktop, swipe no celular. */
defineProps<{ title: string; label?: string }>()

const track = ref<HTMLElement | null>(null)
const canPrev = ref(false)
const canNext = ref(false)

const update = () => {
  const el = track.value
  if (!el) return
  canPrev.value = el.scrollLeft > 4
  canNext.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

const page = (dir: -1 | 1) => {
  const el = track.value
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' })
}

onMounted(update)
useResizeObserver(track, update)
</script>

<template>
  <section class="mt-16 md:mt-20" :aria-label="label ?? title">
    <div class="max-w-[1400px] mx-auto px-4 md:px-16 flex items-end justify-between gap-4 mb-5">
      <h2 class="text-2xl md:text-3xl font-display font-bold">{{ title }}</h2>
      <div class="flex items-center gap-3">
        <slot name="action" />
        <div class="hidden md:flex gap-2">
          <button class="w-9 h-9 rounded-full glass-surface flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/10 transition focus-ring" :disabled="!canPrev" aria-label="Anteriores" @click="page(-1)">
            <Icon name="chevron-left" :size="18" />
          </button>
          <button class="w-9 h-9 rounded-full glass-surface flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/10 transition focus-ring" :disabled="!canNext" aria-label="Próximos" @click="page(1)">
            <Icon name="chevron-right" :size="18" />
          </button>
        </div>
      </div>
    </div>
    <div
      ref="track"
      class="no-scrollbar flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory scroll-px-4 md:scroll-px-16 px-4 md:px-16 pb-4 max-w-[1400px] mx-auto"
      @scroll.passive="update"
    >
      <slot />
    </div>
  </section>
</template>
