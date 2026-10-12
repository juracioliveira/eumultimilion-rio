<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthShell from './AuthShell.vue'
import PasswordInput from '../../components/ui/PasswordInput.vue'
import Icon from '../../components/ui/Icon.vue'
import { useAuthStore } from '../../stores/auth'
import { apiError } from '../../lib/api'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

/** Força da senha (0–3) só como orientação — o mínimo exigido são 8 caracteres. */
const strength = computed(() => {
  const p = password.value
  if (p.length < 8) return 0
  let score = 1
  if (p.length >= 12) score++
  if (/[0-9]/.test(p) && /[a-zA-Z]/.test(p) && /[^a-zA-Z0-9]/.test(p)) score++
  return score
})
const strengthLabel = computed(() => ['Mínimo de 8 caracteres', 'Senha aceitável', 'Senha boa', 'Senha forte'][strength.value])

const submit = async () => {
  error.value = ''
  if (password.value.length < 8) {
    error.value = 'A senha precisa ter pelo menos 8 caracteres'
    return
  }
  loading.value = true
  try {
    await auth.register(name.value, email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : null
    router.replace(redirect ?? '/cursos')
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Criar conta" subtitle="Use o mesmo e-mail da sua compra para liberar seus cursos automaticamente.">
    <form class="space-y-5" @submit.prevent="submit">
      <div>
        <label class="field-label" for="name">Nome completo</label>
        <input id="name" v-model="name" type="text" autocomplete="name" required autofocus class="field" aria-describedby="name-hint">
        <p id="name-hint" class="text-xs text-text-muted mt-1.5">É o nome que aparece no seu certificado.</p>
      </div>
      <div>
        <label class="field-label" for="email">E-mail</label>
        <input id="email" v-model="email" type="email" autocomplete="email" inputmode="email" required class="field">
      </div>
      <div>
        <label class="field-label" for="password">Senha</label>
        <PasswordInput id="password" v-model="password" autocomplete="new-password" :minlength="8" required describedby="pw-hint" />
        <div class="mt-2 flex gap-1" aria-hidden="true">
          <span v-for="i in 3" :key="i" class="h-1 flex-1 rounded-full transition-colors" :class="strength >= i ? (strength === 1 ? 'bg-amber-400/80' : 'bg-accent-emerald') : 'bg-white/10'"></span>
        </div>
        <p id="pw-hint" class="text-xs text-text-muted mt-1.5" aria-live="polite">{{ strengthLabel }}</p>
      </div>
      <p v-if="error" role="alert" class="flex items-center gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"><Icon name="alert" :size="16" />{{ error }}</p>
      <button type="submit" class="btn-gold w-full !py-3" :disabled="loading"><Icon v-if="loading" name="spinner" :size="16" />{{ loading ? 'Criando conta…' : 'Criar conta' }}</button>
    </form>
    <p class="mt-8 text-sm text-text-muted text-center">
      Já tem conta?
      <RouterLink :to="{ path: '/login', query: route.query }" class="text-accent-gold font-semibold hover:text-white">Entrar</RouterLink>
    </p>
  </AuthShell>
</template>
