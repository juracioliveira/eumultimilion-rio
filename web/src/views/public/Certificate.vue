<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../../lib/api'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'

const route = useRoute()
const code = route.params.code
const certificate = ref<any>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const res = await api.get(`/certificates/${code}`)
    certificate.value = res.data.certificate
  } catch (e) {
    error.value = 'Certificado não encontrado ou código inválido.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <!-- Background behind glass -->
  <div class="min-h-screen bg-bg-base bg-[url('/assets/hero_premium_bg_1788306655617.jpg')] bg-cover bg-fixed bg-center text-text-primary p-4 md:p-8 flex items-center justify-center relative">
    
    <div class="absolute inset-0 bg-bg-base/80 fixed"></div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="relative z-10 w-full max-w-2xl">
      <div class="glass-surface p-12 rounded-[32px] shadow-2xl overflow-hidden">
        <div class="text-center space-y-6">
          <SkeletonLoader variant="circle" width="64px" height="64px" class="mx-auto" />
          <SkeletonLoader variant="text" :lines="1" width="200px" class="mx-auto" />
          <SkeletonLoader variant="text" :lines="1" width="320px" class="mx-auto" />
        </div>
        <div class="bg-black/30 p-8 rounded-[24px] mt-10 space-y-6">
          <div class="space-y-2">
            <SkeletonLoader variant="text" :lines="1" width="100px" />
            <SkeletonLoader variant="text" :lines="1" width="250px" />
          </div>
          <div class="space-y-2">
            <SkeletonLoader variant="text" :lines="1" width="60px" />
            <SkeletonLoader variant="text" :lines="1" width="300px" />
          </div>
          <div class="space-y-2">
            <SkeletonLoader variant="text" :lines="1" width="130px" />
            <SkeletonLoader variant="text" :lines="1" width="150px" />
          </div>
        </div>
      </div>
    </div>
    
    <!-- Error Modal -->
    <div v-else-if="error" class="relative z-10 glass-surface p-12 rounded-[32px] max-w-md w-full text-center shadow-2xl cert-appear">
      <div class="w-16 h-16 bg-red-500/20 text-red-400 mx-auto rounded-full flex items-center justify-center mb-6">
        <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 class="text-2xl font-display font-bold text-text-primary mb-2">Inválido</h2>
      <p class="text-text-muted">{{ error }}</p>
    </div>

    <!-- Certificate Modal -->
    <div v-else-if="certificate" class="relative z-10 glass-surface p-12 rounded-[32px] max-w-2xl w-full shadow-2xl overflow-hidden cert-appear">
      
      <!-- Subtle internal glow for the "Premium" feel -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-accent-gold/5 blur-[100px] rounded-full pointer-events-none"></div>

      <!-- Animated pulsing ring behind the badge -->
      <div class="relative z-10 text-center mb-10">
        <div class="relative inline-flex items-center justify-center">
          <!-- Pulse ring -->
          <div class="absolute inset-0 w-16 h-16 rounded-full bg-accent-gold/10 cert-pulse"></div>
          <div class="w-16 h-16 bg-accent-gold/20 text-accent-gold rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(198,161,91,0.3)] cert-badge-appear">
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
        </div>
        <h1 class="text-3xl font-display font-black text-text-primary mb-2 mt-6 cert-text-appear">Autenticado</h1>
        <p class="text-text-muted cert-text-appear" style="animation-delay: 100ms">Certificado autêntico, emitido pela plataforma Multimilionário.</p>
      </div>
      
      <div class="bg-black/30 p-8 rounded-[24px] border border-white/5 relative z-10 mb-8 cert-data-appear">
        <div class="mb-6">
          <span class="block text-text-muted text-sm font-semibold uppercase tracking-wider mb-1">Concluinte</span>
          <span class="text-2xl font-bold text-white">{{ certificate.studentName }}</span>
        </div>
        <div class="mb-6">
          <span class="block text-text-muted text-sm font-semibold uppercase tracking-wider mb-1">{{ certificate.type === 'course' ? 'Curso' : 'Trilha' }}</span>
          <span class="text-2xl text-accent-gold font-bold">{{ certificate.contentTitle }}</span>
        </div>
        <div>
          <span class="block text-text-muted text-sm font-semibold uppercase tracking-wider mb-1">Data de Emissão</span>
          <span class="text-lg text-white">{{ new Date(certificate.issuedAt).toLocaleDateString('pt-BR') }}</span>
        </div>
      </div>
      
      <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 cert-actions-appear">
        <div class="text-sm text-text-muted bg-black/20 px-4 py-2 rounded-lg border border-white/5">
          <span class="font-semibold uppercase mr-2 text-xs">Código:</span>
          <span class="font-mono">{{ certificate.verificationCode }}</span>
        </div>
        
        <a v-if="certificate.pdfUrl" :href="certificate.pdfUrl" target="_blank" rel="noopener" class="w-full md:w-auto bg-accent-gold text-bg-base hover:brightness-110 px-6 py-3 rounded-full font-bold focus-ring transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(198,161,91,0.2)]">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Baixar PDF Original
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Card entrance */
.cert-appear {
  animation: certAppear 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes certAppear {
  from {
    opacity: 0;
    transform: scale(0.94) translateY(24px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Badge bounce-in */
.cert-badge-appear {
  animation: badgeBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
}
@keyframes badgeBounce {
  from {
    opacity: 0;
    transform: scale(0.2) rotate(-15deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

/* Pulse ring behind badge */
.cert-pulse {
  animation: certPulse 2s ease-in-out infinite;
}
@keyframes certPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.4);
    opacity: 0;
  }
}

/* Staggered text entrance */
.cert-text-appear {
  animation: textSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both;
}
@keyframes textSlideUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Data block entrance */
.cert-data-appear {
  animation: textSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.55s both;
}

/* Actions entrance */
.cert-actions-appear {
  animation: textSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.7s both;
}

@media (prefers-reduced-motion: reduce) {
  .cert-appear,
  .cert-badge-appear,
  .cert-pulse,
  .cert-text-appear,
  .cert-data-appear,
  .cert-actions-appear {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>

