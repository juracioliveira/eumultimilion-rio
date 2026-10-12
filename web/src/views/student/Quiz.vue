<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import GlassCard from '../../components/ui/GlassCard.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import { api, apiError } from '../../lib/api'
import Icon from '../../components/ui/Icon.vue'
import { setTitle } from '../../lib/title'

type Question = { id: string; type: 'single_choice' | 'multiple_choice'; questionText: string; options: { id: string; optionText: string }[] }
type QuizResponse = {
  quiz: { id: string; title: string; description: string | null; passingScorePercent: number; context: 'lesson' | 'course' }
  course: { title: string; slug: string }
  questions: Question[]
  attempts: { scorePercent: number; passed: boolean }[]
}
type Result = {
  scorePercent: number
  passed: boolean
  correctCount: number
  total: number
  results: Record<string, { correct: boolean; correctOptionIds: string[] }>
  certificateCode: string | null
}

const route = useRoute()
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const quiz = ref<QuizResponse['quiz'] | null>(null)
const course = ref<QuizResponse['course'] | null>(null)
const questions = ref<Question[]>([])
const bestScore = ref<number | null>(null)
const result = ref<Result | null>(null)
const animatedScore = ref(0)
const answers = ref<Record<string, string[]>>({})
let scoreAnimFrame: number | null = null

const resetAnswers = () => {
  answers.value = Object.fromEntries(questions.value.map((q) => [q.id, [] as string[]]))
}

onMounted(async () => {
  try {
    const { data } = await api.get<QuizResponse>(`/quizzes/${route.params.quizId}`)
    quiz.value = data.quiz
    setTitle(data.quiz.title)
    course.value = data.course
    questions.value = data.questions
    bestScore.value = data.attempts.length ? Math.max(...data.attempts.map((a) => a.scorePercent)) : null
    resetAnswers()
  } catch (e) {
    error.value = apiError(e, 'Quiz não encontrado.')
  } finally {
    loading.value = false
  }
})

const toggleOption = (questionId: string, optionId: string, isMultiple: boolean) => {
  const current = answers.value[questionId] ?? []
  if (isMultiple) {
    answers.value[questionId] = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]
  } else {
    answers.value[questionId] = [optionId]
  }
}

const answeredCount = computed(() => questions.value.filter((q) => (answers.value[q.id] ?? []).length > 0).length)

/** Estilo de cada alternativa: seleção durante o quiz; certo/errado na revisão. */
const optionClass = (q: Question, optionId: string) => {
  const selected = answers.value[q.id]?.includes(optionId)
  if (result.value) {
    const correct = result.value.results[q.id]?.correctOptionIds.includes(optionId)
    if (correct) return 'border-accent-emerald/50 bg-accent-emerald/10'
    if (selected) return 'border-red-400/40 bg-red-500/10'
    return 'border-white/5 opacity-60'
  }
  return selected ? 'border-accent-gold/50 bg-accent-gold/[0.08] cursor-pointer' : 'border-white/10 hover:border-white/25 hover:bg-white/[0.04] cursor-pointer'
}

const areAllAnswered = computed(() => questions.value.length > 0 && questions.value.every((q) => (answers.value[q.id] ?? []).length > 0))

const animateScore = (target: number) => {
  const duration = 1200
  const start = performance.now()
  const tick = (now: number) => {
    const progress = Math.min((now - start) / duration, 1)
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
    animatedScore.value = Math.round(eased * target)
    if (progress < 1) scoreAnimFrame = requestAnimationFrame(tick)
  }
  scoreAnimFrame = requestAnimationFrame(tick)
}

// Partículas de comemoração (só quando aprovado — movimento em resposta à ação)
const particles = ref<Array<{ id: number; x: number; y: number; size: number; delay: number; color: string }>>([])
const spawnParticles = () => {
  const colors = ['#C6A15B', '#2E6F5E', '#ffffff', '#F6F4EE']
  particles.value = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 6 + 3,
    delay: Math.random() * 800,
    color: colors[i % colors.length]!,
  }))
}

const submitQuiz = async () => {
  if (!quiz.value) return
  submitting.value = true
  error.value = ''
  try {
    const { data: attempt } = await api.post<{ attemptId: string }>(`/quizzes/${quiz.value.id}/attempts`, {})
    const { data } = await api.post<Result>(`/quizzes/attempts/${attempt.attemptId}/submit`, {
      answers: questions.value.map((q) => ({ questionId: q.id, selectedOptionIds: answers.value[q.id] ?? [] })),
    })
    result.value = data
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    bestScore.value = Math.max(bestScore.value ?? 0, data.scorePercent)
    setTimeout(() => {
      animateScore(data.scorePercent)
      if (data.passed) spawnParticles()
    }, 300)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    submitting.value = false
  }
}

const resetQuiz = () => {
  result.value = null
  animatedScore.value = 0
  particles.value = []
  resetAnswers()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onUnmounted(() => {
  if (scoreAnimFrame) cancelAnimationFrame(scoreAnimFrame)
})
</script>

<template>
  <div class="min-h-screen relative px-4 md:px-8 py-10 md:py-14 pb-32">
    <div class="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <img src="/assets/hero_premium_bg_1788306655617.jpg" alt="" class="w-full h-full object-cover opacity-15">
      <div class="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/90 to-bg-base/60"></div>
    </div>

    <!-- carregando -->
    <div v-if="loading" class="max-w-3xl mx-auto space-y-6" aria-busy="true">
      <SkeletonLoader variant="text" :lines="1" width="60%" />
      <GlassCard v-for="i in 2" :key="i" padding="lg">
        <SkeletonLoader variant="text" :lines="2" />
        <div class="mt-6 space-y-3"><div v-for="j in 3" :key="j" class="skeleton-shimmer h-14 rounded-xl"></div></div>
      </GlassCard>
    </div>

    <div v-else-if="error && !quiz" class="max-w-md mx-auto text-center glass-surface rounded-[28px] p-10">
      <p class="text-red-300">{{ error }}</p>
      <RouterLink to="/my-courses" class="btn-glass mt-6">Voltar</RouterLink>
    </div>

    <div v-else-if="quiz" class="max-w-3xl mx-auto">
      <RouterLink v-if="course" :to="`/course/${course.slug}`" class="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-white rounded focus-ring mb-6">
        <Icon name="arrow-left" :size="16" /> {{ course.title }}
      </RouterLink>

      <!-- resultado -->
      <Transition name="quiz-slide" mode="out-in">
        <GlassCard v-if="result" key="result" padding="none" class="relative overflow-hidden text-center mb-10 result-appear">
          <div v-if="result.passed" class="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div
              v-for="p in particles"
              :key="p.id"
              class="absolute rounded-full motion-safe:animate-[particle-float_2.5s_ease-out_forwards]"
              :style="{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, backgroundColor: p.color, animationDelay: `${p.delay}ms`, opacity: 0 }"
            ></div>
          </div>
          <div class="h-1 w-full" :class="result.passed ? 'bg-accent-emerald' : 'bg-red-500/80'"></div>
          <div class="p-8 md:p-10 relative" role="status" aria-live="polite">
            <div class="w-28 h-28 mx-auto relative mb-6">
              <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="7" />
                <circle v-if="animatedScore > 0" cx="50" cy="50" r="42" fill="none" :stroke="result.passed ? '#2E6F5E' : '#ef4444'" stroke-width="7" stroke-linecap="round" :stroke-dasharray="`${(animatedScore / 100) * 263.9} 263.9`" />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-3xl font-display font-black tabular-nums">{{ animatedScore }}%</span>
            </div>
            <h1 class="text-3xl font-display font-black mb-2" :class="result.passed ? 'text-emerald-soft' : 'text-red-300'">
              {{ result.passed ? 'Aprovado!' : 'Quase lá' }}
            </h1>
            <p class="text-white/75 max-w-md mx-auto">
              Você acertou {{ result.correctCount }} de {{ result.total }}.
              {{ result.passed ? 'Excelente trabalho!' : `A nota mínima é ${quiz.passingScorePercent}%. Revise as respostas abaixo e tente de novo.` }}
            </p>
            <div class="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <button v-if="!result.passed" class="btn-gold" @click="resetQuiz">Tentar novamente</button>
              <RouterLink v-if="result.certificateCode" :to="`/certificados/${result.certificateCode}`" class="btn-gold"><Icon name="award" :size="16" /> Ver meu certificado</RouterLink>
              <RouterLink :to="course ? `/course/${course.slug}` : '/my-courses'" :class="result.passed && !result.certificateCode ? 'btn-gold' : 'btn-glass'">Voltar ao curso</RouterLink>
            </div>
          </div>
        </GlassCard>

        <header v-else key="intro" class="mb-8">
          <p v-if="!/^(prova final|quiz)/i.test(quiz.title)" class="text-sm font-semibold text-accent-gold mb-2">{{ quiz.context === 'course' ? 'Prova final' : 'Quiz da aula' }}</p>
          <h1 class="text-3xl md:text-4xl font-display font-black leading-tight text-balance">{{ quiz.title }}</h1>
          <p v-if="quiz.description" class="text-white/70 mt-3 leading-relaxed">{{ quiz.description }}</p>
          <p class="text-sm text-text-muted mt-3">
            {{ questions.length }} {{ questions.length === 1 ? 'pergunta' : 'perguntas' }} · nota mínima {{ quiz.passingScorePercent }}%<template v-if="bestScore !== null"> · sua melhor nota: {{ bestScore }}%</template>
          </p>
        </header>
      </Transition>

      <h2 v-if="result" class="text-xl font-display font-bold mb-4">Revisão das respostas</h2>

      <ol class="space-y-5">
        <li v-for="(q, index) in questions" :key="q.id">
          <fieldset
            class="rounded-[24px] border p-5 md:p-7 transition-colors"
            :class="result ? (result.results[q.id]?.correct ? 'border-accent-emerald/40 bg-accent-emerald/[0.05]' : 'border-red-400/30 bg-red-500/[0.04]') : 'border-white/10 bg-white/[0.03]'"
            :disabled="!!result"
          >
            <legend class="sr-only">Pergunta {{ index + 1 }}</legend>
            <div class="flex items-start gap-4 mb-5">
              <span
                class="flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-sm font-bold"
                :class="result ? (result.results[q.id]?.correct ? 'bg-accent-emerald text-white' : 'bg-red-500/80 text-white') : 'bg-accent-gold/15 text-accent-gold'"
              >
                <Icon v-if="result" :name="result.results[q.id]?.correct ? 'check' : 'x'" :size="16" />
                <template v-else>{{ index + 1 }}</template>
              </span>
              <div>
                <p class="font-display font-bold text-lg md:text-xl text-white leading-snug">{{ q.questionText }}</p>
                <p v-if="q.type === 'multiple_choice'" class="text-sm text-text-muted mt-1">Marque todas as corretas</p>
              </div>
            </div>

            <div class="space-y-2.5 md:pl-12" :role="q.type === 'multiple_choice' ? 'group' : 'radiogroup'">
              <label
                v-for="opt in q.options"
                :key="opt.id"
                class="option flex items-center gap-3.5 p-3.5 md:p-4 rounded-xl border transition-all"
                :class="optionClass(q, opt.id)"
              >
                <input
                  :type="q.type === 'multiple_choice' ? 'checkbox' : 'radio'"
                  :name="`q_${q.id}`"
                  :value="opt.id"
                  :checked="answers[q.id]?.includes(opt.id)"
                  class="sr-only peer"
                  @change="toggleOption(q.id, opt.id, q.type === 'multiple_choice')"
                >
                <span
                  class="indicator w-5 h-5 shrink-0 flex items-center justify-center border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent-gold peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-base"
                  :class="[q.type === 'multiple_choice' ? 'rounded-md' : 'rounded-full', answers[q.id]?.includes(opt.id) ? 'border-accent-gold bg-accent-gold text-bg-base' : 'border-white/30']"
                  aria-hidden="true"
                >
                  <Icon v-if="answers[q.id]?.includes(opt.id) && q.type === 'multiple_choice'" name="check" :size="12" />
                  <span v-else-if="answers[q.id]?.includes(opt.id)" class="w-2 h-2 rounded-full bg-bg-base"></span>
                </span>
                <span class="flex-1 text-white/90 leading-relaxed">{{ opt.optionText }}</span>
                <span v-if="result && result.results[q.id]?.correctOptionIds.includes(opt.id)" class="text-xs font-semibold text-emerald-soft flex items-center gap-1"><Icon name="check" :size="14" />Correta</span>
                <span v-else-if="result && answers[q.id]?.includes(opt.id)" class="text-xs font-semibold text-red-300">Sua resposta</span>
              </label>
            </div>
          </fieldset>
        </li>
      </ol>
    </div>

    <!-- barra de envio fixa -->
    <div v-if="quiz && !result && !loading" class="fixed bottom-0 inset-x-0 z-30 glass-surface !bg-[#0b0e16]/85 !border-x-0 !border-b-0">
      <div class="max-w-3xl mx-auto px-4 md:px-8 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-4">
        <div class="flex-1 min-w-0">
          <p class="text-sm text-white/80 tabular-nums">{{ answeredCount }} de {{ questions.length }} respondidas</p>
          <div class="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden max-w-xs">
            <div class="h-full bg-accent-gold rounded-full transition-[width] duration-300" :style="{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }"></div>
          </div>
        </div>
        <p v-if="error" role="alert" class="hidden sm:block text-sm text-red-300">{{ error }}</p>
        <button class="btn-gold shrink-0" :disabled="submitting || !areAllAnswered" @click="submitQuiz">
          <Icon v-if="submitting" name="spinner" :size="16" />
          {{ submitting ? 'Corrigindo…' : 'Enviar respostas' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-in-up {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@media (prefers-reduced-motion: reduce) {
  .fade-in-up {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Quiz slide transition */
.quiz-slide-enter-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.quiz-slide-leave-active {
  transition: all 0.3s ease;
}
.quiz-slide-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.98);
}
.quiz-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.98);
}

/* Result card entrance */
.result-appear {
  animation: resultAppear 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes resultAppear {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Icon bounce-in */
.result-icon-appear {
  animation: iconBounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
}
@keyframes iconBounce {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Celebration particles */
@keyframes particle-float {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0);
  }
  20% {
    opacity: 1;
    transform: translateY(-10px) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-120px) scale(0.3) rotate(180deg);
  }
}

/* Skeleton inside quiz loading */
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.08) 40%,
    rgba(255, 255, 255, 0.04) 80%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .result-appear,
  .result-icon-appear {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .skeleton-shimmer {
    animation: none;
    background: rgba(255, 255, 255, 0.06);
  }
}
</style>

