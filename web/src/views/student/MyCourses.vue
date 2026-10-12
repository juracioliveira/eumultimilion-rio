<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import GlassCard from '../../components/ui/GlassCard.vue'
import { api } from '../../lib/api'
import { formatClock } from '../../lib/format'
import { useAuthStore } from '../../stores/auth'

type MyCourse = {
  id: string
  title: string
  slug: string
  thumbnailUrl: string | null
  progress: { total: number; completed: number; percent: number; nextLessonId: string | null }
  certificateCode: string | null
}
type HistoryItem = {
  lessonId: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number | null
  watchedSeconds: number
  courseTitle: string
  courseThumbnailUrl: string | null
}

const auth = useAuthStore()
const courses = ref<MyCourse[]>([])
const history = ref<HistoryItem[]>([])
const loading = ref(true)

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

const watchedPercent = (item: HistoryItem) =>
  item.durationSeconds ? Math.min(100, Math.round((item.watchedSeconds / item.durationSeconds) * 100)) : 0
</script>

<template>
  <div class="min-h-screen bg-bg-base text-text-primary px-4 md:px-8 py-12 md:py-16 pb-24">
    <div class="max-w-7xl mx-auto">
      <div class="mb-12">
        <h1 class="text-4xl md:text-5xl font-display font-black tracking-tight mb-2">Olá, {{ auth.user?.name.split(' ')[0] }}</h1>
        <p class="text-text-muted text-lg font-light">Seu progresso e conquistas em um só lugar.</p>
      </div>

      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div v-for="i in 4" :key="i" class="aspect-[4/5] rounded-[28px] bg-white/5 motion-safe:animate-pulse"></div>
      </div>

      <template v-else>
        <section v-if="history.length" class="mb-16">
          <h2 class="text-2xl font-display font-bold mb-6 text-white">Continuar assistindo</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <RouterLink v-for="item in history" :key="item.lessonId" :to="`/aula/${item.lessonId}`" class="block group outline-none focus-ring rounded-[28px]">
              <GlassCard padding="none" interactive class="h-full bg-black overflow-hidden relative">
                <div class="aspect-video w-full relative overflow-hidden">
                  <img v-if="item.thumbnailUrl || item.courseThumbnailUrl" :src="(item.thumbnailUrl || item.courseThumbnailUrl)!" :alt="item.courseTitle" class="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500">
                  <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div class="w-14 h-14 rounded-full glass-surface flex items-center justify-center text-white">
                      <svg class="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                  <div v-if="item.durationSeconds" class="absolute bottom-3 right-3 glass-surface px-2 py-1 rounded text-xs font-bold text-white">
                    {{ formatClock(Math.max(0, item.durationSeconds - item.watchedSeconds)) }} restantes
                  </div>
                </div>
                <div class="p-6">
                  <div class="text-xs font-semibold text-accent-gold mb-2">{{ item.courseTitle }}</div>
                  <h3 class="font-display font-bold text-xl leading-tight mb-4 text-white">{{ item.title }}</h3>
                  <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full bg-accent-emerald" :style="{ width: `${watchedPercent(item)}%` }"></div>
                  </div>
                </div>
              </GlassCard>
            </RouterLink>
          </div>
        </section>

        <section>
          <h2 class="text-2xl font-display font-bold mb-6 text-white">Meus cursos</h2>
          <div v-if="!courses.length" class="glass-surface p-12 rounded-[28px] text-center max-w-2xl mx-auto">
            <p class="text-text-muted text-lg">Você ainda não tem nenhum curso.</p>
            <RouterLink to="/cursos" class="inline-block mt-4 text-accent-gold font-bold hover:text-white transition-colors">Explorar catálogo</RouterLink>
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div v-for="course in courses" :key="course.id" class="flex flex-col gap-3">
              <RouterLink :to="course.progress.nextLessonId ? `/aula/${course.progress.nextLessonId}` : `/course/${course.slug}`" class="block group outline-none focus-ring rounded-[28px]">
                <GlassCard padding="none" interactive class="h-full bg-black">
                  <div class="relative w-full aspect-[4/5] overflow-hidden">
                    <img v-if="course.thumbnailUrl" :src="course.thumbnailUrl" :alt="course.title" class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 opacity-70 group-hover:opacity-90">
                    <div class="absolute inset-0 bg-gradient-to-t from-bg-base/90 via-bg-base/30 to-transparent"></div>
                    <div v-if="course.certificateCode" class="absolute top-4 left-4">
                      <span class="glass-surface px-3 py-1.5 rounded-lg text-xs font-bold text-accent-emerald flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Certificado emitido
                      </span>
                    </div>
                    <div class="absolute inset-x-0 bottom-0 p-6 flex flex-col">
                      <h3 class="font-display font-bold text-2xl leading-tight mb-3 text-white">{{ course.title }}</h3>
                      <div class="w-full flex items-center gap-3">
                        <div class="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                          <div class="h-full bg-accent-emerald" :style="{ width: `${course.progress.percent}%` }"></div>
                        </div>
                        <span class="text-xs font-bold text-text-muted">{{ course.progress.percent }}%</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </RouterLink>
              <RouterLink v-if="course.certificateCode" :to="`/certificados/${course.certificateCode}`" class="text-sm text-accent-gold font-semibold hover:text-white px-2">Ver certificado</RouterLink>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
