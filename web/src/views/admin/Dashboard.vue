<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import GlassCard from '../../components/ui/GlassCard.vue'
import { api } from '../../lib/api'
import { formatDate, formatPrice } from '../../lib/format'

type Stats = { students: number; courses: number; publishedCourses: number; sales: number; revenueCents: number; completions: number; certificates: number }
type Purchase = { id: string; status: string; amountCents: number; createdAt: string; studentName: string; studentEmail: string; courseTitle: string }

const stats = ref<Stats | null>(null)
const recent = ref<Purchase[]>([])

const statusLabel: Record<string, string> = { paid: 'Pago', pending: 'Pendente', refunded: 'Reembolsado', canceled: 'Cancelado' }

onMounted(async () => {
  const { data } = await api.get<{ stats: Stats; recentPurchases: Purchase[] }>('/admin/stats')
  stats.value = data.stats
  recent.value = data.recentPurchases
})
</script>

<template>
  <div>
    <h1 class="text-3xl font-display font-black mb-8">Visão geral</h1>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      <GlassCard v-for="item in [
        { label: 'Alunos', value: stats?.students },
        { label: 'Receita', value: stats ? formatPrice(stats.revenueCents).replace('Gratuito', 'R$ 0,00') : undefined },
        { label: 'Matrículas pagas', value: stats?.sales },
        { label: 'Certificados', value: stats?.certificates },
      ]" :key="item.label" padding="md">
        <p class="text-xs text-text-muted mb-2">{{ item.label }}</p>
        <p class="text-2xl font-display font-bold tabular-nums">
          <span v-if="item.value !== undefined">{{ item.value }}</span>
          <span v-else class="inline-block h-7 w-16 rounded bg-white/10 motion-safe:animate-pulse"></span>
        </p>
      </GlassCard>
    </div>
    <p v-if="stats" class="text-sm text-text-muted mb-10">
      {{ stats.publishedCourses }} de {{ stats.courses }} cursos publicados · {{ stats.completions }} conclusões de curso.
      <RouterLink to="/admin/cursos" class="text-accent-gold font-semibold hover:text-white">Gerenciar cursos</RouterLink>
    </p>

    <h2 class="text-xl font-display font-bold mb-4">Últimas compras e matrículas</h2>
    <GlassCard padding="none">
      <p v-if="!recent.length" class="p-6 text-text-muted">Nenhuma compra ainda.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-text-muted">
            <tr class="border-b border-white/10">
              <th class="px-5 py-3 font-medium">Aluno</th>
              <th class="px-5 py-3 font-medium">Curso</th>
              <th class="px-5 py-3 font-medium">Valor</th>
              <th class="px-5 py-3 font-medium">Status</th>
              <th class="px-5 py-3 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in recent" :key="p.id" class="border-b border-white/5 last:border-0">
              <td class="px-5 py-3"><div class="text-white">{{ p.studentName }}</div><div class="text-xs text-text-muted">{{ p.studentEmail }}</div></td>
              <td class="px-5 py-3">{{ p.courseTitle }}</td>
              <td class="px-5 py-3 tabular-nums">{{ formatPrice(p.amountCents) }}</td>
              <td class="px-5 py-3">
                <span class="text-xs font-semibold px-2 py-1 rounded-md" :class="p.status === 'paid' ? 'bg-accent-emerald/20 text-accent-emerald' : 'bg-white/10 text-white/70'">{{ statusLabel[p.status] ?? p.status }}</span>
              </td>
              <td class="px-5 py-3 text-text-muted whitespace-nowrap">{{ formatDate(p.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </GlassCard>
  </div>
</template>
