<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { onKeyStroke } from '@vueuse/core'
import { useUiStore } from '../../stores/ui'
import Icon from './Icon.vue'

const ui = useUiStore()
const dialogRef = ref<HTMLElement | null>(null)
const confirmBtn = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null

// Foco vai para o diálogo e volta para quem abriu ao fechar
watch(
  () => ui.confirmRequest,
  async (req) => {
    if (req) {
      previousFocus = document.activeElement as HTMLElement | null
      await nextTick()
      confirmBtn.value?.focus()
    } else {
      previousFocus?.focus()
    }
  },
)

onKeyStroke('Escape', () => ui.confirmRequest && ui.answer(false))

// Mantém o Tab dentro do diálogo
const trap = (e: KeyboardEvent) => {
  if (e.key !== 'Tab' || !dialogRef.value) return
  const items = dialogRef.value.querySelectorAll<HTMLElement>('button')
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last?.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first?.focus()
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- Avisos -->
    <div class="fixed z-[200] bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 flex flex-col gap-2 sm:w-96 pointer-events-none" aria-live="polite" role="status">
      <TransitionGroup name="toast">
        <div
          v-for="t in ui.toasts"
          :key="t.id"
          class="pointer-events-auto glass-surface !bg-[#161a24]/90 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8)]"
        >
          <span
            class="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            :class="t.kind === 'success' ? 'bg-accent-emerald text-white' : t.kind === 'error' ? 'bg-red-500/90 text-white' : 'bg-white/15 text-white'"
          >
            <Icon :name="t.kind === 'success' ? 'check' : t.kind === 'error' ? 'x' : 'info'" :size="12" />
          </span>
          <p class="text-sm text-white/90 flex-1 leading-snug">{{ t.message }}</p>
          <button class="text-white/40 hover:text-white rounded focus-ring" aria-label="Fechar aviso" @click="ui.dismiss(t.id)">
            <Icon name="x" :size="16" />
          </button>
        </div>
      </TransitionGroup>
    </div>

    <!-- Confirmação -->
    <Transition name="dialog">
      <div v-if="ui.confirmRequest" class="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" @click.self="ui.answer(false)">
        <div
          ref="dialogRef"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          :aria-describedby="ui.confirmRequest.message ? 'confirm-message' : undefined"
          class="dialog-panel w-full max-w-md rounded-[28px] bg-[#141823] border border-white/10 p-6 shadow-2xl"
          @keydown="trap"
        >
          <div class="flex gap-4">
            <span
              class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              :class="ui.confirmRequest.danger ? 'bg-red-500/15 text-red-300' : 'bg-accent-gold/15 text-accent-gold'"
            >
              <Icon :name="ui.confirmRequest.danger ? 'alert' : 'info'" />
            </span>
            <div>
              <h2 id="confirm-title" class="font-display font-bold text-lg text-white">{{ ui.confirmRequest.title }}</h2>
              <p v-if="ui.confirmRequest.message" id="confirm-message" class="text-sm text-text-muted mt-1.5 leading-relaxed">{{ ui.confirmRequest.message }}</p>
            </div>
          </div>
          <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
            <button class="btn-glass" @click="ui.answer(false)">Cancelar</button>
            <button
              ref="confirmBtn"
              :class="ui.confirmRequest.danger ? 'inline-flex items-center justify-center rounded-full bg-red-500/90 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500 focus-ring' : 'btn-gold'"
              @click="ui.answer(true)"
            >
              {{ ui.confirmRequest.confirmLabel ?? 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-enter-active .dialog-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from .dialog-panel {
  transform: translateY(12px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .dialog-enter-active,
  .dialog-leave-active,
  .dialog-enter-active .dialog-panel {
    transition: none;
  }
}
</style>
