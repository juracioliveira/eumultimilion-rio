<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  tag?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}>();

const tag = computed(() => props.tag || 'div');

const paddingClass = computed(() => {
  switch (props.padding) {
    case 'none': return 'p-0';
    case 'sm': return 'p-4';
    case 'lg': return 'p-8';
    case 'md':
    default:
      return 'p-6';
  }
});
</script>

<template>
  <component 
    :is="tag" 
    class="glass-surface rounded-2xl md:rounded-[28px] overflow-hidden"
    :class="[
      paddingClass,
      interactive ? 'transition-transform hover:scale-[1.02] cursor-pointer focus-ring' : ''
    ]"
    v-bind="$attrs"
  >
    <slot></slot>
  </component>
</template>
