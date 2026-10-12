<script setup lang="ts">
/** Conjunto pequeno de ícones de traço (24px, currentColor) usado no app inteiro. */
export type IconName =
  | 'arrow-left' | 'arrow-right' | 'chevron-down' | 'chevron-up' | 'chevron-left' | 'chevron-right'
  | 'check' | 'x' | 'play' | 'pause' | 'lock' | 'trash' | 'pencil' | 'plus' | 'eye' | 'eye-off'
  | 'search' | 'award' | 'clock' | 'book' | 'list' | 'alert' | 'info' | 'grip' | 'external' | 'download' | 'spinner'

defineProps<{ name: IconName; size?: number }>()

const paths: Record<IconName, string> = {
  'arrow-left': 'M19 12H5m7-7-7 7 7 7',
  'arrow-right': 'M5 12h14m-7-7 7 7-7 7',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-up': 'm18 15-6-6-6 6',
  'chevron-left': 'm15 18-6-6 6-6',
  'chevron-right': 'm9 18 6-6-6-6',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  play: 'M7 4.5v15l12.5-7.5z',
  pause: 'M8 5v14M16 5v14',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  plus: 'M12 5v14M5 12h14',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off': 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm10 3-4.35-4.35',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm-3.5-1L7 22l5-3 5 3-1.5-8',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v4l3 2',
  book: 'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2V5zm0 14a2 2 0 0 1 2-2h14',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-5v-4m0-4h.01',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  external: 'M14 4h6v6m0-6L10 14M18 14v6H4V6h6',
  download: 'M12 4v12m-5-5 5 5 5-5M4 20h16',
  spinner: 'M21 12a9 9 0 1 1-6.2-8.56',
}
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    :class="name === 'spinner' ? 'motion-safe:animate-spin' : ''"
  >
    <path :d="paths[name]" :fill="name === 'play' ? 'currentColor' : 'none'" />
  </svg>
</template>
