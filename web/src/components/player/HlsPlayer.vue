<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Hls from 'hls.js'
import { onClickOutside, useEventListener } from '@vueuse/core'
import Icon from '../ui/Icon.vue'

/**
 * Player de vídeo (HLS via hls.js, mp4 nativo).
 * Controles em vidro sobre o vídeo; atalhos: espaço/K, ←/→ (10s), J/L, M, F, 0–9.
 */
const props = defineProps<{
  src: string
  poster?: string
  /** Segundos já assistidos — o vídeo retoma desse ponto. */
  startAt?: number
}>()

const emit = defineEmits<{
  (e: 'progress', watchedSeconds: number, totalSeconds: number): void
  (e: 'ended'): void
}>()

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]
const SPEED_KEY = 'player-speed'

const videoRef = ref<HTMLVideoElement | null>(null)
const container = ref<HTMLDivElement | null>(null)
const speedMenu = ref<HTMLDivElement | null>(null)
let hls: Hls | null = null

const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const buffered = ref(0)
const isMuted = ref(false)
const volume = ref(1)
const isFullscreen = ref(false)
const showControls = ref(true)
const waiting = ref(false)
const failed = ref(false)
const speed = ref(readSpeed())
const speedOpen = ref(false)
const flash = ref<{ icon: 'play' | 'pause' | 'chevron-left' | 'chevron-right'; label?: string; id: number } | null>(null)
let hideTimer: number | undefined
let flashTimer: number | undefined

function readSpeed() {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY))
    return SPEEDS.includes(v) ? v : 1
  } catch {
    return 1
  }
}

const fmt = (t: number) => {
  if (!Number.isFinite(t)) return '0:00'
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60).toString().padStart(2, '0')
  return h ? `${h}:${m.toString().padStart(2, '0')}:${s}` : `${m}:${s}`
}

const playedPct = computed(() => (duration.value ? (currentTime.value / duration.value) * 100 : 0))
const bufferedPct = computed(() => (duration.value ? (buffered.value / duration.value) * 100 : 0))

const init = () => {
  const video = videoRef.value
  if (!video || !props.src) return
  failed.value = false
  hls?.destroy()
  hls = null

  if (!/\.m3u8(\?|$)/i.test(props.src)) {
    video.src = props.src
  } else if (Hls.isSupported()) {
    hls = new Hls({ maxMaxBufferLength: 30 })
    hls.loadSource(props.src)
    hls.attachMedia(video)
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) failed.value = true
    })
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = props.src // Safari
  }
  video.playbackRate = speed.value
}

watch(() => props.src, init)
onMounted(() => {
  init()
  revealControls()
})
onBeforeUnmount(() => {
  hls?.destroy()
  clearTimeout(hideTimer)
  clearTimeout(flashTimer)
})

// ---------- ações ----------
const togglePlay = () => {
  const v = videoRef.value
  if (!v || failed.value) return
  if (v.paused) v.play().catch(() => {})
  else v.pause()
  showFlash(v.paused ? 'pause' : 'play')
}

const seekBy = (delta: number) => {
  const v = videoRef.value
  if (!v || !duration.value) return
  v.currentTime = Math.min(Math.max(0, v.currentTime + delta), duration.value)
  showFlash(delta < 0 ? 'chevron-left' : 'chevron-right', `${Math.abs(delta)}s`)
}

const seekTo = (e: Event) => {
  if (videoRef.value) videoRef.value.currentTime = Number((e.target as HTMLInputElement).value)
}

const toggleMute = () => {
  if (videoRef.value) videoRef.value.muted = !videoRef.value.muted
}

const setVolume = (e: Event) => {
  const v = videoRef.value
  if (!v) return
  v.volume = Number((e.target as HTMLInputElement).value)
  v.muted = v.volume === 0
}

const setSpeed = (s: number) => {
  speed.value = s
  if (videoRef.value) videoRef.value.playbackRate = s
  try {
    localStorage.setItem(SPEED_KEY, String(s))
  } catch {
    // preferência só vale nesta sessão
  }
  speedOpen.value = false
}
onClickOutside(speedMenu, () => (speedOpen.value = false))

const toggleFullscreen = async () => {
  if (!container.value) return
  if (document.fullscreenElement) await document.exitFullscreen()
  else await container.value.requestFullscreen().catch(() => {})
}

const showFlash = (icon: NonNullable<typeof flash.value>['icon'], label?: string) => {
  flash.value = { icon, label, id: Date.now() }
  clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => (flash.value = null), 600)
}

const revealControls = () => {
  showControls.value = true
  clearTimeout(hideTimer)
  if (isPlaying.value && !speedOpen.value) hideTimer = window.setTimeout(() => (showControls.value = false), 2600)
}

// ---------- eventos do <video> ----------
const onTimeUpdate = () => {
  const v = videoRef.value
  if (!v) return
  currentTime.value = v.currentTime
  if (v.buffered.length) buffered.value = v.buffered.end(v.buffered.length - 1)
  emit('progress', v.currentTime, duration.value)
}

const onLoadedMetadata = () => {
  const v = videoRef.value
  if (!v) return
  duration.value = v.duration
  v.playbackRate = speed.value
  if (props.startAt && props.startAt < v.duration - 5) v.currentTime = props.startAt
}

const onVolumeChange = () => {
  const v = videoRef.value
  if (!v) return
  isMuted.value = v.muted
  volume.value = v.volume
}

watch(isPlaying, revealControls)
useEventListener(document, 'fullscreenchange', () => (isFullscreen.value = !!document.fullscreenElement))

// ---------- teclado (só com o foco dentro do player) ----------
const onKeydown = (e: KeyboardEvent) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const target = e.target as HTMLElement
  const key = e.key.toLowerCase()
  // sliders e botões tratam as próprias teclas
  if (target.tagName === 'INPUT' && key.startsWith('arrow')) return
  if (target.tagName === 'BUTTON' && (key === ' ' || key === 'enter')) return
  const actions: Record<string, () => void> = {
    ' ': togglePlay,
    k: togglePlay,
    arrowleft: () => seekBy(-10),
    arrowright: () => seekBy(10),
    j: () => seekBy(-10),
    l: () => seekBy(10),
    m: toggleMute,
    f: toggleFullscreen,
  }
  if (actions[key]) {
    e.preventDefault()
    actions[key]!()
    revealControls()
  } else if (/^[0-9]$/.test(key) && duration.value && videoRef.value) {
    videoRef.value.currentTime = (Number(key) / 10) * duration.value
    revealControls()
  }
}
</script>

<template>
  <div
    ref="container"
    class="player relative w-full aspect-video bg-black overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/70"
    :class="{ 'cursor-none': !showControls && isPlaying }"
    tabindex="0"
    role="region"
    aria-label="Player de vídeo. Atalhos: espaço para reproduzir ou pausar, setas para voltar ou avançar 10 segundos, M para som, F para tela cheia."
    @mousemove="revealControls"
    @mouseleave="isPlaying && (showControls = false)"
    @keydown="onKeydown"
    @focusin="revealControls"
  >
    <video
      ref="videoRef"
      class="w-full h-full object-contain"
      :poster="poster"
      playsinline
      crossorigin="anonymous"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @waiting="waiting = true"
      @playing="waiting = false"
      @canplay="waiting = false"
      @timeupdate="onTimeUpdate"
      @progress="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @volumechange="onVolumeChange"
      @ended="emit('ended')"
      @error="failed = true"
      @click="togglePlay"
      @dblclick="toggleFullscreen"
    ></video>

    <!-- erro -->
    <div v-if="failed" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 text-center p-6">
      <Icon name="alert" :size="28" class="text-white/60" />
      <p class="text-white font-semibold">Não foi possível carregar o vídeo</p>
      <p class="text-sm text-white/60 max-w-xs">Verifique sua conexão e tente novamente.</p>
      <button class="btn-glass mt-2" @click="init">Tentar de novo</button>
    </div>

    <!-- carregando -->
    <div v-else-if="waiting" class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <Icon name="spinner" :size="40" class="text-white/80" />
    </div>

    <!-- feedback visual de atalho/clique -->
    <Transition name="flash">
      <div v-if="flash" :key="flash.id" class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="glass-surface rounded-full w-20 h-20 flex flex-col items-center justify-center text-white">
          <Icon :name="flash.icon" :size="26" />
          <span v-if="flash.label" class="text-[11px] font-semibold mt-0.5">{{ flash.label }}</span>
        </div>
      </div>
    </Transition>

    <!-- botão grande quando pausado -->
    <button
      v-if="!isPlaying && !failed && !waiting && !flash"
      class="absolute inset-0 m-auto w-20 h-20 rounded-full glass-surface flex items-center justify-center text-white hover:bg-white/15 motion-safe:hover:scale-105 transition focus-ring"
      :aria-label="currentTime > 0 ? 'Continuar' : 'Reproduzir'"
      @click="togglePlay"
    >
      <Icon name="play" :size="30" class="ml-1" />
    </button>

    <div
      class="absolute inset-x-0 top-0 p-4 md:p-6 flex justify-between items-start transition-opacity duration-300 pointer-events-none [&>*]:pointer-events-auto"
      :class="showControls ? 'opacity-100' : 'opacity-0'"
    >
      <slot name="top-left" />
      <slot name="top-right" />
    </div>

    <!-- controles -->
    <div
      v-if="!failed"
      class="absolute inset-x-0 bottom-0 pt-16 px-3 pb-3 md:px-4 md:pb-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-300"
      :class="showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <!-- barra de tempo -->
      <div class="seekbar relative h-4 flex items-center group/seek mb-1">
        <div class="track absolute inset-x-0 h-1 group-hover/seek:h-1.5 transition-all rounded-full bg-white/20 overflow-hidden pointer-events-none">
          <div class="absolute inset-y-0 left-0 bg-white/30" :style="{ width: `${bufferedPct}%` }"></div>
          <div class="absolute inset-y-0 left-0 bg-accent-gold" :style="{ width: `${playedPct}%` }"></div>
        </div>
        <div class="absolute w-3.5 h-3.5 rounded-full bg-white shadow pointer-events-none scale-0 group-hover/seek:scale-100 transition-transform" :style="{ left: `calc(${playedPct}% - 7px)` }"></div>
        <input
          type="range"
          min="0"
          :max="duration || 0"
          step="0.1"
          :value="currentTime"
          aria-label="Posição do vídeo"
          :aria-valuetext="`${fmt(currentTime)} de ${fmt(duration)}`"
          class="seek absolute inset-0 w-full opacity-0 cursor-pointer"
          @input="seekTo"
        >
      </div>

      <div class="flex items-center gap-1 md:gap-2 text-white">
        <button class="ctrl" :aria-label="isPlaying ? 'Pausar (K)' : 'Reproduzir (K)'" @click="togglePlay">
          <Icon :name="isPlaying ? 'pause' : 'play'" :size="22" />
        </button>
        <button class="ctrl !w-auto px-1.5" aria-label="Voltar 10 segundos (J)" @click="seekBy(-10)">
          <Icon name="chevron-left" :size="18" /><span class="text-[11px] font-bold -ml-0.5">10</span>
        </button>
        <button class="ctrl !w-auto px-1.5" aria-label="Avançar 10 segundos (L)" @click="seekBy(10)">
          <span class="text-[11px] font-bold -mr-0.5">10</span><Icon name="chevron-right" :size="18" />
        </button>

        <div class="flex items-center group/vol">
          <button class="ctrl" :aria-label="isMuted ? 'Ativar som (M)' : 'Silenciar (M)'" @click="toggleMute">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path v-if="isMuted || volume === 0" d="m23 9-6 6m0-6 6 6" />
              <path v-else d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
            </svg>
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="isMuted ? 0 : volume"
            aria-label="Volume"
            class="hidden md:block w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 focus:w-20 focus:opacity-100 transition-all accent-[#C6A15B]"
            @input="setVolume"
          >
        </div>

        <span class="text-xs md:text-sm tabular-nums text-white/85 ml-1 whitespace-nowrap">{{ fmt(currentTime) }} <span class="text-white/45">/ {{ fmt(duration) }}</span></span>

        <div class="flex-1"></div>

        <div ref="speedMenu" class="relative">
          <button class="ctrl !w-auto px-2.5 text-sm font-semibold tabular-nums" :aria-expanded="speedOpen" aria-haspopup="menu" :aria-label="`Velocidade: ${speed}x`" @click="speedOpen = !speedOpen">
            {{ speed }}x
          </button>
          <div v-if="speedOpen" role="menu" aria-label="Velocidade de reprodução" class="absolute bottom-full right-0 mb-2 w-32 rounded-xl bg-[#141823]/95 border border-white/10 py-1.5 shadow-xl backdrop-blur-xl">
            <button
              v-for="s in SPEEDS"
              :key="s"
              role="menuitemradio"
              :aria-checked="s === speed"
              class="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-white/10 focus:bg-white/10 outline-none"
              :class="s === speed ? 'text-accent-gold font-semibold' : 'text-white/85'"
              @click="setSpeed(s)"
            >
              {{ s === 1 ? 'Normal' : `${s}x` }}
              <Icon v-if="s === speed" name="check" :size="14" />
            </button>
          </div>
        </div>

        <button class="ctrl" :aria-label="isFullscreen ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'" @click="toggleFullscreen">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path v-if="!isFullscreen" d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            <path v-else d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ctrl {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  transition: background-color 0.15s ease;
}
.ctrl:hover {
  background: rgb(255 255 255 / 0.12);
}
.ctrl:focus-visible {
  outline: 2px solid var(--color-accent-gold);
  outline-offset: 1px;
}
/* foco de teclado na barra de tempo fica visível mesmo com o input transparente */
.seekbar:has(.seek:focus-visible) .track {
  height: 0.375rem;
  outline: 2px solid var(--color-accent-gold);
  outline-offset: 3px;
}
.flash-enter-active {
  transition: opacity 0.1s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.flash-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.flash-enter-from {
  opacity: 0;
  transform: scale(0.85);
}
.flash-leave-to {
  opacity: 0;
  transform: scale(1.1);
}
@media (prefers-reduced-motion: reduce) {
  .flash-enter-active,
  .flash-leave-active {
    transition: none;
  }
}
</style>
