<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import Hls from 'hls.js';
import { useEventListener } from '@vueuse/core';

const props = defineProps<{
  src: string;
  poster?: string;
  /** Segundos já assistidos — o vídeo retoma desse ponto. */
  startAt?: number;
}>();

const emit = defineEmits<{
  (e: 'progress', watchedSeconds: number, totalSeconds: number): void;
  (e: 'ended'): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const playerContainer = ref<HTMLDivElement | null>(null);
let hlsInstance: Hls | null = null;

// Player State
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const isMuted = ref(false);
const isFullscreen = ref(false);
const showControls = ref(true);
let controlsTimeout: number | null = null;

// Progress bar formatting
const formatTime = (timeInSeconds: number) => {
  if (isNaN(timeInSeconds)) return "00:00";
  const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const initPlayer = () => {
  if (!videoRef.value || !props.src) return;

  const isHls = /\.m3u8(\?|$)/i.test(props.src);
  if (!isHls) {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    videoRef.value.src = props.src;
    return;
  }

  if (Hls.isSupported()) {
    if (hlsInstance) {
      hlsInstance.destroy();
    }
    
    hlsInstance = new Hls({
      maxMaxBufferLength: 30, // seconds
    });
    
    hlsInstance.loadSource(props.src);
    hlsInstance.attachMedia(videoRef.value);
    
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      // Ready to play
    });
  } else if (videoRef.value.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari fallback
    videoRef.value.src = props.src;
  }
};

watch(() => props.src, () => {
  initPlayer();
});

onMounted(() => {
  initPlayer();
  resetControlsTimeout();
});

onBeforeUnmount(() => {
  if (hlsInstance) {
    hlsInstance.destroy();
  }
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
});

// Controls Logic
const togglePlay = () => {
  if (!videoRef.value) return;
  if (videoRef.value.paused) {
    videoRef.value.play();
  } else {
    videoRef.value.pause();
  }
};

const toggleMute = () => {
  if (!videoRef.value) return;
  videoRef.value.muted = !videoRef.value.muted;
  isMuted.value = videoRef.value.muted;
};

const toggleFullscreen = async () => {
  if (!playerContainer.value) return;
  
  if (!document.fullscreenElement) {
    await playerContainer.value.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
};

const handleTimeUpdate = () => {
  if (!videoRef.value) return;
  currentTime.value = videoRef.value.currentTime;
  emit('progress', currentTime.value, duration.value);
};

const handleLoadedMetadata = () => {
  if (!videoRef.value) return;
  duration.value = videoRef.value.duration;
  // retoma de onde parou (se não estiver praticamente no fim)
  if (props.startAt && props.startAt < duration.value - 5) {
    videoRef.value.currentTime = props.startAt;
  }
};

const handleSeek = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const time = parseFloat(target.value);
  if (videoRef.value) {
    videoRef.value.currentTime = time;
    currentTime.value = time;
  }
};

const resetControlsTimeout = () => {
  showControls.value = true;
  if (controlsTimeout) clearTimeout(controlsTimeout);
  
  if (isPlaying.value) {
    controlsTimeout = window.setTimeout(() => {
      showControls.value = false;
    }, 2500); // Hide after 2.5s of inactivity
  }
};

// Event Listeners for DOM events
useEventListener(document, 'fullscreenchange', () => {
  isFullscreen.value = !!document.fullscreenElement;
});
</script>

<template>
  <div 
    ref="playerContainer"
    class="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl group flex flex-col justify-center transition-all duration-300"
    @mousemove="resetControlsTimeout"
    @mouseleave="() => { if (isPlaying) showControls = false; }"
    @click.self="togglePlay"
  >
    <!-- Video Element -->
    <video 
      ref="videoRef"
      class="w-full h-full object-contain cursor-pointer"
      :poster="poster"
      playsinline
      crossorigin="anonymous"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="handleLoadedMetadata"
      @ended="emit('ended')"
      @click="togglePlay"
    ></video>

    <!-- Overlay Gradient for better visibility of controls -->
    <div 
      class="absolute inset-0 pointer-events-none transition-opacity duration-500 bg-gradient-to-t from-black/80 via-transparent to-black/30"
      :class="showControls ? 'opacity-100' : 'opacity-0'"
    ></div>
    
    <!-- Big Play Button Overlay (when paused) -->
    <div 
      class="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300"
      :class="!isPlaying && showControls ? 'opacity-100' : 'opacity-0'"
    >
      <button 
        @click.stop="togglePlay"
        class="glass-surface w-20 h-20 rounded-full flex items-center justify-center text-white pointer-events-auto hover:bg-white/10 hover:scale-105 transition-all focus-ring shadow-xl"
      >
        <svg class="w-10 h-10 ml-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
    </div>

    <!-- Top Bar (Back button, etc. could go here) -->
    <div 
      class="absolute top-0 left-0 right-0 p-6 flex justify-between items-start transition-transform duration-500"
      :class="showControls ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'"
    >
       <slot name="top-left"></slot>
       <slot name="top-right"></slot>
    </div>

    <!-- Bottom Controls -->
    <div 
      class="absolute bottom-0 left-0 right-0 p-4 transition-all duration-500 transform"
      :class="showControls ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
    >
      <div class="glass-surface rounded-2xl p-4 flex flex-col gap-3">
        <!-- Seek Bar -->
        <div class="w-full relative h-2 group/scrubber cursor-pointer flex items-center">
          <input 
            type="range" 
            min="0" 
            :max="duration || 100" 
            :value="currentTime"
            @input="handleSeek"
            aria-label="Posição do vídeo"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          >
          <div class="absolute inset-0 rounded-full bg-white/20 overflow-hidden pointer-events-none">
            <div 
              class="h-full bg-accent-gold transition-all duration-100"
              :style="{ width: `${(currentTime / (duration || 1)) * 100}%` }"
            ></div>
          </div>
          <div 
            class="absolute h-4 w-4 bg-white rounded-full shadow z-10 pointer-events-none transition-transform duration-100 opacity-0 group-hover/scrubber:opacity-100 group-hover/scrubber:scale-125"
            :style="{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 8px)` }"
          ></div>
        </div>

        <!-- Buttons Row -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <!-- Play/Pause -->
            <button @click="togglePlay" :aria-label="isPlaying ? 'Pausar' : 'Reproduzir'" class="text-white hover:text-accent-gold transition-colors focus-ring rounded-full p-1">
              <svg v-if="!isPlaying" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <svg v-else class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            
            <!-- Mute/Unmute -->
            <button @click="toggleMute" :aria-label="isMuted ? 'Ativar som' : 'Silenciar'" class="text-white hover:text-white/80 transition-colors focus-ring rounded-full p-1 group">
              <svg v-if="isMuted" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
            
            <!-- Time -->
            <div class="text-sm font-medium text-white/90 tabular-nums">
              {{ formatTime(currentTime) }} <span class="text-white/50 mx-1">/</span> {{ formatTime(duration) }}
            </div>
          </div>

          <div class="flex items-center gap-4">
            <!-- Fullscreen -->
            <button @click="toggleFullscreen" aria-label="Tela cheia" class="text-white hover:text-white/80 transition-colors focus-ring rounded-full p-1">
              <svg v-if="!isFullscreen" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 14h4v4m0-4l-5 5m11-1h4v4m0-4l5 5M4 10h4V6m0 4L3 5m11 5h4V6m0 4l5-5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
