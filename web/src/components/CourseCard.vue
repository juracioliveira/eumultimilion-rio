<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { formatDuration, formatPrice } from '../lib/format'
import type { CourseSummary } from '../lib/types'

/**
 * Card de curso. "poster" (4:5) é o formato de carrossel;
 * "responsive" vira paisagem no celular para a grade do catálogo não ficar alta demais.
 */
withDefaults(defineProps<{ course: CourseSummary; layout?: 'poster' | 'responsive' }>(), { layout: 'poster' })
</script>

<template>
  <RouterLink
    :to="`/course/${course.slug}`"
    class="course-card block group rounded-[24px] md:rounded-[28px] outline-none focus-ring"
    :aria-label="`${course.title} — ${course.priceCents === 0 ? 'gratuito' : formatPrice(course.priceCents)}`"
  >
    <article
      class="relative w-full overflow-hidden rounded-[24px] md:rounded-[28px] bg-black border border-white/10 transition-[transform,border-color] duration-300 ease-out group-hover:border-white/25 motion-safe:group-hover:-translate-y-1"
      :class="layout === 'responsive' ? 'aspect-[16/10] sm:aspect-[4/5]' : 'aspect-[4/5]'"
    >
      <img
        v-if="course.thumbnailUrl"
        :src="course.thumbnailUrl"
        alt=""
        loading="lazy"
        class="absolute inset-0 w-full h-full object-cover opacity-80 transition duration-700 ease-out group-hover:opacity-100 motion-safe:group-hover:scale-105"
      >
      <div v-else class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/30 to-transparent"></div>

      <div class="absolute top-4 left-4 right-4 flex flex-wrap gap-2">
        <span v-if="course.priceCents === 0" class="glass-surface px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-soft">Gratuito</span>
        <span v-if="course.category" class="glass-surface px-2.5 py-1 rounded-lg text-xs font-medium text-white/90">{{ course.category.name }}</span>
      </div>

      <div class="absolute inset-x-0 bottom-0 p-5 md:p-6">
        <h3 class="font-display font-bold text-xl md:text-2xl leading-tight mb-2 text-white text-balance">{{ course.title }}</h3>
        <div class="flex items-center justify-between gap-3 text-xs text-white/70">
          <span>{{ course.lessonCount }} {{ course.lessonCount === 1 ? 'aula' : 'aulas' }}<template v-if="course.durationSeconds"> · {{ formatDuration(course.durationSeconds) }}</template></span>
          <span v-if="course.priceCents > 0" class="font-semibold text-white tabular-nums">{{ formatPrice(course.priceCents) }}</span>
        </div>
      </div>
    </article>
  </RouterLink>
</template>
