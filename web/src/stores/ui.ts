import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Toast = { id: number; kind: 'success' | 'error' | 'info'; message: string }
type ConfirmRequest = {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

let seq = 0

/** Feedback global: avisos (toasts) e diálogo de confirmação. */
export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const confirmRequest = ref<ConfirmRequest | null>(null)

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function toast(message: string, kind: Toast['kind'] = 'success') {
    const id = ++seq
    toasts.value = [...toasts.value.slice(-2), { id, kind, message }]
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500)
  }

  /** Substitui window.confirm: `if (await ui.confirm({ title: '…' })) …` */
  function confirm(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    confirmRequest.value?.resolve(false)
    return new Promise((resolve) => {
      confirmRequest.value = { ...opts, resolve }
    })
  }

  function answer(ok: boolean) {
    confirmRequest.value?.resolve(ok)
    confirmRequest.value = null
  }

  return { toasts, toast, dismiss, confirmRequest, confirm, answer }
})
