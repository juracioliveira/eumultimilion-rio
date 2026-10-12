<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import GlassCard from '../../components/ui/GlassCard.vue'
import { api, apiError } from '../../lib/api'
import { formatPrice } from '../../lib/format'

type PathResponse = {
  path: { id: string; title: string; description: string | null; thumbnailUrl: string | null }
  courses: { id: string; title: string; slug: string; description: string | null; thumbnailUrl: string | null; priceCents: number }[]
  progress: Record<string, { purchased: boolean; completed: boolean }>
  certificateCode: string | null
}

const route = useRoute()
const data = ref<PathResponse | null>(null)
const error = ref('')

onMounted(async () => {
  try {
    data.value = (await api.get<PathResponse>(`/learning-paths/${route.params.slug}`)).data
  } catch (e) {
    error.value = apiError(e, 'Trilha não encontrada.')
  }
})

const pathInfo = computed(() => ({
  title: data.value?.path.title ?? '',
  description: data.value?.path.description ?? '',
  image: data.value?.path.thumbnailUrl || '/assets/hero_premium_bg_1788306655617.jpg',
}))

// Ordem é só sugestão (não bloqueia), então "locked" = ainda não adquirido
const courses = computed(() =>
  (data.value?.courses ?? []).map((c) => {
    const p = data.value?.progress[c.id]
    const status = p?.completed ? 'completed' : p?.purchased ? 'in_progress' : 'locked'
    return { ...c, status }
  }),
)
const completedCount = computed(() => courses.value.filter((c) => c.status === 'completed').length)
</script>

<template>
  <div class="min-h-screen bg-bg-base text-text-primary pb-24">
    <!-- Hero -->
    <section class="relative w-full h-[50vh] min-h-[400px] flex flex-col justify-end">
      <div class="absolute inset-0 w-full h-full overflow-hidden">
        <img :src="pathInfo.image" alt="Cover" class="w-full h-full object-cover opacity-30">
        <div class="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/80 to-transparent"></div>
      </div>
      
      <div class="relative z-10 w-full px-8 md:px-16 pb-16 max-w-5xl mx-auto flex flex-col items-center text-center fade-in-up">
        <RouterLink to="/paths" class="inline-flex items-center gap-2 text-text-muted hover:text-white transition-colors mb-6 text-sm font-medium focus-ring rounded px-2 py-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Voltar para Trilhas
        </RouterLink>
        <h1 class="text-4xl md:text-6xl font-display font-black leading-tight tracking-tight mb-4 text-white">
          {{ pathInfo.title }}
        </h1>
        <p class="text-lg text-text-muted max-w-2xl font-light">
          {{ pathInfo.description }}
        </p>
        <p v-if="courses.length" class="mt-4 text-sm text-white/70">{{ completedCount }} de {{ courses.length }} cursos concluídos · certificado da trilha ao concluir todos</p>
        <RouterLink v-if="data?.certificateCode" :to="`/certificados/${data.certificateCode}`" class="btn-gold mt-6">Ver certificado da trilha</RouterLink>
        <p v-if="error" class="text-red-300 mt-4">{{ error }}</p>
      </div>
    </section>

    <!-- Timeline -->
    <div class="max-w-4xl mx-auto px-4 md:px-0 relative before:absolute before:inset-0 before:ml-[3.25rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-[2px] before:bg-gradient-to-b before:from-white/10 before:via-white/5 before:to-transparent fade-in-up delay-200">
      
      <div v-for="(course, index) in courses" :key="course.id" class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group mb-12 last:mb-0">
        
        <!-- Timeline Dot -->
        <div 
          class="flex items-center justify-center w-12 h-12 rounded-full border-2 glass-surface backdrop-blur-xl shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" 
          :class="[
            course.status === 'completed' ? 'border-accent-emerald text-accent-emerald' : 
            course.status === 'in_progress' ? 'border-accent-gold text-accent-gold' : 
            'border-white/10 text-text-muted'
          ]"
        >
          <svg v-if="course.status === 'completed'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span v-else class="font-display font-bold">{{ index + 1 }}</span>
        </div>
        
        <!-- Course Card -->
        <div class="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)]">
          <RouterLink :to="`/course/${course.slug}`" class="block outline-none focus-ring rounded-[28px]">
            <GlassCard padding="lg" interactive class="h-full bg-black/40 hover:bg-black/60 text-left relative overflow-hidden">
              
              <!-- Tag de Status -->
              <div class="mb-4">
                <span v-if="course.status === 'completed'" class="text-accent-emerald text-xs font-bold flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-accent-emerald shadow-[0_0_8px_rgba(46,111,94,0.8)]"></span>
                  Concluído
                </span>
                <span v-else-if="course.status === 'in_progress'" class="text-accent-gold text-xs font-bold flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-accent-gold shadow-[0_0_8px_rgba(198,161,91,0.8)]"></span>
                  Em andamento
                </span>
                <span v-else class="text-text-muted text-xs font-bold flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z"></path></svg>
                  {{ formatPrice(course.priceCents) }}
                </span>
              </div>
              
              <h3 class="font-display font-bold text-2xl mb-2 text-white">{{ course.title }}</h3>
              <p class="text-text-muted text-sm leading-relaxed mb-6">{{ course.description }}</p>
              
              <div v-if="course.status === 'locked'" class="inline-flex text-bg-base bg-accent-gold hover:brightness-110 px-5 py-2 rounded-full text-sm font-bold transition-all shadow-[0_0_20px_-5px_rgba(198,161,91,0.4)]">
                {{ course.priceCents === 0 ? 'Começar grátis' : 'Conhecer o curso' }}
              </div>
              <div v-else class="inline-flex text-white font-bold text-sm hover:text-accent-gold transition-colors">
                {{ course.status === 'completed' ? 'Rever o curso' : 'Continuar assistindo' }}
              </div>
            </GlassCard>
          </RouterLink>
        </div>
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
