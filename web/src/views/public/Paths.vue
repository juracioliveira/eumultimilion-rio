<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import GlassCard from '../../components/ui/GlassCard.vue'
import { api } from '../../lib/api'

type PathSummary = { id: string; slug: string; title: string; description: string | null; thumbnailUrl: string | null; courseCount: number }

const paths = ref<PathSummary[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    paths.value = (await api.get<{ paths: PathSummary[] }>('/learning-paths')).data.paths
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-bg-base text-text-primary px-4 md:px-8 py-12 md:py-16 pb-24">
    <div class="max-w-7xl mx-auto">
      
      <div class="mb-12 fade-in-up">
        <h1 class="text-4xl md:text-5xl font-display font-black tracking-tight mb-2">Trilhas de Aprendizagem</h1>
        <p class="text-text-muted text-lg font-light">Siga a ordem ideal para alcançar resultados mais rápidos.</p>
      </div>

      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div v-for="i in 2" :key="i" class="aspect-video rounded-[28px] bg-white/5 motion-safe:animate-pulse"></div>
      </div>
      <p v-else-if="!paths.length" class="text-text-muted">Nenhuma trilha publicada ainda.</p>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-8 fade-in-up delay-200">
        <RouterLink 
          v-for="p in paths" :key="p.id" 
          :to="`/paths/${p.slug}`"
          class="block group outline-none focus-ring rounded-[28px]"
        >
          <GlassCard padding="none" interactive class="h-full bg-black flex flex-col overflow-hidden">
            <div class="aspect-video w-full relative overflow-hidden">
              <img :src="p.thumbnailUrl || '/assets/hero_premium_bg_1788306655617.jpg'" :alt="p.title" class="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500">
              
              <!-- Badge -->
              <div class="absolute top-4 left-4 glass-surface px-3 py-1.5 rounded-lg text-xs font-bold text-white backdrop-blur-xl border border-white/20">
                {{ p.courseCount }} {{ p.courseCount === 1 ? 'curso' : 'cursos' }}
              </div>
            </div>
            
            <div class="p-8 flex flex-col flex-1">
              <h2 class="text-2xl font-display font-bold mb-3 text-white group-hover:text-accent-gold transition-colors">{{ p.title }}</h2>
              <p class="text-text-muted mb-6 leading-relaxed flex-1">{{ p.description }}</p>
              
              <div class="flex items-center text-accent-gold font-bold text-sm group-hover:brightness-110">
                Explorar trilha
                <svg class="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </GlassCard>
        </RouterLink>
      </div>

    </div>
  </div>
</template>

<style scoped>
.fade-in-up {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@media (prefers-reduced-motion: reduce) {
  .fade-in-up {
    opacity: 1;
    transform: translateY(0);
  }
}
.delay-200 {
  animation-delay: 200ms;
}
</style>
