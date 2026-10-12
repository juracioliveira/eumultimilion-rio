<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  variant?: 'glass' | 'gold' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}>();

const baseClasses = 'inline-flex items-center justify-center font-medium rounded-full transition-all focus-ring';

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm': return 'px-4 py-1.5 text-sm';
    case 'lg': return 'px-8 py-3 text-lg';
    case 'md':
    default: return 'px-6 py-2.5 text-base';
  }
});

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'gold': 
      return 'bg-accent-gold text-bg-base hover:bg-opacity-90 font-semibold';
    case 'ghost':
      return 'text-text-primary hover:bg-white/10';
    case 'glass':
    default:
      return 'glass-surface hover:bg-white/10 text-text-primary';
  }
});
</script>

<template>
  <button 
    :class="[baseClasses, sizeClasses, variantClasses, disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer']"
    :disabled="disabled"
    v-bind="$attrs"
  >
    <slot></slot>
  </button>
</template>
