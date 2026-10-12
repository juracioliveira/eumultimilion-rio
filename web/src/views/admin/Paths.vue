<script setup lang="ts">
import { onMounted, ref } from 'vue'
import GlassCard from '../../components/ui/GlassCard.vue'
import { api, apiError } from '../../lib/api'
import Icon from '../../components/ui/Icon.vue'
import { useUiStore } from '../../stores/ui'

const ui = useUiStore()

type AdminPath = { id: string; title: string; slug: string; description: string | null; thumbnailUrl: string | null; published: boolean; courses: { id: string; title: string }[] }
type Draft = { id?: string; title: string; description: string; thumbnailUrl: string; published: boolean; courseIds: string[] }

const paths = ref<AdminPath[]>([])
const courses = ref<{ id: string; title: string }[]>([])
const editing = ref<Draft | null>(null)
const addCourseId = ref('')
const error = ref('')

const load = async () => {
  const [p, c] = await Promise.all([
    api.get<{ paths: AdminPath[] }>('/admin/learning-paths'),
    api.get<{ courses: { id: string; title: string }[] }>('/admin/courses'),
  ])
  paths.value = p.data.paths
  courses.value = c.data.courses
}
onMounted(load)

const edit = (p?: AdminPath) => {
  error.value = ''
  editing.value = p
    ? { id: p.id, title: p.title, description: p.description ?? '', thumbnailUrl: p.thumbnailUrl ?? '', published: p.published, courseIds: p.courses.map((c) => c.id) }
    : { title: '', description: '', thumbnailUrl: '', published: true, courseIds: [] }
}

const titleOf = (id: string) => courses.value.find((c) => c.id === id)?.title ?? '—'

const move = (i: number, dir: -1 | 1) => {
  const list = editing.value!.courseIds
  const t = i + dir
  if (t < 0 || t >= list.length) return
  ;[list[i], list[t]] = [list[t]!, list[i]!]
}

const save = async () => {
  const d = editing.value!
  error.value = ''
  try {
    const payload = { title: d.title, description: d.description || null, thumbnailUrl: d.thumbnailUrl, published: d.published, courseIds: d.courseIds }
    if (d.id) await api.patch(`/admin/learning-paths/${d.id}`, payload)
    else await api.post('/admin/learning-paths', payload)
    editing.value = null
    await load()
    ui.toast('Trilha salva')
  } catch (e) {
    error.value = apiError(e)
  }
}

const remove = async (p: AdminPath) => {
  const ok = await ui.confirm({ title: `Excluir a trilha "${p.title}"?`, message: 'Os cursos não são afetados.', confirmLabel: 'Excluir', danger: true })
  if (!ok) return
  await api.delete(`/admin/learning-paths/${p.id}`)
  await load()
  ui.toast('Trilha excluída')
}
</script>

<template>
  <div class="space-y-8 pb-16">
    <div class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-display font-black">Trilhas</h1>
        <p class="text-sm text-text-muted mt-1">Sequências recomendadas de cursos. Concluir todos emite o certificado da trilha.</p>
      </div>
      <button class="btn-gold shrink-0" @click="edit()">Nova trilha</button>
    </div>

    <GlassCard v-if="editing" padding="lg" class="!rounded-2xl space-y-5">
      <h2 class="text-lg font-display font-bold">{{ editing.id ? 'Editar trilha' : 'Nova trilha' }}</h2>
      <div class="grid md:grid-cols-2 gap-5">
        <div>
          <label class="field-label" for="p-title">Título</label>
          <input id="p-title" v-model="editing.title" class="field" required>
        </div>
        <div>
          <label class="field-label" for="p-thumb">URL da capa</label>
          <input id="p-thumb" v-model="editing.thumbnailUrl" class="field">
        </div>
        <div class="md:col-span-2">
          <label class="field-label" for="p-desc">Descrição</label>
          <textarea id="p-desc" v-model="editing.description" rows="2" class="field"></textarea>
        </div>
      </div>
      <div>
        <p class="field-label">Cursos (na ordem sugerida)</p>
        <ol class="space-y-2 mb-3">
          <li v-for="(cid, i) in editing.courseIds" :key="cid" class="flex items-center gap-2 text-sm glass-surface rounded-xl px-3 py-2">
            <span class="w-6 text-text-muted tabular-nums">{{ i + 1 }}</span>
            <span class="flex-1 truncate">{{ titleOf(cid) }}</span>
            <button class="icon-btn" :disabled="i === 0" aria-label="Subir" @click="move(i, -1)"><Icon name="chevron-up" :size="16" /></button>
            <button class="icon-btn" :disabled="i === editing.courseIds.length - 1" aria-label="Descer" @click="move(i, 1)"><Icon name="chevron-down" :size="16" /></button>
            <button class="icon-btn hover:!text-red-300" aria-label="Remover da trilha" @click="editing.courseIds.splice(i, 1)"><Icon name="x" :size="16" /></button>
          </li>
        </ol>
        <div class="flex gap-2">
          <select v-model="addCourseId" class="field sm:max-w-sm" aria-label="Adicionar curso">
            <option value="" disabled>Adicionar curso…</option>
            <option v-for="c in courses.filter((c) => !editing!.courseIds.includes(c.id))" :key="c.id" :value="c.id">{{ c.title }}</option>
          </select>
          <button class="btn-glass shrink-0" :disabled="!addCourseId" @click="editing.courseIds.push(addCourseId); addCourseId = ''">Adicionar</button>
        </div>
      </div>
      <label class="flex items-center gap-3 text-sm"><input v-model="editing.published" type="checkbox" class="w-4 h-4 accent-[#C6A15B]"> Publicada</label>
      <p v-if="error" role="alert" class="text-sm text-red-300">{{ error }}</p>
      <div class="flex gap-2">
        <button class="btn-gold" :disabled="!editing.title.trim()" @click="save">Salvar</button>
        <button class="btn-glass" @click="editing = null">Cancelar</button>
      </div>
    </GlassCard>

    <p v-if="!paths.length && !editing" class="text-text-muted">Nenhuma trilha ainda.</p>
    <ul class="space-y-3">
      <li v-for="p in paths" :key="p.id">
        <GlassCard padding="md" class="!rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-white">{{ p.title }} <span v-if="!p.published" class="text-xs text-text-muted font-normal">(rascunho)</span></p>
            <p class="text-xs text-text-muted truncate">{{ p.courses.map((c) => c.title).join(' → ') || 'Sem cursos' }}</p>
          </div>
          <div class="flex gap-2">
            <button class="btn-glass !py-1.5" @click="edit(p)">Editar</button>
            <button class="btn-danger !py-1.5" @click="remove(p)">Excluir</button>
          </div>
        </GlassCard>
      </li>
    </ul>
  </div>
</template>
