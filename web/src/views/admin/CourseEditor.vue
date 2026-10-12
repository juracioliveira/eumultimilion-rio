<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRoute, useRouter } from 'vue-router'
import { onKeyStroke, useEventListener } from '@vueuse/core'
import Icon from '../../components/ui/Icon.vue'
import { useUiStore } from '../../stores/ui'
import * as tus from 'tus-js-client'
import GlassCard from '../../components/ui/GlassCard.vue'
import { api, apiError } from '../../lib/api'
import { centsToReais, formatClock, reaisToCents } from '../../lib/format'
import type { Category } from '../../lib/types'

type Lesson = {
  id: string; moduleId: string; title: string; description: string | null; content: string | null; videoUrl: string | null
  durationSeconds: number | null; isFreePreview: boolean; status: string; bunnyVideoId: string | null
}
type Module = { id: string; title: string; lessons: Lesson[] }
type Quiz = { id: string; lessonId: string | null; courseId: string | null; context: 'lesson' | 'course'; title: string }
type Course = {
  id: string; title: string; slug: string; description: string | null; thumbnailUrl: string | null; categoryId: string | null
  priceCents: number; published: boolean; featured: boolean; caktoCheckoutUrl: string | null; caktoProductId: string | null
}

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const courseId = route.params.id as string

const course = ref<Course | null>(null)
const modules = ref<Module[]>([])
const quizzes = ref<Quiz[]>([])
const categories = ref<Category[]>([])
const bunnyEnabled = ref(false)
const form = ref({ title: '', slug: '', description: '', thumbnailUrl: '', categoryId: '__none', price: '0,00', published: false, featured: false, caktoCheckoutUrl: '', caktoProductId: '' })
const saving = ref(false)
const savedSnapshot = ref('')
const newModule = ref('')
const newCategory = ref('')

const load = async () => {
  const [c, cats] = await Promise.all([
    api.get<{ course: Course; modules: Module[]; quizzes: Quiz[]; bunnyEnabled: boolean }>(`/admin/courses/${courseId}`),
    api.get<{ categories: Category[] }>('/admin/categories'),
  ])
  course.value = c.data.course
  modules.value = c.data.modules
  quizzes.value = c.data.quizzes
  bunnyEnabled.value = c.data.bunnyEnabled
  categories.value = cats.data.categories
  const x = c.data.course
  form.value = {
    title: x.title, slug: x.slug, description: x.description ?? '', thumbnailUrl: x.thumbnailUrl ?? '',
    categoryId: x.categoryId ?? '__none', price: centsToReais(x.priceCents), published: x.published, featured: x.featured,
    caktoCheckoutUrl: x.caktoCheckoutUrl ?? '', caktoProductId: x.caktoProductId ?? '',
  }
  savedSnapshot.value = JSON.stringify(form.value)
}
onMounted(load)

// Alterações não salvas nas informações do curso
const dirty = computed(() => !!savedSnapshot.value && JSON.stringify(form.value) !== savedSnapshot.value)
useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
  if (dirty.value) e.preventDefault()
})
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return ui.confirm({ title: 'Sair sem salvar?', message: 'As alterações nas informações do curso serão perdidas.', confirmLabel: 'Sair sem salvar', danger: true })
})

const run = async (fn: () => Promise<unknown>, okMsg?: string) => {
  try {
    await fn()
    if (okMsg) ui.toast(okMsg)
  } catch (e) {
    ui.toast(apiError(e), 'error')
  }
}

const saveCourse = () =>
  run(async () => {
    saving.value = true
    try {
      const f = form.value
      const { data } = await api.patch<{ course: Course }>(`/admin/courses/${courseId}`, {
        title: f.title, slug: f.slug, description: f.description, thumbnailUrl: f.thumbnailUrl,
        categoryId: f.categoryId === '__none' ? null : f.categoryId, priceCents: reaisToCents(f.price),
        published: f.published, featured: f.featured, caktoCheckoutUrl: f.caktoCheckoutUrl, caktoProductId: f.caktoProductId,
      })
      course.value = data.course
      form.value.slug = data.course.slug
      savedSnapshot.value = JSON.stringify(form.value)
    } finally {
      saving.value = false
    }
  }, 'Curso salvo.')

const addCategory = () =>
  run(async () => {
    const { data } = await api.post<{ category: Category }>('/admin/categories', { name: newCategory.value })
    categories.value.push(data.category)
    form.value.categoryId = data.category.id
    newCategory.value = ''
  }, 'Categoria criada')

const deleteCourse = async () => {
  const ok = await ui.confirm({
    title: `Excluir "${course.value?.title}"?`,
    message: 'Módulos, aulas e o progresso dos alunos serão apagados. Certificados já emitidos continuam válidos.',
    confirmLabel: 'Excluir curso',
    danger: true,
  })
  if (!ok) return
  await run(async () => {
    await api.delete(`/admin/courses/${courseId}`)
    savedSnapshot.value = ''
    router.push('/admin/cursos')
  }, 'Curso excluído')
}

// ---------- módulos ----------
const addModule = () =>
  run(async () => {
    const { data } = await api.post<{ module: Module }>(`/admin/courses/${courseId}/modules`, { title: newModule.value })
    modules.value.push({ ...data.module, lessons: [] })
    newModule.value = ''
  }, 'Módulo criado')

const renameModule = (m: Module) => run(() => api.patch(`/admin/courses/modules/${m.id}`, { title: m.title }), 'Módulo renomeado.')

const deleteModule = async (m: Module) => {
  const ok = await ui.confirm({ title: `Excluir o módulo "${m.title}"?`, message: m.lessons.length ? `As ${m.lessons.length} aulas dele também serão excluídas.` : undefined, confirmLabel: 'Excluir', danger: true })
  if (!ok) return
  run(async () => {
    await api.delete(`/admin/courses/modules/${m.id}`)
    modules.value = modules.value.filter((x) => x.id !== m.id)
  }, 'Módulo excluído')
}

const persistOrder = () =>
  run(() => api.post(`/admin/courses/${courseId}/reorder`, { modules: modules.value.map((m) => ({ id: m.id, lessonIds: m.lessons.map((l) => l.id) })) }))

const moveModule = (index: number, dir: -1 | 1) => {
  const target = index + dir
  if (target < 0 || target >= modules.value.length) return
  const list = modules.value
  ;[list[index], list[target]] = [list[target]!, list[index]!]
  persistOrder()
}

const moveLesson = (m: Module, index: number, dir: -1 | 1) => {
  const target = index + dir
  if (target < 0 || target >= m.lessons.length) return
  ;[m.lessons[index], m.lessons[target]] = [m.lessons[target]!, m.lessons[index]!]
  persistOrder()
}

// ---------- aulas ----------
const editing = ref<(Lesson & { durationMinutes: string }) | null>(null)
const uploadProgress = ref<number | null>(null)

const addLesson = (m: Module) =>
  run(async () => {
    const { data } = await api.post<{ lesson: Lesson }>(`/admin/courses/modules/${m.id}/lessons`, { title: `Nova aula ${m.lessons.length + 1}` })
    m.lessons.push(data.lesson)
    openLesson(data.lesson)
  })

onKeyStroke('Escape', () => {
  if (editing.value && !ui.confirmRequest) editing.value = null
})
const lessonTitleInput = ref<HTMLInputElement | null>(null)
watch(editing, (v, old) => {
  if (v && !old) setTimeout(() => lessonTitleInput.value?.focus(), 50)
})

const openLesson = (l: Lesson) => {
  editing.value = { ...l, durationMinutes: l.durationSeconds ? String(Math.round(l.durationSeconds / 60)) : '' }
  uploadProgress.value = null
}

const saveLesson = () =>
  run(async () => {
    const l = editing.value!
    const minutes = Number(l.durationMinutes.replace(',', '.'))
    const { data } = await api.patch<{ lesson: Lesson }>(`/admin/courses/lessons/${l.id}`, {
      title: l.title,
      description: l.description ?? '',
      content: l.content ?? '',
      videoUrl: l.videoUrl ?? '',
      isFreePreview: l.isFreePreview,
      durationSeconds: l.durationMinutes && Number.isFinite(minutes) ? Math.round(minutes * 60) : null,
    })
    replaceLesson(data.lesson)
    editing.value = null
  }, 'Aula salva.')

const replaceLesson = (lesson: Lesson) => {
  for (const m of modules.value) {
    const i = m.lessons.findIndex((x) => x.id === lesson.id)
    if (i >= 0) m.lessons[i] = lesson
  }
}

const deleteLesson = async (m: Module, l: Lesson) => {
  const ok = await ui.confirm({ title: `Excluir a aula "${l.title}"?`, message: 'O progresso dos alunos nesta aula também será removido.', confirmLabel: 'Excluir', danger: true })
  if (!ok) return
  run(async () => {
    await api.delete(`/admin/courses/lessons/${l.id}`)
    m.lessons = m.lessons.filter((x) => x.id !== l.id)
    if (editing.value?.id === l.id) editing.value = null
  }, 'Aula excluída')
}

/** Upload direto browser → Bunny Stream via TUS (o vídeo não passa pelo nosso servidor). */
const uploadVideo = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !editing.value) return
  const lessonId = editing.value.id
  run(async () => {
    const { data } = await api.post<{ tus: { endpoint: string; headers: Record<string, string> }; videoId: string; libraryId: string }>(
      `/admin/courses/lessons/${lessonId}/upload-url`,
      {},
    )
    uploadProgress.value = 0
    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: data.tus.endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: data.tus.headers,
        metadata: { filetype: file.type, title: editing.value?.title ?? file.name },
        onError: reject,
        onProgress: (sent, total) => (uploadProgress.value = Math.round((sent / total) * 100)),
        onSuccess: () => resolve(),
      })
      upload.start()
    })
    const { data: done } = await api.post<{ lesson: Lesson }>(`/admin/courses/lessons/${lessonId}/upload-complete`, {})
    replaceLesson(done.lesson)
    if (editing.value?.id === lessonId) Object.assign(editing.value, { status: done.lesson.status, bunnyVideoId: done.lesson.bunnyVideoId })
    uploadProgress.value = null
  }, 'Upload concluído. A Bunny está processando o vídeo.')
}

const statusLabel: Record<string, string> = { draft: 'Sem vídeo', uploading: 'Enviando', processing: 'Processando', ready: 'Pronto', failed: 'Falhou' }
const lessonQuiz = (lessonId: string) => quizzes.value.find((q) => q.lessonId === lessonId)
const finalQuiz = computed(() => quizzes.value.find((q) => q.context === 'course'))
</script>

<template>
  <div v-if="!course" class="h-40 rounded-2xl bg-white/5 motion-safe:animate-pulse"></div>
  <div v-else class="space-y-10 pb-16">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <RouterLink to="/admin/cursos" class="text-sm text-text-muted hover:text-white">Cursos</RouterLink>
        <h1 class="text-3xl font-display font-black mt-1">{{ course.title }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <RouterLink :to="`/course/${course.slug}`" class="btn-glass"><Icon name="external" :size="16" /> Ver página</RouterLink>
        <span v-if="dirty" class="hidden sm:flex items-center gap-2 text-sm text-amber-200/90"><span class="w-2 h-2 rounded-full bg-amber-300"></span>Alterações não salvas</span>
        <button class="btn-gold" :disabled="saving || !dirty" @click="saveCourse"><Icon v-if="saving" name="spinner" :size="16" />{{ saving ? 'Salvando…' : 'Salvar curso' }}</button>
      </div>
    </div>

    <!-- Dados do curso -->
    <GlassCard padding="lg" class="!rounded-2xl">
      <h2 class="text-lg font-display font-bold mb-6">Informações</h2>
      <div class="grid md:grid-cols-2 gap-5">
        <div>
          <label class="field-label" for="c-title">Título</label>
          <input id="c-title" v-model="form.title" class="field">
        </div>
        <div>
          <label class="field-label" for="c-slug">Endereço (slug)</label>
          <input id="c-slug" v-model="form.slug" class="field">
        </div>
        <div class="md:col-span-2">
          <label class="field-label" for="c-desc">Descrição</label>
          <textarea id="c-desc" v-model="form.description" rows="3" class="field"></textarea>
        </div>
        <div>
          <label class="field-label" for="c-thumb">URL da capa</label>
          <input id="c-thumb" v-model="form.thumbnailUrl" class="field" placeholder="https://… ou /assets/…">
        </div>
        <div>
          <label class="field-label" for="c-price">Preço (R$) — 0 = gratuito</label>
          <input id="c-price" v-model="form.price" inputmode="decimal" class="field">
        </div>
        <div>
          <label class="field-label" for="c-cat">Categoria</label>
          <div class="flex gap-2">
            <select id="c-cat" v-model="form.categoryId" class="field">
              <option value="__none">Sem categoria</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <form class="flex gap-2 mt-2" @submit.prevent="addCategory">
            <input v-model="newCategory" class="field !py-1.5" placeholder="Nova categoria" aria-label="Nova categoria" required>
            <button class="btn-glass !py-1.5 shrink-0">Adicionar</button>
          </form>
        </div>
        <div class="flex flex-col gap-3 justify-center">
          <label class="flex items-center gap-3 text-sm"><input v-model="form.published" type="checkbox" class="w-4 h-4 accent-[#C6A15B]"> Publicado (visível no catálogo)</label>
          <label class="flex items-center gap-3 text-sm"><input v-model="form.featured" type="checkbox" class="w-4 h-4 accent-[#C6A15B]"> Destaque na página inicial</label>
        </div>
        <div class="md:col-span-2 pt-4 border-t border-white/10">
          <p class="text-sm font-semibold mb-1">Pagamento (Cakto)</p>
          <p class="text-xs text-text-muted mb-4">
            O botão "Comprar" abre o link de checkout. O webhook da Cakto libera o acesso casando o ID do produto e o e-mail do comprador.
          </p>
          <div class="grid md:grid-cols-2 gap-5">
            <div>
              <label class="field-label" for="c-cakto-url">Link de checkout</label>
              <input id="c-cakto-url" v-model="form.caktoCheckoutUrl" class="field" placeholder="https://pay.cakto.com.br/…">
            </div>
            <div>
              <label class="field-label" for="c-cakto-id">ID do produto na Cakto</label>
              <input id="c-cakto-id" v-model="form.caktoProductId" class="field">
            </div>
          </div>
        </div>
      </div>
    </GlassCard>

    <!-- Conteúdo -->
    <section>
      <h2 class="text-lg font-display font-bold mb-4">Módulos e aulas</h2>
      <div class="space-y-4">
        <GlassCard v-for="(m, mi) in modules" :key="m.id" padding="none" class="!rounded-2xl">
          <div class="flex items-center gap-2 p-4 border-b border-white/10">
            <span class="text-xs text-text-muted w-16 shrink-0">Módulo {{ mi + 1 }}</span>
            <input v-model="m.title" class="field !py-1.5 !bg-transparent !border-transparent hover:!border-white/10 focus:!border-accent-gold/60 font-semibold" :aria-label="`Título do módulo ${mi + 1}`" @change="renameModule(m)">
            <button class="icon-btn" :disabled="mi === 0" :aria-label="`Mover módulo ${m.title} para cima`" @click="moveModule(mi, -1)"><Icon name="chevron-up" :size="18" /></button>
            <button class="icon-btn" :disabled="mi === modules.length - 1" :aria-label="`Mover módulo ${m.title} para baixo`" @click="moveModule(mi, 1)"><Icon name="chevron-down" :size="18" /></button>
            <button class="icon-btn hover:!text-red-300 hover:!bg-red-500/10" :aria-label="`Excluir módulo ${m.title}`" @click="deleteModule(m)"><Icon name="trash" :size="17" /></button>
          </div>
          <ul>
            <li v-for="(l, li) in m.lessons" :key="l.id" class="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 text-sm">
              <span class="text-xs text-text-muted w-6 tabular-nums">{{ li + 1 }}</span>
              <button class="flex-1 min-w-0 text-left truncate hover:text-accent-gold" @click="openLesson(l)">{{ l.title }}</button>
              <span v-if="l.isFreePreview" class="hidden sm:inline text-[11px] text-emerald-soft">Grátis</span>
              <span v-if="lessonQuiz(l.id)" class="hidden sm:inline text-[11px] text-white/60">Quiz</span>
              <span class="hidden sm:inline text-[11px] text-text-muted w-20 text-right">{{ l.videoUrl ? 'Vídeo externo' : statusLabel[l.status] }}</span>
              <span class="text-xs text-text-muted w-12 text-right tabular-nums">{{ l.durationSeconds ? formatClock(l.durationSeconds) : '' }}</span>
              <button class="icon-btn" :disabled="li === 0" :aria-label="`Mover aula ${l.title} para cima`" @click="moveLesson(m, li, -1)"><Icon name="chevron-up" :size="17" /></button>
              <button class="icon-btn" :disabled="li === m.lessons.length - 1" :aria-label="`Mover aula ${l.title} para baixo`" @click="moveLesson(m, li, 1)"><Icon name="chevron-down" :size="17" /></button>
              <button class="icon-btn" :aria-label="`Editar aula ${l.title}`" @click="openLesson(l)"><Icon name="pencil" :size="16" /></button>
              <button class="icon-btn hover:!text-red-300 hover:!bg-red-500/10" :aria-label="`Excluir aula ${l.title}`" @click="deleteLesson(m, l)"><Icon name="trash" :size="16" /></button>
            </li>
          </ul>
          <div class="p-3">
            <button class="inline-flex items-center gap-1.5 text-sm text-accent-gold font-semibold hover:text-white px-2 py-1 rounded focus-ring" @click="addLesson(m)"><Icon name="plus" :size="16" /> Adicionar aula</button>
          </div>
        </GlassCard>
      </div>
      <p v-if="!modules.length" class="rounded-2xl border border-dashed border-white/15 p-8 text-center text-text-muted">Comece criando o primeiro módulo do curso.</p>
      <form class="flex gap-2 mt-4" @submit.prevent="addModule">
        <input v-model="newModule" class="field md:max-w-sm" placeholder="Título do novo módulo" aria-label="Título do novo módulo" required>
        <button class="btn-glass shrink-0">Adicionar módulo</button>
      </form>
    </section>

    <!-- Prova final -->
    <GlassCard padding="lg" class="!rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-lg font-display font-bold">Prova final</h2>
        <p class="text-sm text-text-muted">Quando existe, o aluno precisa ser aprovado para receber o certificado.</p>
      </div>
      <RouterLink v-if="finalQuiz" :to="`/admin/quizzes/${finalQuiz.id}`" class="btn-glass">Editar prova final</RouterLink>
      <RouterLink v-else :to="{ path: '/admin/quizzes/novo', query: { context: 'course', courseId: course.id } }" class="btn-glass">Criar prova final</RouterLink>
    </GlassCard>

    <div class="pt-6 border-t border-white/10">
      <button class="btn-danger" @click="deleteCourse"><Icon name="trash" :size="16" /> Excluir curso</button>
    </div>

    <!-- Editor de aula -->
    <Teleport to="body">
      <div v-if="editing" class="fixed inset-0 z-[100] flex justify-end bg-black/60" @click.self="editing = null">
        <div class="w-full max-w-xl h-full overflow-y-auto bg-bg-base border-l border-white/10 p-6 md:p-8" role="dialog" aria-modal="true" aria-label="Editar aula">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-display font-bold">Editar aula</h2>
            <button class="icon-btn" aria-label="Fechar editor de aula" @click="editing = null"><Icon name="x" :size="18" /></button>
          </div>
          <form class="space-y-5" @submit.prevent="saveLesson">
            <div>
              <label class="field-label" for="l-title">Título</label>
              <input id="l-title" ref="lessonTitleInput" v-model="editing.title" class="field" required>
            </div>
            <div>
              <label class="field-label" for="l-desc">Resumo</label>
              <input id="l-desc" v-model="editing.description" class="field">
            </div>

            <div class="rounded-2xl border border-white/10 p-4 space-y-4">
              <p class="text-sm font-semibold">Vídeo</p>
              <div v-if="bunnyEnabled">
                <label class="field-label" for="l-file">Enviar para a Bunny Stream</label>
                <input id="l-file" type="file" accept="video/*" class="block text-sm text-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white" :disabled="uploadProgress !== null" @change="uploadVideo">
                <div v-if="uploadProgress !== null" class="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div class="h-full bg-accent-gold transition-all" :style="{ width: `${uploadProgress}%` }"></div>
                </div>
                <p class="text-xs text-text-muted mt-2">Status: {{ statusLabel[editing.status] }}<template v-if="editing.bunnyVideoId"> · ID {{ editing.bunnyVideoId }}</template></p>
              </div>
              <div>
                <label class="field-label" for="l-video">{{ bunnyEnabled ? 'Ou URL de vídeo externo' : 'URL do vídeo' }}</label>
                <input id="l-video" v-model="editing.videoUrl" class="field" placeholder="YouTube, Vimeo, .mp4 ou .m3u8">
                <p class="text-xs text-text-muted mt-1.5">Se a aula tem vídeo da Bunny pronto, ele tem prioridade.</p>
              </div>
              <div>
                <label class="field-label" for="l-dur">Duração (minutos)</label>
                <input id="l-dur" v-model="editing.durationMinutes" inputmode="decimal" class="field max-w-[140px]">
              </div>
            </div>

            <div>
              <label class="field-label" for="l-content">Material da aula (texto)</label>
              <textarea id="l-content" v-model="editing.content" rows="10" class="field font-mono !text-[13px]" placeholder="Use **negrito**, listas com - e links [texto](https://…)"></textarea>
            </div>
            <label class="flex items-center gap-3 text-sm"><input v-model="editing.isFreePreview" type="checkbox" class="w-4 h-4 accent-[#C6A15B]"> Amostra grátis (visível sem comprar)</label>

            <div class="flex flex-wrap gap-2 pt-2">
              <button class="btn-gold">Salvar aula</button>
              <RouterLink v-if="lessonQuiz(editing.id)" :to="`/admin/quizzes/${lessonQuiz(editing.id)!.id}`" class="btn-glass">Editar quiz da aula</RouterLink>
              <RouterLink v-else :to="{ path: '/admin/quizzes/novo', query: { context: 'lesson', lessonId: editing.id, courseId: course.id } }" class="btn-glass">Criar quiz da aula</RouterLink>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
