<script setup lang="ts">
import { computed } from 'vue'

/**
 * Renderiza o texto da aula com um subconjunto seguro de markdown:
 * parágrafos, **negrito**, *itálico*, listas (- / 1.), títulos (#, ##) e links.
 * Todo HTML do autor é escapado antes — nada é injetado cru.
 */
const props = defineProps<{ source: string }>()

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const inline = (s: string) =>
  escape(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

const html = computed(() => {
  const blocks = props.source.replace(/\r\n/g, '\n').split(/\n{2,}/)
  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.trim())
      if (!lines.length) return ''
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`
      if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`
      const heading = lines[0]!.match(/^(#{1,3})\s+(.*)$/)
      if (heading && lines.length === 1) return `<h${heading[1]!.length + 1}>${inline(heading[2]!)}</h${heading[1]!.length + 1}>`
      return `<p>${lines.map(inline).join('<br>')}</p>`
    })
    .join('')
})
</script>

<template>
  <div class="lesson-content" v-html="html"></div>
</template>

<style scoped>
.lesson-content {
  line-height: 1.75;
  color: rgb(246 244 238 / 0.88);
}
.lesson-content :deep(p),
.lesson-content :deep(ul),
.lesson-content :deep(ol) {
  margin-bottom: 1rem;
}
.lesson-content :deep(ul) {
  list-style: disc;
  padding-left: 1.25rem;
}
.lesson-content :deep(ol) {
  list-style: decimal;
  padding-left: 1.25rem;
}
.lesson-content :deep(li) {
  margin-bottom: 0.35rem;
}
.lesson-content :deep(strong) {
  color: #fff;
  font-weight: 700;
}
.lesson-content :deep(h2),
.lesson-content :deep(h3),
.lesson-content :deep(h4) {
  color: #fff;
  font-weight: 700;
  margin: 1.5rem 0 0.75rem;
  font-size: 1.15rem;
}
.lesson-content :deep(a) {
  color: var(--color-accent-gold);
  text-decoration: underline;
}
</style>
