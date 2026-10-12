<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import HlsPlayer from '../../components/player/HlsPlayer.vue'
import LessonContent from '../../components/LessonContent.vue'
import { api, apiError, apiStatus } from '../../lib/api'
import { formatClock } from '../../lib/format'
import type { CourseDetail, VideoSource } from '../../lib/types'
import { useAuthStore } from '../../stores/auth'

type LessonResponse = {
  lesson: { id: string; title: string; description: string | null; content: string | null; durationSeconds: number | null; isFreePreview: boolean; moduleTitle: string }
  video: VideoSource
  course: { id: string; title: string; slug: string }
  hasAccess: boolean
  quiz: { id: string; title: string } | null
  progress: { watchedSeconds: number; completed: boolean }
  navigation: { previousLessonId: string | null; nextLessonId: string | null; position: number; total: number }
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const data = ref<LessonResponse | null>(null)
const outline = ref<CourseDetail | null>(null)
const loading = ref(true)
const blocked = ref<{ message: string; slug?: string; needsLogin: boolean } | null>(null)
const completed = ref(false)
const saving = ref(false)
const certificateCode = ref<string | null>(null)
const sidebarOpen = ref(false)
const error = ref('')
let lastSync = 0

const load = async (lessonId: string) => {
  loading.value = true
  blocked.value = null
  certificateCode.value = null
  sidebarOpen.value = false
  try {
    const res = await api.get<LessonResponse>(`/player/lessons/${lessonId}`)
    data.value = res.data
    completed.value = res.data.progress.completed
    lastSync = res.data.progress.watchedSeconds
    if (!outline.value || outline.value.course.id !== res.data.course.id) {
      outline.value = (await api.get<CourseDetail>(`/courses/${res.data.course.slug}`)).data
    }
  } catch (e) {
    const status = apiStatus(e)
    const body = (e as { response?: { data?: { error?: string; course?: { slug: string } } } }).response?.data
    blocked.value = {
      message: body?.error ?? apiError(e, 'Aula não encontrada.'),
      slug: body?.course?.slug,
      needsLogin: status === 401,
    }
  } finally {
    loading.value = false
  }
}

watch(() => route.params.lessonId as string, (id) => id && load(id), { immediate: true })

const canTrack = computed(() => auth.isAuthenticated && data.value?.hasAccess)

const markOutline = (value: boolean) => {
  if (!outline.value) return
  const all = outline.value.modules.flatMap((m) => m.lessons)
  const lesson = all.find((l) => l.id === data.value?.lesson.id)
  if (lesson) lesson.completed = value
  const done = all.filter((l) => l.completed).length
  outline.value.progress = { ...outline.value.progress, completed: done, percent: all.length ? Math.round((done / all.length) * 100) : 0 }
}

/** Envia o progresso a cada ~15s de vídeo e no fim. */
const onProgress = async (watched: number, total: number) => {
  if (!canTrack.value || !data.value || !total) return
  const nearEnd = watched >= total * 0.9
  if (Math.abs(watched - lastSync) < 15 && !(nearEnd && !completed.value)) return
  lastSync = watched
  try {
    const { data: res } = await api.post<{ completed: boolean; certificateCode: string | null }>(
      `/player/lessons/${data.value.lesson.id}/progress`,
      { watchedSeconds: Math.floor(watched), totalSeconds: Math.floor(total) },
    )
    if (res.completed && !completed.value) {
      completed.value = true
      markOutline(true)
    }
    if (res.certificateCode) certificateCode.value = res.certificateCode
  } catch {
    // progresso é "best effort"; tenta de novo no próximo ping
  }
}

const toggleComplete = async () => {
  if (!data.value) return
  saving.value = true
  error.value = ''
  try {
    const { data: res } = await api.post<{ completed: boolean; certificateCode: string | null }>(
      `/player/lessons/${data.value.lesson.id}/complete`,
      { completed: !completed.value },
    )
    completed.value = res.completed
    markOutline(res.completed)
    certificateCode.value = res.certificateCode
    if (res.completed && data.value.navigation.nextLessonId && !res.certificateCode) {
      router.push(`/aula/${data.value.navigation.nextLessonId}`)
    }
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

const courseDone = computed(() => outline.value && outline.value.modules.flatMap((m) => m.lessons).every((l) => l.completed))
</script>

<template>
  <div class="min-h-screen bg-bg-base text-text-primary">
    <!-- Barra superior (vidro: é navegação) -->
    <header class="sticky top-0 z-40 glass-surface !border-x-0 !border-t-0 backdrop-blur-2xl">
      <div class="h-14 px-4 md:px-6 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <RouterLink :to="data ? `/course/${data.course.slug}` : '/my-courses'" class="p-2 -ml-2 rounded-full hover:bg-white/10 focus-ring" aria-label="Voltar ao curso">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </RouterLink>
          <div class="min-w-0">
            <p class="text-[11px] text-text-muted truncate">{{ data?.course.title }}</p>
            <p class="text-sm font-semibold truncate">{{ data?.lesson.title }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="data" class="hidden sm:inline text-xs text-text-muted tabular-nums">Aula {{ data.navigation.position }} de {{ data.navigation.total }}</span>
          <button class="lg:hidden btn-glass !px-3 !py-1.5 !text-xs" :aria-expanded="sidebarOpen" @click="sidebarOpen = !sidebarOpen">Aulas</button>
        </div>
      </div>
    </header>

    <div v-if="loading && !data" class="max-w-5xl mx-auto p-6">
      <div class="aspect-video rounded-3xl bg-white/5 motion-safe:animate-pulse"></div>
    </div>

    <div v-else-if="blocked" class="min-h-[70vh] flex items-center justify-center p-4">
      <div class="glass-surface p-10 rounded-[28px] max-w-md text-center">
        <div class="w-16 h-16 bg-accent-gold/15 text-accent-gold mx-auto rounded-full flex items-center justify-center mb-6">
          <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </div>
        <h1 class="text-2xl font-display font-bold mb-2">Aula bloqueada</h1>
        <p class="text-text-muted">{{ blocked.message }}</p>
        <div class="mt-8 flex flex-wrap gap-3 justify-center">
          <RouterLink v-if="blocked.needsLogin" :to="{ path: '/login', query: { redirect: route.fullPath } }" class="btn-gold">Entrar</RouterLink>
          <RouterLink v-if="blocked.slug" :to="`/course/${blocked.slug}`" class="btn-glass">Ver o curso</RouterLink>
          <RouterLink v-else to="/cursos" class="btn-glass">Ver cursos</RouterLink>
        </div>
      </div>
    </div>

    <div v-else-if="data" class="lg:grid lg:grid-cols-[1fr_360px]">
      <main class="min-w-0 px-4 md:px-8 py-6 md:py-8 max-w-5xl w-full mx-auto">
        <div v-if="data.video.kind === 'hls' || data.video.kind === 'mp4'" class="rounded-3xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,1)]">
          <HlsPlayer :key="data.lesson.id" :src="data.video.url" :start-at="data.progress.watchedSeconds" @progress="onProgress" />
        </div>
        <div v-else-if="data.video.kind === 'embed'" class="aspect-video rounded-3xl overflow-hidden bg-black">
          <iframe
            :key="data.lesson.id"
            :src="data.video.url"
            :title="data.lesson.title"
            class="w-full h-full"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowfullscreen
          ></iframe>
        </div>

        <div class="mt-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div class="min-w-0">
            <p class="text-sm text-accent-gold font-semibold mb-2">{{ data.lesson.moduleTitle }}</p>
            <h1 class="text-2xl md:text-3xl font-display font-black leading-tight">{{ data.lesson.title }}</h1>
            <p v-if="data.lesson.description" class="text-text-muted mt-3">{{ data.lesson.description }}</p>
          </div>
          <div v-if="canTrack" class="shrink-0">
            <button
              class="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition focus-ring"
              :class="completed ? 'bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/40 hover:bg-accent-emerald/30' : 'btn-gold'"
              :disabled="saving"
              @click="toggleComplete"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              {{ completed ? 'Concluída' : 'Marcar como concluída' }}
            </button>
          </div>
          <div v-else-if="data.lesson.isFreePreview" class="shrink-0">
            <RouterLink :to="`/course/${data.course.slug}`" class="btn-gold">Amostra grátis · ver curso completo</RouterLink>
          </div>
        </div>
        <p v-if="error" role="alert" class="text-sm text-red-300 mt-3">{{ error }}</p>

        <!-- Conquista: certificado emitido (dourado = conquista) -->
        <div v-if="certificateCode || (courseDone && canTrack)" class="mt-8 rounded-[28px] border border-accent-gold/40 bg-accent-gold/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4" aria-live="polite">
          <div>
            <p class="font-display font-bold text-xl text-white">Curso concluído!</p>
            <p class="text-sm text-white/80" v-if="certificateCode">Seu certificado foi emitido.</p>
            <p class="text-sm text-white/80" v-else-if="outline?.finalQuiz">Faça a prova final para emitir seu certificado.</p>
          </div>
          <RouterLink v-if="certificateCode" :to="`/certificados/${certificateCode}`" class="btn-gold">Ver certificado</RouterLink>
          <RouterLink v-else-if="outline?.finalQuiz" :to="`/quiz/${outline.finalQuiz.id}`" class="btn-gold">Fazer prova final</RouterLink>
        </div>

        <div v-if="data.quiz && canTrack" class="mt-8 glass-surface rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p class="text-xs text-text-muted">Quiz da aula</p>
            <p class="font-semibold">{{ data.quiz.title }}</p>
          </div>
          <RouterLink :to="`/quiz/${data.quiz.id}`" class="btn-glass">Responder</RouterLink>
        </div>

        <article v-if="data.lesson.content" class="mt-10 max-w-3xl">
          <h2 class="text-lg font-display font-bold mb-4">Material da aula</h2>
          <LessonContent :source="data.lesson.content" />
        </article>

        <nav class="mt-12 pt-6 border-t border-white/10 flex justify-between gap-4" aria-label="Navegação entre aulas">
          <RouterLink v-if="data.navigation.previousLessonId" :to="`/aula/${data.navigation.previousLessonId}`" class="btn-glass">Aula anterior</RouterLink>
          <span v-else></span>
          <RouterLink v-if="data.navigation.nextLessonId" :to="`/aula/${data.navigation.nextLessonId}`" class="btn-glass">Próxima aula</RouterLink>
        </nav>
      </main>

      <!-- Lista de aulas -->
      <aside
        class="fixed lg:sticky inset-y-0 right-0 lg:top-14 z-50 lg:z-0 w-[85vw] max-w-[360px] lg:w-auto lg:max-w-none lg:h-[calc(100vh-3.5rem)] overflow-y-auto bg-bg-base lg:bg-transparent border-l border-white/10 transition-transform lg:translate-x-0"
        :class="sidebarOpen ? 'translate-x-0' : 'translate-x-full'"
        aria-label="Aulas do curso"
      >
        <div class="p-5 flex items-center justify-between lg:block">
          <div>
            <p class="font-display font-bold">Conteúdo</p>
            <p v-if="outline?.access.hasAccess" class="text-xs text-text-muted mt-1">{{ outline.progress.completed }} de {{ outline.progress.total }} concluídas</p>
          </div>
          <button class="lg:hidden p-2 rounded-full hover:bg-white/10" aria-label="Fechar" @click="sidebarOpen = false">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div v-for="(mod, mi) in outline?.modules ?? []" :key="mod.id" class="pb-4">
          <p class="px-5 py-2 text-xs font-semibold text-text-muted">Módulo {{ mi + 1 }} · {{ mod.title }}</p>
          <ul>
            <li v-for="l in mod.lessons" :key="l.id">
              <component
                :is="outline?.access.hasAccess || l.isFreePreview ? RouterLink : 'div'"
                :to="`/aula/${l.id}`"
                class="flex items-center gap-3 px-5 py-3 text-sm transition-colors"
                :class="[
                  l.id === data.lesson.id ? 'bg-white/[0.07] text-white' : 'text-white/75 hover:bg-white/[0.04]',
                  !(outline?.access.hasAccess || l.isFreePreview) ? 'opacity-50 cursor-not-allowed' : '',
                ]"
                :aria-current="l.id === data.lesson.id ? 'page' : undefined"
              >
                <span
                  class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border"
                  :class="l.completed ? 'bg-accent-emerald border-accent-emerald text-white' : 'border-white/25'"
                >
                  <svg v-if="l.completed" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                </span>
                <span class="flex-1 min-w-0 truncate">{{ l.title }}</span>
                <span v-if="l.durationSeconds" class="text-xs text-text-muted tabular-nums">{{ formatClock(l.durationSeconds) }}</span>
              </component>
            </li>
          </ul>
        </div>
      </aside>
      <div v-if="sidebarOpen" class="fixed inset-0 z-40 bg-black/60 lg:hidden" @click="sidebarOpen = false"></div>
    </div>
  </div>
</template>
