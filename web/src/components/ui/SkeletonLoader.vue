<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  variant?: 'text' | 'card' | 'circle' | 'thumbnail';
  lines?: number;
  width?: string;
  height?: string;
}>();

const lines = computed(() => props.lines || 1);
</script>

<template>
  <!-- Text Skeleton -->
  <div v-if="!props.variant || props.variant === 'text'" class="space-y-3" role="status" aria-label="Carregando...">
    <div 
      v-for="i in lines" 
      :key="i"
      class="skeleton-shimmer h-4 rounded-lg"
      :class="i === lines ? 'w-3/4' : 'w-full'"
      :style="{ width: props.width }"
    ></div>
  </div>

  <!-- Circle Skeleton (avatar, icon) -->
  <div 
    v-else-if="props.variant === 'circle'" 
    class="skeleton-shimmer rounded-full"
    :style="{ width: props.width || '48px', height: props.height || '48px' }"
    role="status" 
    aria-label="Carregando..."
  ></div>

  <!-- Card Skeleton -->
  <div v-else-if="props.variant === 'card'" class="glass-surface rounded-2xl md:rounded-[28px] overflow-hidden" role="status" aria-label="Carregando...">
    <div class="aspect-video w-full skeleton-shimmer"></div>
    <div class="p-6 space-y-3">
      <div class="skeleton-shimmer h-5 w-3/4 rounded-lg"></div>
      <div class="skeleton-shimmer h-4 w-full rounded-lg"></div>
      <div class="skeleton-shimmer h-4 w-1/2 rounded-lg"></div>
    </div>
  </div>

  <!-- Thumbnail Skeleton (vertical card like course card) -->
  <div v-else-if="props.variant === 'thumbnail'" class="glass-surface rounded-2xl md:rounded-[28px] overflow-hidden" role="status" aria-label="Carregando...">
    <div class="aspect-[4/5] w-full skeleton-shimmer relative">
      <div class="absolute inset-x-0 bottom-0 p-6 space-y-3">
        <div class="skeleton-shimmer-light h-6 w-3/4 rounded-lg"></div>
        <div class="skeleton-shimmer-light h-1 w-full rounded-full"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.08) 40%,
    rgba(255, 255, 255, 0.04) 80%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

.skeleton-shimmer-light {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.06) 0%,
    rgba(255, 255, 255, 0.12) 40%,
    rgba(255, 255, 255, 0.06) 80%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer,
  .skeleton-shimmer-light {
    animation: none;
    background: rgba(255, 255, 255, 0.06);
  }
}
</style>
