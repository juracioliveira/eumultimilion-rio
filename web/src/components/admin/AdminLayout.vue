<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const open = ref(false)

const links = [
  { to: '/admin', label: 'Visão geral', exact: true },
  { to: '/admin/cursos', label: 'Cursos' },
  { to: '/admin/alunos', label: 'Alunos' },
  { to: '/admin/trilhas', label: 'Trilhas' },
]

const logout = () => {
  auth.logout()
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen md:grid md:grid-cols-[240px_1fr]">
    <aside
      class="fixed md:sticky top-0 inset-y-0 left-0 z-50 w-64 md:w-auto h-screen glass-surface !border-y-0 !border-l-0 flex flex-col transition-transform md:translate-x-0"
      :class="open ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="p-6">
        <RouterLink to="/" class="font-display font-black text-lg">Multimilionário<span class="text-accent-gold">.</span></RouterLink>
        <p class="text-xs text-text-muted mt-1">Painel administrativo</p>
      </div>
      <nav class="flex-1 px-3 space-y-1" aria-label="Admin">
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="block rounded-xl px-4 py-2.5 text-sm text-white/75 hover:text-white hover:bg-white/5 transition-colors focus-ring"
          :exact-active-class="l.exact ? '!bg-white/10 !text-white font-semibold' : ''"
          :active-class="l.exact ? '' : '!bg-white/10 !text-white font-semibold'"
          @click="open = false"
        >{{ l.label }}</RouterLink>
      </nav>
      <div class="p-4 border-t border-white/10 text-sm">
        <p class="text-white/80 truncate">{{ auth.user?.name }}</p>
        <div class="flex gap-4 mt-2">
          <RouterLink to="/cursos" class="text-text-muted hover:text-white">Ver site</RouterLink>
          <button class="text-text-muted hover:text-red-300" @click="logout">Sair</button>
        </div>
      </div>
    </aside>
    <div v-if="open" class="fixed inset-0 z-40 bg-black/60 md:hidden" @click="open = false"></div>

    <div class="min-w-0">
      <header class="md:hidden sticky top-0 z-30 glass-surface !border-x-0 !border-t-0 h-14 flex items-center px-4 gap-3">
        <button class="p-2 -ml-2 rounded-lg hover:bg-white/10" aria-label="Abrir menu" @click="open = true">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <span class="font-semibold">Admin</span>
      </header>
      <div class="px-4 md:px-10 py-8 md:py-10 max-w-6xl">
        <RouterView />
      </div>
    </div>
  </div>
</template>
