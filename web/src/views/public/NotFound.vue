<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
    <p class="text-accent-gold font-display font-black text-6xl mb-4">404</p>
    <h1 class="text-2xl font-display font-bold mb-3">Página não encontrada</h1>
    <p class="text-text-muted mb-8">O endereço pode ter mudado ou o conteúdo não está mais disponível.</p>
    <RouterLink to="/cursos" class="btn-gold">Ver cursos</RouterLink>
  </div>
</template>
