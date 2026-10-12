<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import GlassCard from '../../components/ui/GlassCard.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import { api, apiError } from '../../lib/api'

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
  <!-- Background behind glass -->
  <div class="min-h-screen bg-bg-base relative p-4 md:p-8 pt-24 pb-24">
    <!-- Base Layer: Opaque Image -->
    <div class="fixed inset-0 w-full h-full overflow-hidden">
      <img src="/assets/hero_premium_bg_1788306655617.jpg" alt="Background" class="w-full h-full object-cover opacity-20">
      <div class="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/90 to-transparent"></div>
    </div>

    <!-- Loading State with Skeletons -->
    <div class="relative z-10 max-w-3xl mx-auto pt-10" v-if="loading">
      <div class="mb-12 text-center space-y-4">
        <SkeletonLoader variant="text" :lines="1" width="60%" class="mx-auto" />
        <SkeletonLoader variant="text" :lines="2" />
      </div>
      <div class="space-y-8">
        <GlassCard v-for="i in 2" :key="i" padding="lg" class="shadow-xl">
          <div class="flex items-start gap-4 mb-6">
            <SkeletonLoader variant="circle" width="32px" height="32px" />
            <SkeletonLoader variant="text" :lines="2" width="90%" />
          </div>
          <div class="pl-12 space-y-3">
            <div v-for="j in 3" :key="j" class="skeleton-shimmer h-14 rounded-xl"></div>
          </div>
        </GlassCard>
      </div>
    </div>
    
    <!-- Quiz Questions -->
    <Transition name="quiz-slide" mode="out-in">
      <div class="relative z-10 max-w-md mx-auto text-center glass-surface rounded-[28px] p-10" v-if="error && !quiz" key="error">
        <p class="text-red-300">{{ error }}</p>
        <RouterLink to="/my-courses" class="btn-glass mt-6">Voltar</RouterLink>
      </div>
      <div class="relative z-10 max-w-3xl mx-auto fade-in-up" v-else-if="quiz && !result && !loading" key="questions">
        
        <div class="mb-12 text-center">
          <h1 class="text-4xl md:text-5xl font-display font-black mb-4 text-white">{{ quiz.title }}</h1>
          <p v-if="quiz.description" class="text-lg text-text-muted leading-relaxed">{{ quiz.description }}</p>
          <p class="text-sm text-text-muted mt-3">
            Nota mínima: {{ quiz.passingScorePercent }}%<template v-if="bestScore !== null"> · sua melhor nota: {{ bestScore }}%</template>
          </p>
        </div>

        <div class="space-y-8">
          <GlassCard 
            v-for="(q, index) in questions" :key="q.id" 
            padding="lg"
            class="shadow-xl"
          >
            <h3 class="font-display font-bold text-xl mb-6 flex items-start gap-4 text-white">
              <span class="flex items-center justify-center w-8 h-8 rounded-full bg-accent-gold/20 text-accent-gold shrink-0 text-sm mt-0.5">{{ index + 1 }}</span>
              <span>{{ q.questionText }}<span v-if="q.type === 'multiple_choice'" class="block text-sm font-normal text-text-muted mt-1">Marque todas as corretas</span></span>
            </h3>
            
            <div class="space-y-3 pl-12">
              <label 
                v-for="opt in q.options" :key="opt.id" 
                class="flex items-center space-x-4 cursor-pointer p-4 rounded-xl transition-all duration-200 border group"
                :class="answers[q.id]?.includes(opt.id) ? 'bg-white/10 border-accent-gold/30 scale-[1.01]' : 'hover:bg-white/5 border-white/5'"
              >
                <input 
                  :type="q.type === 'multiple_choice' ? 'checkbox' : 'radio'"
                  :name="`q_${q.id}`"
                  :value="opt.id"
                  :checked="answers[q.id]?.includes(opt.id)"
                  @change="toggleOption(q.id, opt.id, q.type === 'multiple_choice')"
                  class="w-5 h-5 text-accent-gold bg-black/50 border-white/20 focus-ring transition-colors cursor-pointer"
                >
                <span class="text-text-primary leading-relaxed group-hover:text-white transition-colors">{{ opt.optionText }}</span>
              </label>
            </div>
          </GlassCard>
        </div>

        <p v-if="error" role="alert" class="mt-8 text-center text-red-300">{{ error }}</p>
        <div class="mt-12 flex justify-center">
          <button 
            @click="submitQuiz" 
            :disabled="submitting || !areAllAnswered"
            class="bg-accent-gold text-bg-base px-12 py-4 rounded-full font-bold text-lg focus-ring hover:brightness-110 transition-all shadow-[0_0_30px_-10px_rgba(198,161,91,0.5)] disabled:opacity-50 flex items-center justify-center min-w-[280px]"
          >
            <template v-if="submitting">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-bg-base" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Corrigindo...
            </template>
            <template v-else-if="!areAllAnswered">
              Responda todas as questões
            </template>
            <template v-else>
              Finalizar Tentativa
            </template>
          </button>
        </div>
      </div>

      <!-- Result Modal Glass -->
      <div v-else-if="result" class="relative z-10 min-h-[70vh] flex items-center justify-center" key="result">
        <GlassCard padding="none" class="text-center max-w-xl w-full shadow-2xl relative overflow-hidden result-appear">
          
          <!-- Celebration Particles -->
          <div v-if="result.passed" class="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div 
              v-for="p in particles" 
              :key="p.id"
              class="absolute rounded-full motion-safe:animate-[particle-float_2.5s_ease-out_forwards]"
              :style="{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                animationDelay: `${p.delay}ms`,
                opacity: 0
              }"
            ></div>
          </div>
          
          <!-- Status color banner -->
          <div class="h-1 w-full absolute top-0 left-0 z-10" :class="result.passed ? 'bg-accent-emerald' : 'bg-red-500/80'"></div>

          <div class="p-12 relative z-10">
            <!-- Animated Icon -->
            <div 
              class="w-28 h-28 mx-auto rounded-full flex items-center justify-center mb-8 result-icon-appear"
              :class="result.passed ? 'bg-accent-emerald/20 text-accent-emerald shadow-[0_0_40px_rgba(46,111,94,0.3)]' : 'bg-red-500/10 text-red-400'"
            >
              <svg v-if="result.passed" class="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else class="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            
            <h2 class="text-4xl font-display font-black mb-4" :class="result.passed ? 'text-accent-emerald' : 'text-red-400'">
              {{ result.passed ? 'Aprovado!' : 'Continue Estudando' }}
            </h2>

            <!-- Animated Score Counter -->
            <div class="relative mb-8">
              <p class="text-7xl font-black text-white tabular-nums tracking-tight">
                {{ animatedScore }}<span class="text-4xl text-white/60">%</span>
              </p>
              <!-- Circular progress ring -->
              <div class="w-32 h-32 mx-auto mt-4">
                <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6" />
                  <circle 
                    cx="50" cy="50" r="42" fill="none" 
                    :stroke="result.passed ? '#2E6F5E' : '#ef4444'" 
                    stroke-width="6"
                    stroke-linecap="round"
                    :stroke-dasharray="`${(animatedScore / 100) * 263.9} 263.9`"
                    class="transition-all duration-1000 ease-out"
                  />
                </svg>
              </div>
            </div>
            
            <p class="text-text-muted mb-10 text-lg leading-relaxed max-w-sm mx-auto">
              {{ result.correctCount }} de {{ result.total }} corretas.
              {{ result.passed ? 'Você atingiu a pontuação necessária. Excelente trabalho!' : `A nota mínima é ${quiz?.passingScorePercent}%. Revise o material e tente novamente.` }}
            </p>

            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <button v-if="!result.passed" @click="resetQuiz" class="glass-surface text-white hover:bg-white/10 px-8 py-4 rounded-full font-bold focus-ring transition-colors">
                Tentar Novamente
              </button>
              <RouterLink v-if="result.certificateCode" :to="`/certificados/${result.certificateCode}`" class="bg-accent-gold text-bg-base hover:brightness-110 px-8 py-4 rounded-full font-bold focus-ring transition-colors">
                Ver meu certificado
              </RouterLink>
              <RouterLink v-else :to="course ? `/course/${course.slug}` : '/my-courses'" class="bg-accent-gold text-bg-base hover:brightness-110 px-8 py-4 rounded-full font-bold focus-ring transition-colors shadow-[0_0_20px_-5px_rgba(198,161,91,0.5)]">
                Voltar ao curso
              </RouterLink>
            </div>
          </div>
        </GlassCard>
      </div>
    </Transition>
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

