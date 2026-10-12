<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import GlassButton from '../../components/ui/GlassButton.vue'
import GlassCard from '../../components/ui/GlassCard.vue'
import CourseCard from '../../components/CourseCard.vue'
import { api } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import type { CourseSummary } from '../../lib/types'

type PathSummary = { id: string; slug: string; title: string; description: string | null; thumbnailUrl: string | null; courseCount: number }

const courses = ref<CourseSummary[]>([])
const paths = ref<PathSummary[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const [c, p] = await Promise.all([
      api.get<{ courses: CourseSummary[] }>('/courses'),
      api.get<{ paths: PathSummary[] }>('/learning-paths'),
    ])
    courses.value = c.data.courses
    paths.value = p.data.paths
  } finally {
    loading.value = false
  }
})

// Destaque do hero: curso marcado como "destaque" no admin, ou o mais recente
const heroCourse = computed(() => courses.value.find((c) => c.featured) ?? courses.value[0] ?? null)
const heroImage = computed(() => heroCourse.value?.thumbnailUrl || '/assets/hero_premium_bg_1788306655617.jpg')

// Carrosséis por categoria (padrão streaming)
const categories = computed(() => {
  const groups = new Map<string, { name: string; courses: CourseSummary[] }>()
  for (const c of courses.value) {
    const key = c.category?.slug ?? 'outros'
    if (!groups.has(key)) groups.set(key, { name: c.category?.name ?? 'Outros cursos', courses: [] })
    groups.get(key)!.courses.push(c)
  }
  return [...groups.entries()].map(([slug, g]) => ({ slug, ...g }))
})

const differentials = [
  { icon: 'play', title: 'Streaming Premium', description: 'Player adaptativo HLS com CDN global. Assista sem travamentos, de qualquer lugar, retomando de onde parou.' },
  { icon: 'shield', title: 'Certificados Verificáveis', description: 'Certificados com código de autenticação único. Prove suas conquistas para o mercado.' },
  { icon: 'chart', title: 'Trilhas Inteligentes', description: 'Roteiros de aprendizagem curados por especialistas. Siga a sequência ideal para resultados mais rápidos.' },
  { icon: 'bolt', title: 'Quizzes Interativos', description: 'Avaliações ao final das aulas e prova final do curso. Teste seu conhecimento antes de avançar.' },
]
</script>

<template>
  <div class="min-h-screen bg-bg-base text-text-primary">
    
    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- HERO — Cinematic, full viewport                        -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <section class="relative w-full h-[100vh] min-h-[620px] flex flex-col justify-end overflow-hidden">
      <div class="absolute inset-0 w-full h-full">
        <img :src="heroImage" alt="" class="w-full h-full object-cover scale-105 motion-safe:animate-[slow-zoom_25s_ease-in-out_infinite_alternate]">
        
        <!-- Layered Gradients -->
        <div class="absolute inset-0 bg-black/55"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/80 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-bg-base/80 via-bg-base/40 to-transparent"></div>
        
        <!-- Subtle grain overlay -->
        <div class="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20viewBox%3D%220%200%20256%20256%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22f%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.9%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23f)%22%2F%3E%3C%2Fsvg%3E')]"></div>
      </div>
      
      <div class="relative z-10 w-full px-4 md:px-16 pb-28 max-w-7xl mx-auto flex flex-col items-start">
        <div class="inline-flex items-center gap-2 mb-6 hero-stagger" style="--stagger: 0">
          <span class="w-2 h-2 rounded-full bg-accent-gold shadow-[0_0_12px_rgba(198,161,91,0.8)] animate-pulse"></span>
          <span class="text-xs font-bold text-accent-gold">{{ heroCourse?.category?.name ?? 'Em destaque' }}</span>
        </div>
        
        <h1 class="text-5xl sm:text-7xl md:text-[5.5rem] lg:text-[7rem] font-display font-black leading-[0.95] tracking-[-0.04em] mb-8 max-w-5xl hero-stagger" style="--stagger: 1">
          <span class="text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/50">{{ heroCourse?.title ?? 'Aprenda a construir seu negócio digital' }}</span>
        </h1>
        
        <p class="text-lg md:text-2xl text-text-muted max-w-2xl mb-12 leading-relaxed font-light hero-stagger" style="--stagger: 2">
          {{ heroCourse?.description ?? 'Cursos práticos de empreendedorismo digital, com certificado verificável.' }}
        </p>
        
        <div class="flex flex-wrap items-center gap-5 hero-stagger" style="--stagger: 3">
          <RouterLink v-if="heroCourse" :to="`/course/${heroCourse.slug}`">
            <GlassButton variant="gold" size="lg" class="shadow-[0_0_50px_-12px_rgba(198,161,91,0.6)] text-lg px-10 py-4">
              {{ heroCourse.priceCents === 0 ? 'Começar grátis' : `Conhecer o curso · ${formatPrice(heroCourse.priceCents)}` }}
            </GlassButton>
          </RouterLink>
          <RouterLink to="/cursos">
            <GlassButton variant="glass" size="lg">Ver todos os cursos</GlassButton>
          </RouterLink>
        </div>
      </div>

      <!-- Scroll indicator -->
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-muted/40 motion-safe:animate-bounce">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- CATÁLOGO — Carrosséis por Categoria                    -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <section v-if="loading" class="max-w-[1400px] mx-auto px-4 md:px-16 mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div v-for="i in 4" :key="i" class="skeleton-card aspect-[4/5] rounded-[28px] bg-white/5"></div>
    </section>
    <section v-for="cat in categories" :key="cat.slug" class="max-w-[1400px] mx-auto px-4 md:px-16 mt-24 section-reveal">
      <div class="flex items-center justify-between mb-8">
        <h2 class="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-text-muted">
          {{ cat.name }}
        </h2>
        <RouterLink :to="{ path: '/cursos', query: cat.slug === 'outros' ? {} : { categoria: cat.slug } }" class="text-accent-gold hover:text-white transition-colors text-sm font-bold flex items-center gap-1 group">
          Ver todos
          <svg class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </RouterLink>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <CourseCard v-for="course in cat.courses.slice(0, 8)" :key="course.id" :course="course" />
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- DIFERENCIAIS — 4 pilares                               -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <section class="max-w-6xl mx-auto px-8 md:px-16 py-32 section-reveal">
      <div class="text-center mb-16">
        <h2 class="text-4xl md:text-5xl font-display font-black tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
          Por que a Multimilionário?
        </h2>
        <p class="text-text-muted text-lg max-w-2xl mx-auto font-light">
          Tecnologia de ponta e conteúdo prático se encontram para acelerar seus resultados.
        </p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard v-for="(diff, i) in differentials" :key="i" padding="lg" class="group hover:bg-white/[0.04] transition-colors duration-500">
          <div class="flex items-start gap-6">
            <div class="w-14 h-14 rounded-2xl bg-accent-gold/10 text-accent-gold flex items-center justify-center shrink-0 group-hover:bg-accent-gold/20 transition-colors">
              <!-- Play -->
              <svg v-if="diff.icon === 'play'" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <!-- Shield -->
              <svg v-else-if="diff.icon === 'shield'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <!-- Chart -->
              <svg v-else-if="diff.icon === 'chart'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              <!-- Bolt -->
              <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <div>
              <h3 class="text-xl font-display font-bold text-white mb-2">{{ diff.title }}</h3>
              <p class="text-text-muted leading-relaxed">{{ diff.description }}</p>
            </div>
          </div>
        </GlassCard>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- TRILHAS — Preview                                      -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <section v-if="paths.length" class="max-w-6xl mx-auto px-4 md:px-16 pb-24 section-reveal">
      <div class="text-center mb-16">
        <h2 class="text-4xl md:text-5xl font-display font-black tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
          Trilhas de Aprendizagem
        </h2>
        <p class="text-text-muted text-lg max-w-2xl mx-auto font-light">
          Siga roteiros curados para ir do zero à maestria, na ordem certa.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <RouterLink 
          v-for="p in paths" :key="p.slug"
          :to="`/paths/${p.slug}`"
          class="block group outline-none focus-ring rounded-[28px]"
        >
          <GlassCard padding="none" interactive class="h-full bg-black flex flex-col overflow-hidden">
            <div class="aspect-video w-full relative overflow-hidden">
              <img :src="p.thumbnailUrl || '/assets/hero_premium_bg_1788306655617.jpg'" :alt="p.title" class="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-700">
              <div class="absolute top-4 left-4 glass-surface px-3 py-1.5 rounded-lg text-xs font-bold text-white backdrop-blur-xl border border-white/20">
                {{ p.courseCount }} {{ p.courseCount === 1 ? 'curso' : 'cursos' }}
              </div>
            </div>
            <div class="p-8 flex flex-col flex-1">
              <h3 class="text-2xl font-display font-bold mb-3 text-white group-hover:text-accent-gold transition-colors">{{ p.title }}</h3>
              <p v-if="p.description" class="text-text-muted leading-relaxed">{{ p.description }}</p>
              <div class="flex items-center text-accent-gold font-bold text-sm mt-auto pt-4">
                Explorar Trilha
                <svg class="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </div>
          </GlassCard>
        </RouterLink>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- CTA FINAL — Urgência                                   -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <section class="relative py-32 overflow-hidden section-reveal">
      <!-- Background -->
      <div class="absolute inset-0">
        <img :src="heroImage" alt="" class="w-full h-full object-cover opacity-15">
        <div class="absolute inset-0 bg-bg-base/85"></div>
        <div class="absolute inset-0 bg-gradient-to-b from-bg-base via-transparent to-bg-base"></div>
      </div>
      
      <div class="relative z-10 max-w-3xl mx-auto px-8 text-center">
        <h2 class="text-4xl md:text-6xl font-display font-black tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60">
          Comece sua transformação agora
        </h2>
        <p class="text-text-muted text-lg md:text-xl mb-12 leading-relaxed max-w-xl mx-auto font-light">
          Compre só o curso que você quer, com acesso vitalício e certificado verificável. Sem mensalidade.
        </p>
        
        <div class="flex flex-col sm:flex-row items-center justify-center gap-5">
          <RouterLink to="/cadastro">
            <GlassButton variant="gold" size="lg" class="shadow-[0_0_60px_-15px_rgba(198,161,91,0.6)] text-lg px-12 py-5">
              Criar minha conta
            </GlassButton>
          </RouterLink>
          <RouterLink to="/cursos" class="text-text-muted hover:text-white transition-colors font-medium">
            Explorar catálogo completo
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- FOOTER                                                 -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <footer class="border-t border-white/5 py-16">
      <div class="max-w-6xl mx-auto px-8 md:px-16">
        <div class="flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <span class="font-display font-black text-xl text-text-primary">Multimilionário</span>
            <p class="text-text-muted text-sm mt-2">Plataforma de cursos sobre empreendedorismo digital.</p>
          </div>
          <div class="flex items-center gap-8 text-sm text-text-muted">
            <RouterLink to="/paths" class="hover:text-white transition-colors">Trilhas</RouterLink>
            <RouterLink to="/my-courses" class="hover:text-white transition-colors">Área do Aluno</RouterLink>
            <RouterLink to="/cursos" class="hover:text-white transition-colors">Cursos</RouterLink>
          </div>
        </div>
        <div class="mt-12 pt-8 border-t border-white/5 text-center text-text-muted text-xs">
          © {{ new Date().getFullYear() }} Multimilionário. Todos os direitos reservados.
        </div>
      </div>
    </footer>

  </div>
</template>

<style scoped>
@keyframes slow-zoom {
  0% { transform: scale(1.05); }
  100% { transform: scale(1.15); }
}

/* Hero staggered entrance */
.hero-stagger {
  opacity: 0;
  transform: translateY(30px);
  animation: heroReveal 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: calc(var(--stagger, 0) * 150ms + 300ms);
}

@keyframes heroReveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Section reveal on scroll using CSS animation trigger */
.section-reveal {
  opacity: 0;
  transform: translateY(40px);
  animation: sectionReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-timeline: view();
  animation-range: entry 0% entry 40%;
}

@keyframes sectionReveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Fallback for browsers without scroll-driven animations */
@supports not (animation-timeline: view()) {
  .section-reveal {
    opacity: 1;
    transform: none;
  }
}

.skeleton-card {
  animation: pulse 1.8s ease-in-out infinite;
}
@keyframes pulse {
  50% { opacity: 0.5; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-card { animation: none; }
  .hero-stagger,
  .section-reveal {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>

