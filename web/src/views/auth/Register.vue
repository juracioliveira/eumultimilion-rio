<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthShell from './AuthShell.vue'
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
        <input id="name" v-model="name" type="text" autocomplete="name" required class="field">
        <p class="text-xs text-text-muted mt-1.5">É o nome que aparece no seu certificado.</p>
      </div>
      <div>
        <label class="field-label" for="email">E-mail</label>
        <input id="email" v-model="email" type="email" autocomplete="email" required class="field">
      </div>
      <div>
        <label class="field-label" for="password">Senha</label>
        <input id="password" v-model="password" type="password" autocomplete="new-password" minlength="8" required class="field">
      </div>
      <p v-if="error" role="alert" class="text-sm text-red-300">{{ error }}</p>
      <button type="submit" class="btn-gold w-full !py-3" :disabled="loading">{{ loading ? 'Criando conta…' : 'Criar conta' }}</button>
    </form>
    <p class="mt-8 text-sm text-text-muted text-center">
      Já tem conta?
      <RouterLink :to="{ path: '/login', query: route.query }" class="text-accent-gold font-semibold hover:text-white">Entrar</RouterLink>
    </p>
  </AuthShell>
</template>
