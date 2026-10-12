import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, getToken, saveToken } from '../lib/api'
import type { User } from '../lib/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getToken())
  const user = ref<User | null>(null)
  const ready = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function setSession(newToken: string, newUser: User) {
    token.value = newToken
    user.value = newUser
    saveToken(newToken)
  }

  function clear() {
    token.value = null
    user.value = null
    saveToken(null)
  }

  /** Restaura a sessão salva (chamado uma vez, antes da primeira navegação). */
  async function init() {
    if (ready.value) return
    if (token.value) {
      try {
        const { data } = await api.get<{ user: User }>('/auth/me')
        user.value = data.user
      } catch {
        clear()
      }
    }
    ready.value = true
  }

  async function login(email: string, password: string) {
    const { data } = await api.post<{ token: string; user: User }>('/auth/login', { email, password })
    setSession(data.token, data.user)
  }

  async function register(name: string, email: string, password: string) {
    const { data } = await api.post<{ token: string; user: User }>('/auth/register', { name, email, password })
    setSession(data.token, data.user)
  }

  async function updateProfile(payload: { name?: string; currentPassword?: string; newPassword?: string }) {
    const { data } = await api.patch<{ token: string; user: User }>('/auth/me', payload)
    setSession(data.token, data.user)
  }

  function logout() {
    clear()
  }

  return { token, user, ready, isAuthenticated, isAdmin, init, login, register, updateProfile, logout }
})
