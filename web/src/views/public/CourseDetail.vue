<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import GlassButton from '../../components/ui/GlassButton.vue'
import GlassCard from '../../components/ui/GlassCard.vue'
import { api, apiError, apiStatus } from '../../lib/api'
import { formatClock, formatDuration, formatPrice } from '../../lib/format'
import type { CourseDetail } from '../../lib/types'
import { useAuthStore } from '../../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const data = ref<CourseDetail | null>(null)
const loading = ref(true)
const notFound = ref(false)
const enrolling = ref(false)
const error = ref('')

const load = async () => {
  try {
    const res = await api.get<CourseDetail>(`/courses/${route.params.slug}`)
    data.value = res.data
  } catch (e) {
    if (apiStatus(e) === 404) notFound.value = true
    else error.value = apiError(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const course = computed(() => data.value?.course)
const hasAccess = computed(() => data.value?.access.hasAccess ?? false)
const started = computed(() => (data.value?.progress.completed ?? 0) > 0)

const cta = async () => {
  if (!data.value || !course.value) return
  if (hasAccess.value) {
    if (data.value.progress.nextLessonId) router.push(`/aula/${data.value.progress.nextLessonId}`)
    return
  }
  if (!auth.isAuthenticated) {
    router.push({ path: '/cadastro', query: { redirect: route.fullPath } })
    return
  }
  if (course.value.priceCents > 0) {
    router.push(`/checkout/${course.value.slug}`)
    return
  }
  // curso gratuito: matrícula direta
  enrolling.value = true
  error.value = ''
  try {
    await api.post(`/checkout/course/${course.value.id}`, {})
    await load()
    if (data.value?.progress.nextLessonId) router.push(`/aula/${data.value.progress.nextLessonId}`)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    enrolling.value = false
  }
}

const ctaLabel = computed(() => {
  if (!course.value) return ''
  if (hasAccess.value) return started.value ? 'Continuar assistindo' : 'Começar o curso'
  if (course.value.priceCents === 0) return 'Matricular-se grátis'
  return 'Comprar agora'
})

const lessonLink = (lesson: { id: string; isFreePreview: boolean }) => (hasAccess.value || lesson.isFreePreview ? `/aula/${lesson.id}` : null)
</script>

<template>
  <div v-if="loading" class="max-w-7xl mx-auto px-4 md:px-16 py-24">
    <div class="h-12 w-2/3 bg-white/5 rounded-xl mb-4 motion-safe:animate-pulse"></div>
    <div class="h-5 w-1/2 bg-white/5 rounded-lg motion-safe:animate-pulse"></div>
  </div>

  <div v-else-if="notFound" class="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
    <h1 class="text-2xl font-display font-bold mb-3">Curso não encontrado</h1>
    <RouterLink to="/cursos" class="btn-gold mt-4">Ver catálogo</RouterLink>
  </div>

  <div v-else-if="data && course" class="min-h-screen bg-bg-base text-text-primary pb-24">
    <section class="relative w-full min-h-[480px] md:h-[60vh] flex flex-col justify-end">
      <div class="absolute inset-0 w-full h-full overflow-hidden">
        <img v-if="course.thumbnailUrl" :src="course.thumbnailUrl" alt="" class="w-full h-full object-cover opacity-60">
        <div class="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/80 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/60 to-transparent"></div>
      </div>

      <div class="relative z-10 w-full px-4 md:px-16 pb-12 md:pb-16 pt-24 max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-8 fade-in-up">
        <div class="max-w-3xl">
          <RouterLink to="/cursos" class="inline-flex items-center gap-2 text-text-muted hover:text-white transition-colors mb-6 text-sm font-medium focus-ring rounded px-2 py-1 -ml-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Cursos
          </RouterLink>
          <p v-if="course.category" class="text-sm font-semibold text-accent-gold mb-3">{{ course.category.name }}</p>
          <h1 class="text-4xl md:text-6xl font-display font-black leading-tight tracking-tight mb-4">{{ course.title }}</h1>
          <p class="text-lg text-text-muted max-w-2xl font-light">{{ course.description }}</p>
          <p class="mt-5 text-sm text-white/70">
            {{ data.stats.lessonCount }} aulas
            <template v-if="data.stats.durationSeconds"> · {{ formatDuration(data.stats.durationSeconds) }} de conteúdo</template>
            <template v-if="data.finalQuiz"> · prova final</template>
            · certificado de conclusão
          </p>
        </div>

        <div class="flex-shrink-0 flex flex-col items-start md:items-end gap-4 md:min-w-[260px]">
          <template v-if="hasAccess">
            <div class="w-full md:w-64">
              <div class="flex justify-between text-xs text-text-muted mb-2">
                <span>Seu progresso</span><span class="font-bold text-white">{{ data.progress.percent }}%</span>
              </div>
              <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div class="h-full bg-accent-emerald" :style="{ width: `${data.progress.percent}%` }"></div>
              </div>
            </div>
          </template>
          <div v-else class="text-3xl font-display font-bold text-white">{{ formatPrice(course.priceCents) }}</div>
          <GlassButton variant="gold" size="lg" :disabled="enrolling || (hasAccess && !data.progress.nextLessonId)" @click="cta">
            {{ enrolling ? 'Matriculando…' : ctaLabel }}
          </GlassButton>
          <p v-if="error" role="alert" class="text-sm text-red-300">{{ error }}</p>
        </div>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 md:px-16 mt-12 fade-in-up delay-200">
      <h2 class="text-2xl font-display font-bold mb-8">Conteúdo do curso</h2>
      <p v-if="!data.modules.length" class="text-text-muted">As aulas deste curso estão sendo preparadas.</p>

      <div class="space-y-10">
        <div v-for="(mod, index) in data.modules" :key="mod.id" class="space-y-4">
          <h3 class="text-xl font-bold text-white/90">Módulo {{ index + 1 }} · {{ mod.title }}</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <component
              :is="lessonLink(lesson) ? RouterLink : 'div'"
              v-for="(lesson, lIndex) in mod.lessons"
              :key="lesson.id"
              :to="lessonLink(lesson) ?? undefined"
              class="block rounded-2xl outline-none focus-ring"
            >
              <GlassCard padding="md" class="flex items-center justify-between gap-4 group bg-black/40 transition-colors" :class="lessonLink(lesson) ? 'hover:bg-black/60' : 'opacity-80'">
                <div class="flex items-center gap-4 min-w-0">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                    :class="lesson.completed ? 'bg-accent-emerald/25 text-accent-emerald' : 'glass-surface text-text-muted group-hover:text-white'"
                  >
                    <svg v-if="lesson.completed" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    <svg v-else-if="lessonLink(lesson)" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs text-text-muted mb-1">
                      Aula {{ lIndex + 1 }}
                      <span v-if="lesson.isFreePreview && !hasAccess" class="ml-2 text-accent-emerald font-semibold">Amostra grátis</span>
                    </div>
                    <div class="font-medium text-white truncate">{{ lesson.title }}</div>
                  </div>
                </div>
                <div v-if="lesson.durationSeconds" class="text-sm text-text-muted tabular-nums">{{ formatClock(lesson.durationSeconds) }}</div>
              </GlassCard>
            </component>
          </div>
        </div>

        <div v-if="data.finalQuiz" class="pt-2">
          <GlassCard padding="md" class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p class="font-semibold text-white">{{ data.finalQuiz.title }}</p>
              <p class="text-sm text-text-muted">Nota mínima {{ data.finalQuiz.passingScorePercent }}% — obrigatória para emitir o certificado.</p>
            </div>
            <RouterLink v-if="hasAccess" :to="`/quiz/${data.finalQuiz.id}`" class="btn-glass">Fazer prova</RouterLink>
          </GlassCard>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.fade-in-up {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.delay-200 {
  animation-delay: 200ms;
}
@media (prefers-reduced-motion: reduce) {
  .fade-in-up {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>
