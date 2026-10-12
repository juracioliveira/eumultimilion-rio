<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import GlassCard from '../../components/ui/GlassCard.vue'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'

type Student = { id: string; name: string; email: string; role: string; createdAt: string; courses: number; certificates: number }

const students = ref<Student[]>([])
const q = ref('')
const loading = ref(true)

const load = async () => {
  loading.value = true
  try {
    students.value = (await api.get<{ students: Student[] }>('/admin/students', { params: q.value ? { q: q.value } : {} })).data.students
  } finally {
    loading.value = false
  }
}
onMounted(load)
watchDebounced(q, load, { debounce: 300 })
</script>

<template>
  <div>
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <h1 class="text-3xl font-display font-black">Alunos</h1>
      <input v-model="q" type="search" class="field md:w-72" placeholder="Buscar por nome ou e-mail" aria-label="Buscar alunos">
    </div>
    <GlassCard padding="none" class="!rounded-2xl">
      <p v-if="!loading && !students.length" class="p-6 text-text-muted">Nenhum usuário encontrado.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-text-muted">
            <tr class="border-b border-white/10">
              <th class="px-5 py-3 font-medium">Nome</th>
              <th class="px-5 py-3 font-medium">Cursos</th>
              <th class="px-5 py-3 font-medium">Certificados</th>
              <th class="px-5 py-3 font-medium">Cadastro</th>
            </tr>
          </thead>
          <tbody :class="loading ? 'opacity-50' : ''">
            <tr v-for="s in students" :key="s.id" class="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
              <td class="px-5 py-3">
                <RouterLink :to="`/admin/alunos/${s.id}`" class="text-white hover:text-accent-gold font-medium">{{ s.name }}</RouterLink>
                <span v-if="s.role === 'admin'" class="ml-2 text-[11px] text-accent-gold">admin</span>
                <div class="text-xs text-text-muted">{{ s.email }}</div>
              </td>
              <td class="px-5 py-3 tabular-nums">{{ s.courses }}</td>
              <td class="px-5 py-3 tabular-nums">{{ s.certificates }}</td>
              <td class="px-5 py-3 text-text-muted whitespace-nowrap">{{ formatDate(s.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </GlassCard>
  </div>
</template>
