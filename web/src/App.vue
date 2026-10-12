<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import Navbar from './components/Navbar.vue'
import AppFeedback from './components/ui/AppFeedback.vue'

const route = useRoute()
</script>

<template>
  <a href="#conteudo" class="skip-link">Pular para o conteúdo</a>
  <Navbar v-if="!route.meta.bare" />
  <main id="conteudo" tabindex="-1" class="outline-none" :class="route.meta.bare ? '' : 'pt-14 md:pt-16'">
    <RouterView v-slot="{ Component, route: r }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="r.matched[0]?.path === '/admin' ? '/admin' : r.path" />
      </Transition>
    </RouterView>
  </main>
  <AppFeedback />
</template>

<style>
.skip-link {
  position: fixed;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 300;
  padding: 0.6rem 1rem;
  border-radius: 9999px;
  background: var(--color-accent-gold);
  color: var(--color-bg-base);
  font-weight: 600;
  font-size: 0.875rem;
  transform: translateY(-200%);
}
.skip-link:focus {
  transform: none;
}
.page-enter-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.page-leave-active {
  transition: opacity 0.15s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: none;
  }
  .page-enter-from {
    transform: none;
  }
}
</style>
