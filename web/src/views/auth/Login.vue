<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthShell from './AuthShell.vue'
import PasswordInput from '../../components/ui/PasswordInput.vue'
import Icon from '../../components/ui/Icon.vue'
import { useAuthStore } from '../../stores/auth'
import { apiError } from '../../lib/api'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const submit = async () => {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : null
    router.replace(redirect ?? (auth.isAdmin ? '/admin' : '/my-courses'))
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Entrar" subtitle="Acesse seus cursos e continue de onde parou.">
    <form class="space-y-5" @submit.prevent="submit">
      <div>
        <label class="field-label" for="email">E-mail</label>
        <input id="email" v-model="email" type="email" autocomplete="email" inputmode="email" required autofocus class="field">
      </div>
      <div>
        <label class="field-label" for="password">Senha</label>
        <PasswordInput id="password" v-model="password" autocomplete="current-password" required />
      </div>
      <p v-if="error" role="alert" class="flex items-center gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"><Icon name="alert" :size="16" />{{ error }}</p>
      <button type="submit" class="btn-gold w-full !py-3" :disabled="loading"><Icon v-if="loading" name="spinner" :size="16" />{{ loading ? 'Entrando…' : 'Entrar' }}</button>
    </form>
    <p class="mt-8 text-sm text-text-muted text-center">
      Ainda não tem conta?
      <RouterLink :to="{ path: '/cadastro', query: route.query }" class="text-accent-gold font-semibold hover:text-white">Criar conta</RouterLink>
    </p>
  </AuthShell>
</template>
