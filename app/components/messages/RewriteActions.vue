<script setup lang="ts">
/**
 * زرّا «أعد الصياغة» و«تراجع» بجوار مسوّدة رسالة (طلب المستخدم 2026-10-27) — يُستعملان في SMS ورسائل الكادر.
 * المنطقُ في useAiRewrite؛ هذا عرضٌ فقط.
 */
defineProps<{ busy: boolean, canUndo: boolean, disabled?: boolean }>()
const emit = defineEmits<{ rewrite: [], undo: [] }>()
</script>

<template>
  <div class="ra">
    <UButton
      label="أعد الصياغة"
      icon="i-lucide-sparkles"
      color="secondary"
      variant="soft"
      size="sm"
      :loading="busy"
      :disabled="disabled"
      :ui="{ base: 'rounded-full min-h-9 px-4 font-semibold' }"
      @click="emit('rewrite')"
    />
    <UButton
      v-if="canUndo && !busy"
      label="تراجع عن الصياغة"
      icon="i-lucide-undo-2"
      color="neutral"
      variant="ghost"
      size="sm"
      :ui="{ base: 'rounded-full min-h-9 px-3' }"
      @click="emit('undo')"
    />
    <span
      v-if="busy"
      class="ra-note"
      aria-live="polite"
    >جارٍ إعادة الصياغة…</span>
    <span
      v-else-if="canUndo"
      class="ra-note"
    >راجِع الصياغة المقترحة وعدّلها قبل الإرسال.</span>
  </div>
</template>

<style scoped>
.ra { display: flex; align-items: center; gap: 6px 10px; flex-wrap: wrap; }
.ra-note { font-size: 13px; color: var(--ink-3); }
</style>
