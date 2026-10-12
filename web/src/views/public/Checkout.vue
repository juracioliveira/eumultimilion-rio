<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import GlassCard from '../../components/ui/GlassCard.vue'
import { api, apiError } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import type { CourseDetail } from '../../lib/types'

type CheckoutResponse = { status: 'enrolled' } | { status: 'pending'; checkoutUrl: string | null; simulated?: boolean }

const route = useRoute()
const router = useRouter()
const data = ref<CourseDetail | null>(null)
const step = ref<'review' | 'waiting' | 'done'>('review')
const loading = ref(false)
const simulated = ref(false)
const error = ref('')
let poll: number | undefined

onMounted(async () => {
  try {
    const res = await api.get<CourseDetail>(`/courses/${route.params.slug}`)
    data.value = res.data
    if (res.data.access.hasAccess) step.value = 'done'
  } catch (e) {
    error.value = apiError(e, 'Curso não encontrado.')
  }
})
onUnmounted(() => clearInterval(poll))

/** Após abrir o checkout da Cakto, consulta até o webhook liberar o acesso. */
const waitForPayment = () => {
  step.value = 'waiting'
  clearInterval(poll)
  let tries = 0
  poll = window.setInterval(async () => {
    tries++
    const { data: s } = await api.get<{ hasAccess: boolean }>(`/checkout/course/${data.value!.course.id}/status`)
    if (s.hasAccess) {
      clearInterval(poll)
      step.value = 'done'
    } else if (tries > 120) {
      clearInterval(poll) // ~10 min: para de consultar; o aluno pode recarregar depois
    }
  }, 5000)
}

const pay = async () => {
  if (!data.value) return
  loading.value = true
  error.value = ''
  try {
    const { data: res } = await api.post<CheckoutResponse>(`/checkout/course/${data.value.course.id}`, {})
    if (res.status === 'enrolled') step.value = 'done'
    else if (res.checkoutUrl) {
      window.open(res.checkoutUrl, '_blank', 'noopener')
      waitForPayment()
    } else if (res.simulated) simulated.value = true
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}

const simulate = async () => {
  loading.value = true
  try {
    await api.post(`/checkout/course/${data.value!.course.id}/simulate`, {})
    step.value = 'done'
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}

const start = () => {
  const next = data.value?.progress.nextLessonId ?? data.value?.modules[0]?.lessons[0]?.id
  router.push(next ? `/aula/${next}` : `/course/${route.params.slug}`)
}
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] bg-bg-base relative flex flex-col items-center justify-center px-4 py-16">
    <div class="absolute inset-0 w-full h-full overflow-hidden">
      <img :src="data?.course.thumbnailUrl || '/assets/hero_premium_bg_1788306655617.jpg'" alt="" class="w-full h-full object-cover opacity-25">
      <div class="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/85 to-bg-base/40"></div>
    </div>

    <div class="relative z-10 w-full max-w-md">
      <GlassCard padding="lg" class="text-center">
        <p v-if="error && !data" class="text-red-300">{{ error }}</p>

        <div v-else-if="step === 'review' && data" class="flex flex-col items-center">
          <h1 class="text-3xl font-display font-bold mb-3 text-white">{{ data.course.title }}</h1>
          <p class="text-text-muted mb-8 leading-relaxed">
            Acesso vitalício às {{ data.stats.lessonCount }} aulas, materiais e certificado de conclusão.
          </p>
          <div class="w-full flex justify-between items-center bg-black/40 border border-white/5 p-5 rounded-2xl mb-8">
            <span class="font-medium text-text-muted">Total</span>
            <span class="text-2xl font-bold text-white">{{ formatPrice(data.course.priceCents) }}</span>
          </div>

          <template v-if="!simulated">
            <button class="btn-gold w-full !py-4 !text-lg" :disabled="loading" @click="pay">
              {{ loading ? 'Abrindo pagamento…' : 'Pagar com Cakto' }}
            </button>
            <p class="text-xs text-text-muted mt-4">O pagamento abre em uma nova aba. Use o mesmo e-mail da sua conta.</p>
          </template>
          <template v-else>
            <p class="text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
              Ambiente de desenvolvimento: este curso não tem checkout da Cakto configurado.
            </p>
            <button class="btn-gold w-full !py-4" :disabled="loading" @click="simulate">Simular pagamento aprovado</button>
          </template>
          <p v-if="error" role="alert" class="text-sm text-red-300 mt-4">{{ error }}</p>

          <RouterLink :to="`/course/${route.params.slug}`" class="mt-6 text-sm font-medium text-text-muted hover:text-white transition-colors focus-ring rounded px-2 py-1">
            Voltar ao curso
          </RouterLink>
        </div>

        <div v-else-if="step === 'waiting'" class="flex flex-col items-center py-6" aria-live="polite">
          <svg class="animate-spin h-10 w-10 text-accent-gold mb-6" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
          <h2 class="text-2xl font-display font-bold mb-3 text-white">Aguardando confirmação</h2>
          <p class="text-text-muted">Conclua o pagamento na aba da Cakto. Assim que for aprovado, seu acesso é liberado aqui automaticamente.</p>
          <button class="btn-glass mt-6" @click="pay">Abrir o pagamento novamente</button>
        </div>

        <div v-else-if="step === 'done'" class="flex flex-col items-center py-6" aria-live="polite">
          <div class="w-20 h-20 bg-accent-emerald/20 text-accent-emerald flex items-center justify-center rounded-full mb-6">
            <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 class="text-3xl font-display font-bold mb-4 text-white">Acesso liberado!</h2>
          <p class="text-text-muted mb-8">Bons estudos. Seu progresso fica salvo automaticamente.</p>
          <button class="btn-gold" @click="start">Começar agora</button>
        </div>
      </GlassCard>
    </div>
  </div>
</template>
