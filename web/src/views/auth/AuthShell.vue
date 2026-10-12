<script setup lang="ts">
import GlassCard from '../../components/ui/GlassCard.vue'
defineProps<{ title: string; subtitle: string }>()
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] relative flex items-center justify-center px-4 py-16">
    <div class="absolute inset-0 overflow-hidden">
      <img src="/assets/hero_premium_bg_1788306655617.jpg" alt="" class="w-full h-full object-cover opacity-25">
      <div class="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/85 to-bg-base/40"></div>
    </div>
    <GlassCard padding="lg" class="relative z-10 w-full max-w-md">
      <h1 class="text-3xl font-display font-black text-white mb-2">{{ title }}</h1>
      <p class="text-text-muted mb-8">{{ subtitle }}</p>
      <slot />
    </GlassCard>
  </div>
</template>
