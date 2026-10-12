<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import GlassCard from '../../components/ui/GlassCard.vue'
import PasswordInput from '../../components/ui/PasswordInput.vue'
import { useUiStore } from '../../stores/ui'
import { useAuthStore } from '../../stores/auth'
import { api, apiError } from '../../lib/api'
import { formatDate } from '../../lib/format'

type Cert = { type: 'course' | 'learning_path'; title: string; code: string; pdfUrl: string | null; issuedAt: string }

const auth = useAuthStore()
const ui = useUiStore()
const name = ref(auth.user?.name ?? '')
const currentPassword = ref('')
const newPassword = ref('')
const saving = ref(false)
const certificates = ref<Cert[]>([])

onMounted(async () => {
  const { data } = await api.get<{ certificates: Cert[] }>('/student/certificates')
  certificates.value = data.certificates
})

const save = async () => {
  saving.value = true
  try {
    await auth.updateProfile({
      name: name.value,
      ...(newPassword.value ? { currentPassword: currentPassword.value, newPassword: newPassword.value } : {}),
    })
    currentPassword.value = ''
    newPassword.value = ''
    ui.toast('Dados atualizados')
  } catch (e) {
    ui.toast(apiError(e), 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-16 grid gap-8 md:grid-cols-[1fr_1.2fr]">
    <section>
      <h1 class="text-3xl md:text-4xl font-display font-black mb-8">Meu perfil</h1>
      <GlassCard padding="lg">
        <form class="space-y-5" @submit.prevent="save">
          <div>
            <label class="field-label" for="name">Nome (aparece nos certificados)</label>
            <input id="name" v-model="name" class="field" required minlength="2">
          </div>
          <div>
            <span class="field-label">E-mail</span>
            <p class="text-sm text-white/80">{{ auth.user?.email }}</p>
          </div>
          <div class="pt-4 border-t border-white/10 space-y-4">
            <p class="text-sm font-semibold text-white">Alterar senha</p>
            <div>
              <label class="field-label" for="cur">Senha atual</label>
              <PasswordInput id="cur" v-model="currentPassword" autocomplete="current-password" />
            </div>
            <div>
              <label class="field-label" for="new">Nova senha</label>
              <PasswordInput id="new" v-model="newPassword" autocomplete="new-password" :minlength="8" />
            </div>
          </div>
          <button class="btn-gold" :disabled="saving">{{ saving ? 'Salvando…' : 'Salvar' }}</button>
        </form>
      </GlassCard>
    </section>

    <section>
      <h2 class="text-2xl font-display font-bold mb-8 md:mt-3">Certificados</h2>
      <p v-if="!certificates.length" class="text-text-muted">
        Conclua um curso para receber seu certificado.
        <RouterLink to="/my-courses" class="text-accent-gold font-semibold hover:text-white">Ver meus cursos</RouterLink>
      </p>
      <ul class="space-y-3">
        <li v-for="c in certificates" :key="c.code">
          <GlassCard padding="md" class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="text-xs text-emerald-soft font-semibold mb-1">{{ c.type === 'course' ? 'Curso' : 'Trilha' }} · {{ formatDate(c.issuedAt) }}</p>
              <p class="font-semibold text-white truncate">{{ c.title }}</p>
            </div>
            <div class="flex gap-2 shrink-0">
              <RouterLink :to="`/certificados/${c.code}`" class="btn-glass !px-4 !py-2">Ver</RouterLink>
              <a v-if="c.pdfUrl" :href="c.pdfUrl" target="_blank" rel="noopener" class="btn-gold !px-4 !py-2">PDF</a>
            </div>
          </GlassCard>
        </li>
      </ul>
    </section>
  </div>
</template>
