<script setup lang="ts">
/** التنقّلُ بين أشهر خطة القسم: السابقُ والتالي حول تسمية الشهر («11-2026»). */
defineProps<{ label: string }>()
const emit = defineEmits<{ go: [by: number] }>()
</script>

<template>
  <div
    class="month"
    role="group"
    aria-label="الشهر"
  >
    <UButton
      icon="i-lucide-chevron-right"
      color="neutral"
      variant="ghost"
      aria-label="الشهر السابق"
      :ui="{ base: 'min-h-11 min-w-11 justify-center' }"
      @click="emit('go', -1)"
    />
    <b>{{ label }}</b>
    <UButton
      icon="i-lucide-chevron-left"
      color="neutral"
      variant="ghost"
      aria-label="الشهر التالي"
      :ui="{ base: 'min-h-11 min-w-11 justify-center' }"
      @click="emit('go', 1)"
    />
  </div>
</template>

<style scoped>
.month { display: inline-flex; align-items: center; gap: 4px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 0 4px; }
.month b { min-width: 76px; text-align: center; font-variant-numeric: tabular-nums; color: var(--ink); }
</style>
