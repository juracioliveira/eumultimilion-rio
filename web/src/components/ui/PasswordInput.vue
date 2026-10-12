<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'

defineProps<{ id: string; autocomplete: string; minlength?: number; required?: boolean; describedby?: string }>()
const model = defineModel<string>({ required: true })
const visible = ref(false)
</script>

<template>
  <div class="relative">
    <input
      :id="id"
      v-model="model"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :minlength="minlength"
      :required="required"
      :aria-describedby="describedby"
      class="field !pr-12"
    >
    <button
      type="button"
      class="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-white/50 hover:text-white focus-ring"
      :aria-label="visible ? 'Ocultar senha' : 'Mostrar senha'"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <Icon :name="visible ? 'eye-off' : 'eye'" :size="18" />
    </button>
  </div>
</template>
