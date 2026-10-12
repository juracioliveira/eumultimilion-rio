<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useWindowScroll } from '@vueuse/core'
import { useAuthStore } from '../stores/auth'

const { y } = useWindowScroll()
const authStore = useAuthStore()
const router = useRouter()
const mobileMenuOpen = ref(false)
const search = ref('')

const logout = () => {
  authStore.logout()
  mobileMenuOpen.value = false
  router.push('/')
}

const submitSearch = () => {
  mobileMenuOpen.value = false
  router.push({ path: '/cursos', query: search.value ? { q: search.value } : {} })
}

const toggleMobile = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}
</script>

<template>
  <header 
    :class="[
      'fixed top-0 left-0 w-full z-50 transition-all duration-300 ease-out motion-reduce:transition-none',
      y > 10 ? 'bg-black/60 backdrop-blur-2xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)]' : 'bg-transparent border-b border-transparent'
    ]"
  >
    <nav class="max-w-[1400px] mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between">
      
      <!-- Mobile Hamburger -->
      <button 
        class="md:hidden text-white/80 hover:text-white transition-colors focus-ring rounded p-1"
        @click="toggleMobile"
        :aria-expanded="mobileMenuOpen"
        aria-label="Menu"
      >
        <svg v-if="!mobileMenuOpen" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Logo -->
      <RouterLink 
        to="/" 
        class="flex items-center gap-2 focus-ring rounded transition-opacity hover:opacity-80 absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0" 
        @click="mobileMenuOpen = false"
      >
        <span class="font-display font-black text-xl tracking-tight text-white">Multimilionário<span class="text-accent-gold">.</span></span>
      </RouterLink>
      
      <!-- Desktop Center Links -->
      <div class="hidden md:flex items-center justify-center gap-10 absolute left-1/2 -translate-x-1/2">
        <RouterLink 
          to="/cursos" 
          class="text-[13px] font-medium tracking-wide text-white/70 hover:text-white transition-colors focus-ring rounded px-2 py-1 relative group"
        >
          Cursos
        </RouterLink>
        <RouterLink 
          to="/paths" 
          class="text-[13px] font-medium tracking-wide text-white/70 hover:text-white transition-colors focus-ring rounded px-2 py-1 relative group"
        >
          Trilhas
        </RouterLink>
        <RouterLink 
          to="/my-courses" 
          class="text-[13px] font-medium tracking-wide text-white/70 hover:text-white transition-colors focus-ring rounded px-2 py-1 relative group"
        >
          Área do Aluno
        </RouterLink>
        <RouterLink 
          v-if="authStore.isAdmin"
          to="/admin" 
          class="text-[13px] font-medium tracking-wide text-accent-gold/90 hover:text-accent-gold transition-colors focus-ring rounded px-2 py-1 relative group"
        >
          Admin
        </RouterLink>
      </div>

      <!-- Desktop Right Actions -->
      <div class="hidden md:flex items-center gap-5">
        <RouterLink to="/cursos" class="text-white/70 hover:text-white transition-colors focus-ring rounded-full p-1" aria-label="Buscar cursos">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </RouterLink>
        
        <template v-if="authStore.isAuthenticated">
          <RouterLink to="/perfil" class="flex items-center gap-2 focus-ring rounded-full hover:bg-white/5 transition-colors p-1 pr-3" aria-label="Meu perfil">
            <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-accent-gold to-yellow-200 flex items-center justify-center text-black font-bold text-xs">
              {{ authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'A' }}
            </div>
            <span class="text-[13px] text-white/80 max-w-[120px] truncate">{{ authStore.user?.name.split(' ')[0] }}</span>
          </RouterLink>
          <button 
            @click="logout"
            class="text-[13px] font-medium tracking-wide text-white/70 hover:text-red-400 transition-colors focus-ring rounded px-2 py-1"
          >
            Sair
          </button>
        </template>
        <template v-else>
          <RouterLink 
            to="/login"
            class="text-[13px] font-medium tracking-wide text-white/70 hover:text-white transition-colors focus-ring rounded px-2 py-1"
          >
            Entrar
          </RouterLink>
          <RouterLink to="/cadastro" class="btn-gold !py-1.5 !px-4 !text-[13px]">Criar conta</RouterLink>
        </template>
      </div>

      <!-- Mobile Right Placeholder (to balance absolute center logo) -->
      <div class="md:hidden w-6"></div>
    </nav>
  </header>

  <!-- Mobile Menu Overlay -->
  <Transition name="mobile-menu">
    <div 
      v-if="mobileMenuOpen" 
      class="fixed inset-0 z-40 pt-16 bg-black/95 backdrop-blur-3xl md:hidden overflow-y-auto"
    >
      <div class="flex flex-col px-8 py-8 space-y-6">
        <!-- Search bar -->
        <form class="relative w-full mb-4" @submit.prevent="submitSearch">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input v-model="search" type="search" aria-label="Buscar cursos" placeholder="Buscar cursos..." class="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:outline-none focus:border-accent-gold/50 transition-colors">
        </form>
        
        <RouterLink 
          to="/cursos" 
          class="text-2xl font-display font-medium text-white/90 hover:text-white transition-colors pb-4 border-b border-white/10 flex justify-between items-center"
          @click="mobileMenuOpen = false"
        >
          Cursos
          <svg class="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"/></svg>
        </RouterLink>
        <RouterLink 
          to="/paths" 
          class="text-2xl font-display font-medium text-white/90 hover:text-white transition-colors pb-4 border-b border-white/10 flex justify-between items-center"
          @click="mobileMenuOpen = false"
        >
          Trilhas
          <svg class="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"/></svg>
        </RouterLink>
        <RouterLink 
          to="/my-courses" 
          class="text-2xl font-display font-medium text-white/90 hover:text-white transition-colors pb-4 border-b border-white/10 flex justify-between items-center"
          @click="mobileMenuOpen = false"
        >
          Área do Aluno
          <svg class="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"/></svg>
        </RouterLink>
        <RouterLink 
          v-if="authStore.isAdmin"
          to="/admin" 
          class="text-2xl font-display font-medium text-accent-gold hover:text-white transition-colors pb-4 border-b border-white/10 flex justify-between items-center"
          @click="mobileMenuOpen = false"
        >
          Painel Admin
          <svg class="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"/></svg>
        </RouterLink>

        <div class="pt-8">
          <button 
            v-if="authStore.isAuthenticated" 
            @click="logout"
            class="text-sm font-medium text-red-400/80 hover:text-red-400 transition-colors py-2"
          >
            Sair da conta
          </button>
          <RouterLink 
            v-else
            to="/login"
            @click="mobileMenuOpen = false"
            class="text-sm font-medium text-accent-gold/90 hover:text-accent-gold transition-colors py-2"
          >
            Fazer login
          </RouterLink>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.mobile-menu-enter-active {
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.mobile-menu-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .mobile-menu-enter-active,
  .mobile-menu-leave-active {
    transition: none;
  }
}
</style>


