<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useIntersectionObserver } from '@vueuse/core'
import Icon from '../../components/ui/Icon.vue'
import { api, apiError, apiStatus } from '../../lib/api'
import { formatClock, formatDuration, formatPrice } from '../../lib/format'
import { setTitle } from '../../lib/title'
import type { CourseDetail } from '../../lib/types'
import { useAuthStore } from '../../stores/auth'
import { useUiStore } from '../../stores/ui'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const data = ref<CourseDetail | null>(null)
const loading = ref(true)
const notFound = ref(false)
const enrolling = ref(false)
const openModules = ref(new Set<string>())

const load = async () => {
  try {
    const res = await api.get<CourseDetail>(`/courses/${route.params.slug}`)
    data.value = res.data
    setTitle(res.data.course.title)
    // abre o módulo onde o aluno está (ou o primeiro)
    const current = res.data.modules.find((m) => m.lessons.some((l) => !l.completed)) ?? res.data.modules[0]
    if (current && openModules.value.size === 0) openModules.value.add(current.id)
  } catch (e) {
    if (apiStatus(e) === 404) notFound.value = true
    else ui.toast(apiError(e), 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const course = computed(() => data.value?.course)
const hasAccess = computed(() => data.value?.access.hasAccess ?? false)
const started = computed(() => (data.value?.progress.completed ?? 0) > 0)
const allOpen = computed(() => !!data.value && data.value.modules.every((m) => openModules.value.has(m.id)))

const toggleModule = (id: string) => {
  const next = new Set(openModules.value)
  next.has(id) ? next.delete(id) : next.add(id)
  openModules.value = next
}
const toggleAll = () => {
  openModules.value = allOpen.value ? new Set() : new Set(data.value?.modules.map((m) => m.id))
}

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
  enrolling.value = true
  try {
    await api.post(`/checkout/course/${course.value.id}`, {})
    ui.toast('Matrícula feita. Bons estudos!')
    await load()
    if (data.value?.progress.nextLessonId) router.push(`/aula/${data.value.progress.nextLessonId}`)
  } catch (e) {
    ui.toast(apiError(e), 'error')
  } finally {
    enrolling.value = false
  }
}

const ctaLabel = computed(() => {
  if (!course.value) return ''
  if (hasAccess.value) return started.value ? 'Continuar de onde parei' : 'Começar o curso'
  if (course.value.priceCents === 0) return 'Matricular-se grátis'
  return auth.isAuthenticated ? 'Comprar agora' : 'Criar conta e comprar'
})

const canOpen = (lesson: { isFreePreview: boolean }) => hasAccess.value || lesson.isFreePreview
const moduleDuration = (m: CourseDetail['modules'][number]) => m.lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0)

// Barra de compra fixa no celular quando o botão principal sai da tela
const ctaRef = ref<HTMLElement | null>(null)
const ctaVisible = ref(true)
useIntersectionObserver(ctaRef, ([entry]) => (ctaVisible.value = entry?.isIntersecting ?? true))
</script>

<template>
  <div v-if="loading" class="max-w-7xl mx-auto px-4 md:px-16 py-24" aria-busy="true">
    <div class="h-4 w-32 bg-white/5 rounded mb-6 motion-safe:animate-pulse"></div>
    <div class="h-12 w-2/3 bg-white/5 rounded-xl mb-4 motion-safe:animate-pulse"></div>
    <div class="h-5 w-1/2 bg-white/5 rounded-lg motion-safe:animate-pulse"></div>
  </div>

  <div v-else-if="notFound" class="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
    <h1 class="text-2xl font-display font-bold mb-3">Curso não encontrado</h1>
    <p class="text-text-muted mb-6">Ele pode ter sido removido ou o endereço mudou.</p>
    <RouterLink to="/cursos" class="btn-gold">Ver catálogo</RouterLink>
  </div>

  <div v-else-if="data && course" class="min-h-screen bg-bg-base text-text-primary pb-28 md:pb-24">
    <section class="relative w-full min-h-[440px] md:min-h-[520px] flex flex-col justify-end">
      <div class="absolute inset-0 w-full h-full overflow-hidden">
        <img v-if="course.thumbnailUrl" :src="course.thumbnailUrl" alt="" class="w-full h-full object-cover opacity-55">
        <div class="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/80 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/60 to-transparent"></div>
      </div>

      <div class="relative z-10 w-full px-4 md:px-16 pb-10 md:pb-14 pt-20 max-w-7xl mx-auto grid md:grid-cols-[1fr_auto] md:items-end gap-8">
        <div class="max-w-3xl">
          <nav aria-label="Trilha de navegação" class="flex items-center gap-1.5 text-sm text-text-muted mb-6">
            <RouterLink to="/cursos" class="hover:text-white transition-colors rounded focus-ring">Cursos</RouterLink>
            <template v-if="course.category">
              <Icon name="chevron-right" :size="14" class="opacity-50" />
              <RouterLink :to="{ path: '/cursos', query: { categoria: course.category.slug } }" class="text-accent-gold hover:text-white transition-colors rounded focus-ring">{{ course.category.name }}</RouterLink>
            </template>
          </nav>
          <h1 class="text-4xl md:text-6xl font-display font-black leading-[1.05] tracking-tight mb-4 text-balance">{{ course.title }}</h1>
          <p class="text-lg text-white/70 max-w-2xl leading-relaxed">{{ course.description }}</p>
          <ul class="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
            <li class="flex items-center gap-2"><Icon name="list" :size="16" class="text-white/45" />{{ data.stats.lessonCount }} aulas</li>
            <li v-if="data.stats.durationSeconds" class="flex items-center gap-2"><Icon name="clock" :size="16" class="text-white/45" />{{ formatDuration(data.stats.durationSeconds) }}</li>
            <li v-if="data.finalQuiz" class="flex items-center gap-2"><Icon name="check" :size="16" class="text-white/45" />Prova final</li>
            <li class="flex items-center gap-2"><Icon name="award" :size="16" class="text-white/45" />Certificado verificável</li>
          </ul>
        </div>

        <div ref="ctaRef" class="md:w-72 flex flex-col gap-4">
          <div v-if="hasAccess" class="w-full">
            <div class="flex justify-between text-sm mb-2">
              <span class="text-white/70">{{ data.progress.completed }} de {{ data.progress.total }} aulas</span>
              <span class="font-semibold text-white tabular-nums">{{ data.progress.percent }}%</span>
            </div>
            <div class="h-1.5 bg-white/10 rounded-full overflow-hidden" role="progressbar" :aria-valuenow="data.progress.percent" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso no curso">
              <div class="h-full bg-accent-emerald rounded-full" :style="{ width: `${data.progress.percent}%` }"></div>
            </div>
          </div>
          <div v-else>
            <p class="text-3xl font-display font-bold text-white tabular-nums">{{ formatPrice(course.priceCents) }}</p>
            <p v-if="course.priceCents > 0" class="text-sm text-white/60 mt-1">Pagamento único · acesso vitalício</p>
          </div>
          <button class="btn-gold !py-3.5 !text-base w-full" :disabled="enrolling || (hasAccess && !data.progress.nextLessonId)" @click="cta">
            <Icon v-if="enrolling" name="spinner" :size="18" />
            <Icon v-else-if="hasAccess" name="play" :size="16" />
            {{ enrolling ? 'Matriculando…' : ctaLabel }}
          </button>
        </div>
      </div>
    </section>

    <section class="max-w-4xl mx-auto px-4 md:px-8 mt-10 md:mt-14" aria-labelledby="conteudo-curso">
      <div class="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 id="conteudo-curso" class="text-2xl font-display font-bold">Conteúdo do curso</h2>
          <p class="text-sm text-text-muted mt-1">{{ data.modules.length }} {{ data.modules.length === 1 ? 'módulo' : 'módulos' }} · {{ data.stats.lessonCount }} aulas</p>
        </div>
        <button v-if="data.modules.length > 1" class="text-sm font-semibold text-accent-gold hover:text-white rounded focus-ring" @click="toggleAll">
          {{ allOpen ? 'Recolher tudo' : 'Expandir tudo' }}
        </button>
      </div>
      <p v-if="!data.modules.length" class="text-text-muted">As aulas deste curso estão sendo preparadas.</p>

      <div class="space-y-3">
        <div v-for="(mod, index) in data.modules" :key="mod.id" class="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <h3>
            <button
              class="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors focus-ring rounded-2xl"
              :aria-expanded="openModules.has(mod.id)"
              :aria-controls="`mod-${mod.id}`"
              @click="toggleModule(mod.id)"
            >
              <span class="flex-1 min-w-0">
                <span class="block text-xs text-text-muted mb-0.5">Módulo {{ index + 1 }}</span>
                <span class="block font-semibold text-white">{{ mod.title }}</span>
              </span>
              <span class="text-xs text-text-muted tabular-nums whitespace-nowrap">
                <template v-if="hasAccess">{{ mod.lessons.filter((l) => l.completed).length }}/{{ mod.lessons.length }} · </template>
                <template v-else>{{ mod.lessons.length }} aulas · </template>{{ formatDuration(moduleDuration(mod)) }}
              </span>
              <Icon name="chevron-down" :size="18" class="text-white/50 transition-transform" :class="openModules.has(mod.id) ? 'rotate-180' : ''" />
            </button>
          </h3>
          <ol v-show="openModules.has(mod.id)" :id="`mod-${mod.id}`" class="border-t border-white/5">
            <li v-for="(lesson, lIndex) in mod.lessons" :key="lesson.id">
              <component
                :is="canOpen(lesson) ? RouterLink : 'div'"
                :to="canOpen(lesson) ? `/aula/${lesson.id}` : undefined"
                class="flex items-center gap-4 px-5 py-3.5 transition-colors"
                :class="canOpen(lesson) ? 'group hover:bg-white/[0.04] focus-ring' : 'text-white/55'"
              >
                <span
                  class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs"
                  :class="lesson.completed ? 'bg-accent-emerald/20 text-emerald-soft' : canOpen(lesson) ? 'bg-white/[0.06] text-white/70 group-hover:bg-white/10 group-hover:text-white' : 'bg-white/[0.04] text-white/40'"
                >
                  <Icon v-if="lesson.completed" name="check" :size="15" />
                  <Icon v-else-if="!canOpen(lesson)" name="lock" :size="14" />
                  <span v-else class="tabular-nums">{{ lIndex + 1 }}</span>
                </span>
                <span class="flex-1 min-w-0">
                  <span class="block truncate" :class="canOpen(lesson) ? 'text-white group-hover:text-accent-gold transition-colors' : ''">{{ lesson.title }}</span>
                  <span v-if="lesson.isFreePreview && !hasAccess" class="text-xs font-semibold text-emerald-soft">Amostra grátis</span>
                </span>
                <span v-if="lesson.quizId" class="hidden sm:inline text-xs text-white/45">Quiz</span>
                <span v-if="lesson.durationSeconds" class="text-sm text-text-muted tabular-nums">{{ formatClock(lesson.durationSeconds) }}</span>
                <span v-if="!canOpen(lesson)" class="sr-only">(bloqueada)</span>
              </component>
            </li>
          </ol>
        </div>

        <div v-if="data.finalQuiz" class="rounded-2xl border border-accent-gold/25 bg-accent-gold/[0.06] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-start gap-4">
            <span class="w-8 h-8 rounded-full bg-accent-gold/15 text-accent-gold flex items-center justify-center shrink-0"><Icon name="award" :size="16" /></span>
            <div>
              <p class="font-semibold text-white">{{ data.finalQuiz.title }}</p>
              <p class="text-sm text-text-muted">Nota mínima {{ data.finalQuiz.passingScorePercent }}% — necessária para emitir o certificado.</p>
            </div>
          </div>
          <RouterLink v-if="hasAccess" :to="`/quiz/${data.finalQuiz.id}`" class="btn-glass shrink-0">Fazer a prova</RouterLink>
        </div>
      </div>
    </section>

    <!-- Barra fixa de ação no celular -->
    <Transition name="bar">
      <div v-if="!ctaVisible" class="md:hidden fixed bottom-0 inset-x-0 z-40 glass-surface !bg-[#0b0e16]/85 !border-x-0 !border-b-0 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-xs text-white/60 truncate">{{ course.title }}</p>
          <p class="font-semibold text-white tabular-nums">{{ hasAccess ? `${data.progress.percent}% concluído` : formatPrice(course.priceCents) }}</p>
        </div>
        <button class="btn-gold shrink-0" :disabled="enrolling" @click="cta">{{ hasAccess ? 'Continuar' : course.priceCents === 0 ? 'Matricular' : 'Comprar' }}</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bar-enter-active,
.bar-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.bar-enter-from,
.bar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .bar-enter-active,
  .bar-leave-active {
    transition: none;
  }
}
</style>
