<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import GlassCard from '../../components/ui/GlassCard.vue'
import Icon from '../../components/ui/Icon.vue'
import { api, apiError } from '../../lib/api'
import { formatPrice } from '../../lib/format'

type AdminCourse = {
  id: string; title: string; slug: string; thumbnailUrl: string | null; priceCents: number; published: boolean
  featured: boolean; categoryName: string | null; students: number; lessonCount: number
}

const router = useRouter()
const courses = ref<AdminCourse[]>([])
const loading = ref(true)
const newTitle = ref('')
const creating = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    courses.value = (await api.get<{ courses: AdminCourse[] }>('/admin/courses')).data.courses
  } finally {
    loading.value = false
  }
})

const create = async () => {
  if (!newTitle.value.trim()) return
  creating.value = true
  error.value = ''
  try {
    const { data } = await api.post<{ course: { id: string } }>('/admin/courses', { title: newTitle.value, priceCents: 0 })
    router.push(`/admin/cursos/${data.course.id}`)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <h1 class="text-3xl font-display font-black">Cursos</h1>
      <form class="flex gap-2 w-full md:w-auto" @submit.prevent="create">
        <input v-model="newTitle" class="field md:w-72" placeholder="Título do novo curso" aria-label="Título do novo curso" required>
        <button class="btn-gold shrink-0" :disabled="creating"><Icon :name="creating ? 'spinner' : 'plus'" :size="16" /> Criar curso</button>
      </form>
    </div>
    <p v-if="error" role="alert" class="text-sm text-red-300 mb-4">{{ error }}</p>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 rounded-2xl bg-white/5 motion-safe:animate-pulse"></div>
    </div>
    <p v-else-if="!courses.length" class="text-text-muted">Nenhum curso ainda. Crie o primeiro acima.</p>
    <ul v-else class="space-y-3">
      <li v-for="c in courses" :key="c.id">
        <RouterLink :to="`/admin/cursos/${c.id}`" class="block rounded-2xl focus-ring">
          <GlassCard padding="sm" class="flex items-center gap-4 hover:bg-white/[0.06] transition-colors !rounded-2xl">
            <img v-if="c.thumbnailUrl" :src="c.thumbnailUrl" alt="" class="w-20 h-14 rounded-lg object-cover shrink-0">
            <div v-else class="w-20 h-14 rounded-lg bg-white/5 shrink-0"></div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 min-w-0">
                <p class="font-semibold text-white truncate">{{ c.title }}</p>
                <span v-if="c.featured" class="shrink-0 text-[11px] text-accent-gold">Destaque</span>
              </div>
              <p class="text-xs text-text-muted mt-0.5">
                {{ c.categoryName ?? 'Sem categoria' }} · {{ c.lessonCount }} aulas · {{ c.students }} alunos · {{ formatPrice(c.priceCents) }}
              </p>
              <span class="sm:hidden inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md" :class="c.published ? 'bg-accent-emerald/20 text-emerald-soft' : 'bg-white/10 text-white/60'">
                {{ c.published ? 'Publicado' : 'Rascunho' }}
              </span>
            </div>
            <span class="hidden sm:inline text-xs font-semibold px-2.5 py-1 rounded-md shrink-0" :class="c.published ? 'bg-accent-emerald/20 text-emerald-soft' : 'bg-white/10 text-white/60'">
              {{ c.published ? 'Publicado' : 'Rascunho' }}
            </span>
            <Icon name="chevron-right" :size="18" class="text-white/30 shrink-0" />
          </GlassCard>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
