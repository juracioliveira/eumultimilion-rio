<script setup lang="ts">
import { RouterLink } from 'vue-router'
import GlassCard from './ui/GlassCard.vue'
import { formatDuration, formatPrice } from '../lib/format'
import type { CourseSummary } from '../lib/types'

defineProps<{ course: CourseSummary }>()
</script>

<template>
  <RouterLink :to="`/course/${course.slug}`" class="block group outline-none focus-ring rounded-[28px]">
    <GlassCard padding="none" interactive class="h-full bg-black">
      <div class="relative w-full aspect-[4/5] overflow-hidden">
        <img
          v-if="course.thumbnailUrl"
          :src="course.thumbnailUrl"
          :alt="course.title"
          loading="lazy"
          class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 opacity-80 group-hover:opacity-100"
        >
        <div v-else class="w-full h-full bg-gradient-to-br from-white/10 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-bg-base/95 via-bg-base/20 to-transparent"></div>

        <div class="absolute top-4 left-4 flex gap-2">
          <span v-if="course.priceCents === 0" class="glass-surface px-3 py-1.5 rounded-lg text-xs font-bold text-accent-emerald">Gratuito</span>
          <span v-if="course.category" class="glass-surface px-3 py-1.5 rounded-lg text-xs font-medium text-white/90">{{ course.category.name }}</span>
        </div>

        <div class="absolute inset-x-0 bottom-0 p-6">
          <h3 class="font-display font-bold text-2xl leading-tight mb-2 text-white">{{ course.title }}</h3>
          <div class="flex items-center justify-between text-xs text-text-muted">
            <span>{{ course.lessonCount }} aulas<template v-if="course.durationSeconds"> · {{ formatDuration(course.durationSeconds) }}</template></span>
            <span v-if="course.priceCents > 0" class="font-bold text-white">{{ formatPrice(course.priceCents) }}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  </RouterLink>
</template>
