<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '../../components/ui/Icon.vue'
import { api } from '../../lib/api'
import { formatClock } from '../../lib/format'
import { useAuthStore } from '../../stores/auth'

type MyCourse = {
  id: string
  title: string
  slug: string
  thumbnailUrl: string | null
  progress: { total: number; completed: number; percent: number; nextLessonId: string | null; nextLessonTitle: string | null }
  certificateCode: string | null
}
type HistoryItem = {
  lessonId: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number | null
  watchedSeconds: number
  courseTitle: string
  courseSlug: string
  courseThumbnailUrl: string | null
}

const auth = useAuthStore()
const courses = ref<MyCourse[]>([])
const history = ref<HistoryItem[]>([])
const loading = ref(true)
const filter = ref<'all' | 'progress' | 'done'>('all')

onMounted(async () => {
  try {
    const [c, h] = await Promise.all([
      api.get<{ courses: MyCourse[] }>('/student/my-courses'),
      api.get<{ history: HistoryItem[] }>('/student/continue-watching'),
    ])
    courses.value = c.data.courses
    history.value = h.data.history
  } finally {
    loading.value = false
  }
})

const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
})

/** Próximo passo: a última aula em andamento, ou a próxima aula do curso mais recente não concluído. */
const resume = computed(() => {
  const last = history.value[0]
  if (last) {
    const course = courses.value.find((c) => c.slug === last.courseSlug)
    return {
      lessonId: last.lessonId,
      lessonTitle: last.title,
      courseTitle: last.courseTitle,
      image: last.thumbnailUrl || last.courseThumbnailUrl,
      percent: course?.progress.percent ?? 0,
      remaining: last.durationSeconds ? Math.max(0, last.durationSeconds - last.watchedSeconds) : null,
    }
  }
  const course = courses.value.find((c) => c.progress.percent < 100 && c.progress.nextLessonId)
  if (!course) return null
  return { lessonId: course.progress.nextLessonId!, lessonTitle: course.progress.nextLessonTitle, courseTitle: course.title, image: course.thumbnailUrl, percent: course.progress.percent, remaining: null }
})

const stats = computed(() => ({
  lessons: courses.value.reduce((s, c) => s + c.progress.completed, 0),
  inProgress: courses.value.filter((c) => c.progress.percent < 100).length,
  certificates: courses.value.filter((c) => c.certificateCode).length,
}))

const visible = computed(() =>
  courses.value.filter((c) => (filter.value === 'all' ? true : filter.value === 'done' ? c.progress.percent === 100 : c.progress.percent < 100)),
)
</script>

<template>
  <div class="px-4 md:px-8 py-10 md:py-14 pb-24">
    <div class="max-w-7xl mx-auto">
      <header class="mb-8 md:mb-10">
        <p class="text-text-muted">{{ greeting }},</p>
        <h1 class="text-4xl md:text-5xl font-display font-black tracking-tight">{{ auth.user?.name.split(' ')[0] }}</h1>
      </header>

      <div v-if="loading" class="space-y-6" aria-busy="true">
        <div class="h-56 rounded-[28px] bg-white/5 motion-safe:animate-pulse"></div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div v-for="i in 4" :key="i" class="aspect-[4/5] rounded-[28px] bg-white/5 motion-safe:animate-pulse"></div>
        </div>
      </div>

      <!-- sem cursos -->
      <div v-else-if="!courses.length" class="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 md:p-14 text-center max-w-2xl mx-auto">
        <span class="mx-auto mb-6 w-14 h-14 rounded-full bg-accent-gold/15 text-accent-gold flex items-center justify-center"><Icon name="book" :size="24" /></span>
        <h2 class="text-2xl font-display font-bold mb-2">Comece seu primeiro curso</h2>
        <p class="text-text-muted mb-8">Há cursos gratuitos para você experimentar a plataforma agora mesmo.</p>
        <RouterLink to="/cursos" class="btn-gold">Explorar cursos</RouterLink>
      </div>

      <template v-else>
        <!-- próximo passo -->
        <RouterLink
          v-if="resume"
          :to="`/aula/${resume.lessonId}`"
          class="group block relative rounded-[28px] overflow-hidden border border-white/10 mb-8 focus-ring"
        >
          <img v-if="resume.image" :src="resume.image" alt="" class="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:opacity-55 transition-opacity duration-500">
          <div class="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/85 to-bg-base/20"></div>
          <div class="relative p-6 md:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6 min-h-[220px]">
            <div class="max-w-xl">
              <p class="text-sm font-semibold text-accent-gold mb-2">{{ resume.remaining !== null ? 'Continue de onde parou' : 'Próxima aula' }}</p>
              <p class="text-white/70 text-sm">{{ resume.courseTitle }}</p>
              <h2 class="text-2xl md:text-3xl font-display font-black text-white leading-tight mt-1 text-balance">{{ resume.lessonTitle ?? 'Próxima aula' }}</h2>
              <div class="mt-5 flex items-center gap-3 max-w-sm">
                <div class="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
                  <div class="h-full bg-accent-emerald rounded-full" :style="{ width: `${resume.percent}%` }"></div>
                </div>
                <span class="text-xs text-white/70 tabular-nums">{{ resume.percent }}% do curso</span>
              </div>
            </div>
            <span class="btn-gold self-start md:self-auto !py-3 !px-6">
              <Icon name="play" :size="16" />
              {{ resume.remaining ? `Continuar · faltam ${formatClock(resume.remaining)}` : 'Continuar' }}
            </span>
          </div>
        </RouterLink>

        <!-- resumo -->
        <div class="grid grid-cols-3 gap-3 md:gap-4 mb-12">
          <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
            <p class="text-xs md:text-sm text-text-muted">Aulas concluídas</p>
            <p class="text-2xl md:text-3xl font-display font-bold tabular-nums mt-1">{{ stats.lessons }}</p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
            <p class="text-xs md:text-sm text-text-muted">Em andamento</p>
            <p class="text-2xl md:text-3xl font-display font-bold tabular-nums mt-1">{{ stats.inProgress }}</p>
          </div>
          <RouterLink to="/perfil" class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5 hover:border-accent-gold/40 transition-colors focus-ring">
            <p class="text-xs md:text-sm text-text-muted">Certificados</p>
            <p class="text-2xl md:text-3xl font-display font-bold tabular-nums mt-1" :class="stats.certificates ? 'text-accent-gold' : ''">{{ stats.certificates }}</p>
          </RouterLink>
        </div>

        <!-- cursos -->
        <section aria-labelledby="meus-cursos">
          <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
            <h2 id="meus-cursos" class="text-2xl font-display font-bold">Meus cursos</h2>
            <div class="flex gap-1 p-1 rounded-full bg-white/5 border border-white/10" role="group" aria-label="Filtrar cursos">
              <button
                v-for="opt in [{ v: 'all', l: 'Todos' }, { v: 'progress', l: 'Em andamento' }, { v: 'done', l: 'Concluídos' }] as const"
                :key="opt.v"
                class="px-3.5 py-1.5 rounded-full text-sm transition-colors focus-ring"
                :class="filter === opt.v ? 'bg-white/15 text-white font-semibold' : 'text-white/60 hover:text-white'"
                :aria-pressed="filter === opt.v"
                @click="filter = opt.v"
              >{{ opt.l }}</button>
            </div>
          </div>

          <p v-if="!visible.length" class="text-text-muted py-8">Nenhum curso nesta lista.</p>
          <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            <li v-for="course in visible" :key="course.id" class="flex flex-col">
              <RouterLink
                :to="course.progress.nextLessonId && course.progress.percent < 100 ? `/aula/${course.progress.nextLessonId}` : `/course/${course.slug}`"
                class="group block rounded-[24px] focus-ring"
              >
                <article class="relative aspect-[16/10] sm:aspect-[4/5] rounded-[24px] overflow-hidden border border-white/10 bg-black transition-[transform,border-color] duration-300 group-hover:border-white/25 motion-safe:group-hover:-translate-y-1">
                  <img v-if="course.thumbnailUrl" :src="course.thumbnailUrl" alt="" class="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity duration-500">
                  <div class="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/30 to-transparent"></div>
                  <span v-if="course.certificateCode" class="absolute top-4 left-4 glass-surface px-2.5 py-1 rounded-lg text-xs font-semibold text-accent-gold flex items-center gap-1.5">
                    <Icon name="award" :size="14" /> Concluído
                  </span>
                  <div class="absolute inset-x-0 bottom-0 p-5">
                    <h3 class="font-display font-bold text-xl leading-tight mb-3 text-white text-balance">{{ course.title }}</h3>
                    <div class="flex items-center gap-3">
                      <div class="flex-1 h-1 bg-white/20 rounded-full overflow-hidden" role="progressbar" :aria-valuenow="course.progress.percent" aria-valuemin="0" aria-valuemax="100" :aria-label="`Progresso em ${course.title}`">
                        <div class="h-full rounded-full" :class="course.progress.percent === 100 ? 'bg-accent-gold' : 'bg-accent-emerald'" :style="{ width: `${course.progress.percent}%` }"></div>
                      </div>
                      <span class="text-xs font-semibold text-white/70 tabular-nums">{{ course.progress.completed }}/{{ course.progress.total }}</span>
                    </div>
                  </div>
                </article>
              </RouterLink>
              <RouterLink v-if="course.certificateCode" :to="`/certificados/${course.certificateCode}`" class="mt-3 px-1 text-sm text-accent-gold font-semibold hover:text-white rounded focus-ring self-start">Ver certificado</RouterLink>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>
