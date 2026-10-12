<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import CourseCard from '../../components/CourseCard.vue'
import Icon from '../../components/ui/Icon.vue'
import { api } from '../../lib/api'
import type { Category, CourseSummary } from '../../lib/types'

const route = useRoute()
const router = useRouter()
const courses = ref<CourseSummary[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
const category = ref(typeof route.query.categoria === 'string' ? route.query.categoria : '')

const load = async () => {
  loading.value = true
  try {
    const { data } = await api.get<{ courses: CourseSummary[] }>('/courses', {
      params: { ...(q.value ? { q: q.value } : {}), ...(category.value ? { category: category.value } : {}) },
    })
    courses.value = data.courses
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const { data } = await api.get<{ categories: Category[] }>('/categories')
  categories.value = data.categories
  await load()
})

const clearFilters = () => {
  q.value = ''
  category.value = ''
}

watch(category, () => {
  router.replace({ query: { ...(q.value ? { q: q.value } : {}), ...(category.value ? { categoria: category.value } : {}) } })
  load()
})
watchDebounced(q, () => {
  router.replace({ query: { ...(q.value ? { q: q.value } : {}), ...(category.value ? { categoria: category.value } : {}) } })
  load()
}, { debounce: 300 })
</script>

<template>
  <div class="max-w-[1400px] mx-auto px-4 md:px-16 py-12 md:py-16">
    <h1 class="text-4xl md:text-5xl font-display font-black tracking-tight mb-2">Cursos</h1>
    <p class="text-text-muted text-lg mb-10">Compre só o que você precisa. Acesso vitalício e certificado.</p>

    <div class="flex flex-col md:flex-row gap-4 md:items-center mb-10">
      <div class="relative md:max-w-sm w-full">
        <Icon name="search" :size="16" class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        <input v-model="q" type="search" placeholder="Buscar por tema ou título…" aria-label="Buscar cursos" class="field !pl-11">
      </div>
      <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
        <button
          class="px-4 py-2 rounded-full text-sm transition-colors focus-ring"
          :class="!category ? 'bg-accent-gold text-bg-base font-semibold' : 'glass-surface text-white/80 hover:text-white'"
          :aria-pressed="!category"
          @click="category = ''"
        >Todos</button>
        <button
          v-for="c in categories"
          :key="c.id"
          class="px-4 py-2 rounded-full text-sm transition-colors focus-ring"
          :class="category === c.slug ? 'bg-accent-gold text-bg-base font-semibold' : 'glass-surface text-white/80 hover:text-white'"
          :aria-pressed="category === c.slug"
          @click="category = c.slug"
        >{{ c.name }}</button>
      </div>
    </div>

    <h2 class="sr-only">Resultados</h2>
    <p class="sr-only" aria-live="polite">{{ loading ? 'Carregando cursos' : `${courses.length} cursos encontrados` }}</p>
    <div v-if="loading && !courses.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" aria-hidden="true">
      <div v-for="i in 4" :key="i" class="aspect-[16/10] sm:aspect-[4/5] rounded-[28px] bg-white/5 motion-safe:animate-pulse"></div>
    </div>
    <div v-else-if="!courses.length" class="py-20 text-center max-w-sm mx-auto">
      <span class="mx-auto mb-5 w-14 h-14 rounded-full glass-surface flex items-center justify-center text-white/60"><Icon name="search" /></span>
      <p class="font-semibold text-white mb-1">Nenhum curso encontrado</p>
      <p class="text-sm text-text-muted mb-6">Tente outro termo ou veja todas as categorias.</p>
      <button class="btn-glass" @click="clearFilters">Limpar filtros</button>
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 transition-opacity" :class="loading ? 'opacity-60' : ''">
      <CourseCard v-for="c in courses" :key="c.id" :course="c" layout="responsive" />
    </div>
  </div>
</template>
