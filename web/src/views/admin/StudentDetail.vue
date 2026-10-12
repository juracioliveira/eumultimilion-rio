<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import GlassCard from '../../components/ui/GlassCard.vue'
import { api, apiError } from '../../lib/api'
import { formatDate, formatPrice } from '../../lib/format'
import { useAuthStore } from '../../stores/auth'
import { useUiStore } from '../../stores/ui'

type Detail = {
  student: { id: string; name: string; email: string; role: 'admin' | 'student'; createdAt: string }
  enrollments: { courseId: string; title: string; status: string; amountCents: number; purchasedAt: string | null; progress: { percent: number; completed: number; total: number } }[]
  certificates: { title: string; code: string; issuedAt: string }[]
}

const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()
const data = ref<Detail | null>(null)
const courses = ref<{ id: string; title: string }[]>([])
const grantCourseId = ref('')
const id = route.params.id as string

const statusLabel: Record<string, string> = { paid: 'Ativo', pending: 'Aguardando pagamento', refunded: 'Reembolsado', canceled: 'Cancelado' }

const load = async () => {
  data.value = (await api.get<Detail>(`/admin/students/${id}`)).data
}
onMounted(async () => {
  await load()
  courses.value = (await api.get<{ courses: { id: string; title: string }[] }>('/admin/courses')).data.courses
})

const available = computed(() => courses.value.filter((c) => !data.value?.enrollments.some((e) => e.courseId === c.id && e.status === 'paid')))

const act = async (fn: () => Promise<unknown>, okMsg: string) => {
  try {
    await fn()
    await load()
    ui.toast(okMsg)
  } catch (e) {
    ui.toast(apiError(e), 'error')
  }
}

const grant = () =>
  grantCourseId.value && act(() => api.post(`/admin/students/${id}/grant`, { courseId: grantCourseId.value }).then(() => (grantCourseId.value = '')), 'Acesso liberado')

const revoke = async (courseId: string, title: string) => {
  const ok = await ui.confirm({ title: `Remover o acesso a "${title}"?`, message: 'O progresso fica guardado caso o acesso seja liberado de novo.', confirmLabel: 'Remover acesso', danger: true })
  if (ok) act(() => api.post(`/admin/students/${id}/revoke`, { courseId }), 'Acesso removido')
}

const toggleRole = async () => {
  const role = data.value?.student.role === 'admin' ? 'student' : 'admin'
  const ok = await ui.confirm(
    role === 'admin'
      ? { title: 'Tornar administrador?', message: 'Esta pessoa poderá editar cursos, ver alunos e vendas.', confirmLabel: 'Tornar admin' }
      : { title: 'Remover acesso de admin?', confirmLabel: 'Remover', danger: true },
  )
  if (ok) act(() => api.post(`/admin/students/${id}/role`, { role }), role === 'admin' ? 'Agora é administrador' : 'Acesso de admin removido')
}
</script>

<template>
  <div v-if="!data" class="h-40 rounded-2xl bg-white/5 motion-safe:animate-pulse"></div>
  <div v-else class="space-y-8 pb-16">
    <div>
      <RouterLink to="/admin/alunos" class="text-sm text-text-muted hover:text-white">Alunos</RouterLink>
      <h1 class="text-3xl font-display font-black mt-1">{{ data.student.name }}</h1>
      <p class="text-text-muted">{{ data.student.email }} · desde {{ formatDate(data.student.createdAt) }}</p>
    </div>

    <section>
      <h2 class="text-lg font-display font-bold mb-4">Cursos</h2>
      <GlassCard padding="none" class="!rounded-2xl">
        <p v-if="!data.enrollments.length" class="p-5 text-text-muted">Nenhuma matrícula.</p>
        <ul>
          <li v-for="e in data.enrollments" :key="e.courseId" class="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-white/5 last:border-0">
            <div class="flex-1 min-w-0">
              <p class="font-medium text-white">{{ e.title }}</p>
              <p class="text-xs text-text-muted">{{ statusLabel[e.status] ?? e.status }} · {{ formatPrice(e.amountCents) }}<template v-if="e.purchasedAt"> · {{ formatDate(e.purchasedAt) }}</template></p>
            </div>
            <div class="flex items-center gap-3 sm:w-48">
              <div class="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden"><div class="h-full bg-accent-emerald" :style="{ width: `${e.progress.percent}%` }"></div></div>
              <span class="text-xs tabular-nums w-10 text-right">{{ e.progress.percent }}%</span>
            </div>
            <button v-if="e.status === 'paid'" class="btn-danger !py-1.5 !px-3 !text-xs" @click="revoke(e.courseId, e.title)">Remover acesso</button>
          </li>
        </ul>
      </GlassCard>
      <form class="flex flex-col sm:flex-row gap-2 mt-4" @submit.prevent="grant">
        <select v-model="grantCourseId" class="field sm:max-w-sm" aria-label="Curso para liberar">
          <option value="" disabled>Escolha um curso para liberar</option>
          <option v-for="c in available" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>
        <button class="btn-glass shrink-0" :disabled="!grantCourseId">Liberar acesso (cortesia)</button>
      </form>
    </section>

    <section>
      <h2 class="text-lg font-display font-bold mb-4">Certificados</h2>
      <p v-if="!data.certificates.length" class="text-text-muted">Nenhum certificado emitido.</p>
      <ul class="space-y-2">
        <li v-for="c in data.certificates" :key="c.code" class="text-sm">
          <RouterLink :to="`/certificados/${c.code}`" class="text-accent-gold hover:text-white">{{ c.title }}</RouterLink>
          <span class="text-text-muted"> · {{ formatDate(c.issuedAt) }} · {{ c.code }}</span>
        </li>
      </ul>
    </section>

    <section v-if="data.student.id !== auth.user?.id" class="pt-6 border-t border-white/10">
      <button class="btn-glass" @click="toggleRole">{{ data.student.role === 'admin' ? 'Remover acesso de admin' : 'Tornar administrador' }}</button>
    </section>
  </div>
</template>
