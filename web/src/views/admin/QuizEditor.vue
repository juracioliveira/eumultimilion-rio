<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import GlassCard from '../../components/ui/GlassCard.vue'
import Icon from '../../components/ui/Icon.vue'
import { useUiStore } from '../../stores/ui'
import { api, apiError } from '../../lib/api'

type Option = { optionText: string; isCorrect: boolean }
type Question = { questionText: string; type: 'single_choice' | 'multiple_choice'; options: Option[] }

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const isNew = route.params.id === 'novo'
const context = ref<'lesson' | 'course'>((route.query.context as 'lesson' | 'course') || 'lesson')
const courseId = ref((route.query.courseId as string) || '')
const title = ref(context.value === 'course' ? 'Prova final' : 'Quiz da aula')
const description = ref('')
const passing = ref(70)
const questions = ref<Question[]>([])
const loading = ref(!isNew)
const saving = ref(false)
const error = ref('')

const blankQuestion = (): Question => ({ questionText: '', type: 'single_choice', options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }] })

onMounted(async () => {
  if (isNew) {
    questions.value = [blankQuestion()]
    return
  }
  try {
    const { data } = await api.get<{
      quiz: { title: string; description: string | null; passingScorePercent: number; context: 'lesson' | 'course'; courseId: string | null }
      questions: (Question & { options: (Option & { id: string })[] })[]
    }>(`/admin/quizzes/${route.params.id}`)
    title.value = data.quiz.title
    description.value = data.quiz.description ?? ''
    passing.value = data.quiz.passingScorePercent
    context.value = data.quiz.context
    if (data.quiz.courseId) courseId.value = data.quiz.courseId
    questions.value = data.questions.map((q) => ({ questionText: q.questionText, type: q.type, options: q.options.map((o) => ({ optionText: o.optionText, isCorrect: o.isCorrect })) }))
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
})

const setCorrect = (q: Question, index: number) => {
  if (q.type === 'single_choice') q.options.forEach((o, i) => (o.isCorrect = i === index))
  else q.options[index]!.isCorrect = !q.options[index]!.isCorrect
}

const changeType = (q: Question) => {
  // ao voltar para escolha única, mantém só a primeira correta
  if (q.type === 'single_choice') {
    const first = q.options.findIndex((o) => o.isCorrect)
    q.options.forEach((o, i) => (o.isCorrect = i === Math.max(first, 0)))
  }
}

const back = () => (courseId.value ? router.push(`/admin/cursos/${courseId.value}`) : router.back())

const save = async () => {
  error.value = ''
  saving.value = true
  const payload = { title: title.value, description: description.value || null, passingScorePercent: Number(passing.value), questions: questions.value }
  try {
    if (isNew) {
      await api.post('/admin/quizzes', {
        ...payload,
        context: context.value,
        ...(context.value === 'lesson' ? { lessonId: route.query.lessonId } : { courseId: courseId.value }),
      })
    } else {
      await api.put(`/admin/quizzes/${route.params.id}`, payload)
    }
    ui.toast('Quiz salvo')
    back()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

const remove = async () => {
  const ok = await ui.confirm({ title: 'Excluir este quiz?', message: 'O histórico de tentativas dos alunos também será removido.', confirmLabel: 'Excluir quiz', danger: true })
  if (!ok) return
  await api.delete(`/admin/quizzes/${route.params.id}`)
  ui.toast('Quiz excluído')
  back()
}
</script>

<template>
  <div v-if="loading" class="h-40 rounded-2xl bg-white/5 motion-safe:animate-pulse"></div>
  <form v-else class="space-y-6 pb-16" @submit.prevent="save">
    <div>
      <RouterLink v-if="courseId" :to="`/admin/cursos/${courseId}`" class="text-sm text-text-muted hover:text-white">Voltar ao curso</RouterLink>
      <h1 class="text-3xl font-display font-black mt-1">{{ context === 'course' ? 'Prova final do curso' : 'Quiz da aula' }}</h1>
      <p class="text-sm text-text-muted mt-2">
        {{ context === 'course' ? 'Aprovação obrigatória para emitir o certificado.' : 'Formativo: não bloqueia o progresso do aluno.' }}
        Salvar substitui as perguntas; notas de tentativas antigas são mantidas.
      </p>
    </div>

    <GlassCard padding="lg" class="!rounded-2xl grid md:grid-cols-[1fr_160px] gap-5">
      <div>
        <label class="field-label" for="q-title">Título</label>
        <input id="q-title" v-model="title" class="field" required>
      </div>
      <div>
        <label class="field-label" for="q-pass">Nota mínima (%)</label>
        <input id="q-pass" v-model.number="passing" type="number" min="0" max="100" class="field">
      </div>
      <div class="md:col-span-2">
        <label class="field-label" for="q-desc">Instruções (opcional)</label>
        <input id="q-desc" v-model="description" class="field">
      </div>
    </GlassCard>

    <GlassCard v-for="(q, qi) in questions" :key="qi" padding="lg" class="!rounded-2xl space-y-4">
      <div class="flex items-start gap-3">
        <span class="w-8 h-8 rounded-full bg-accent-gold/20 text-accent-gold flex items-center justify-center text-sm font-bold shrink-0">{{ qi + 1 }}</span>
        <textarea v-model="q.questionText" rows="2" class="field" placeholder="Enunciado da pergunta" :aria-label="`Pergunta ${qi + 1}`" required></textarea>
        <button type="button" class="icon-btn hover:!text-red-300 hover:!bg-red-500/10" :aria-label="`Remover pergunta ${qi + 1}`" @click="questions.splice(qi, 1)"><Icon name="trash" :size="16" /></button>
      </div>
      <div class="pl-11 space-y-3">
        <select v-model="q.type" class="field !w-auto !py-1.5" aria-label="Tipo de pergunta" @change="changeType(q)">
          <option value="single_choice">Escolha única</option>
          <option value="multiple_choice">Múltipla escolha</option>
        </select>
        <div v-for="(o, oi) in q.options" :key="oi" class="flex items-center gap-3">
          <input
            :type="q.type === 'single_choice' ? 'radio' : 'checkbox'"
            :name="`q-${qi}`"
            :checked="o.isCorrect"
            class="w-4 h-4 accent-[#2E6F5E] shrink-0"
            :aria-label="`Alternativa ${oi + 1} correta`"
            @change="setCorrect(q, oi)"
          >
          <input v-model="o.optionText" class="field !py-2" :placeholder="`Alternativa ${oi + 1}`" required>
          <button type="button" class="icon-btn" :disabled="q.options.length <= 2" :aria-label="`Remover alternativa ${oi + 1}`" @click="q.options.splice(oi, 1)"><Icon name="x" :size="16" /></button>
        </div>
        <button type="button" class="inline-flex items-center gap-1.5 text-sm text-accent-gold font-semibold hover:text-white rounded focus-ring" @click="q.options.push({ optionText: '', isCorrect: false })"><Icon name="plus" :size="15" /> Alternativa</button>
        <p class="text-xs text-text-muted">Marque a(s) alternativa(s) correta(s) à esquerda.</p>
      </div>
    </GlassCard>

    <button type="button" class="btn-glass" @click="questions.push(blankQuestion())"><Icon name="plus" :size="16" /> Adicionar pergunta</button>

    <p v-if="error" role="alert" class="text-sm text-red-300">{{ error }}</p>
    <div class="flex flex-wrap gap-3 pt-4 border-t border-white/10">
      <button class="btn-gold" :disabled="saving || !questions.length">{{ saving ? 'Salvando…' : 'Salvar quiz' }}</button>
      <button type="button" class="btn-glass" @click="back">Cancelar</button>
      <button v-if="!isNew" type="button" class="btn-danger ml-auto" @click="remove">Excluir quiz</button>
    </div>
  </form>
</template>
