<script setup lang="ts">
/**
 * شريطُ «حفظ الحضور» العائمُ أسفل الشاشة: حالُ الحفظ (تعديلٌ لم يُحفظ · محفوظ · لم يُحفظ بعد) وزرُّ الحفظ. القرارُ في الصفحة.
 */
defineProps<{
  /** في المسوّدة تعديلٌ لم يُحفظ. */
  dirty: boolean
  /** سُجّل حضورُ اليوم من قبل. */
  held: boolean
  saving: boolean
  canSave: boolean
}>()
const emit = defineEmits<{ save: [] }>()
</script>

<template>
  <div
    class="save-bar"
    data-float-above
  >
    <span
      class="save-note"
      :class="{ warn: dirty }"
    >{{ dirty ? 'لديك تعديلٌ لم يُحفظ' : held ? 'كلُّ شيءٍ محفوظ' : 'لم يُحفظ بعد' }}</span>
    <UButton
      label="حفظ الحضور"
      icon="i-lucide-save"
      color="primary"
      size="lg"
      :loading="saving"
      :disabled="!canSave"
      :ui="{ base: 'min-h-12 rounded-xl font-semibold justify-center px-6' }"
      @click="emit('save')"
    />
  </div>
</template>

<style scoped>
.save-bar { position: sticky; bottom: 12px; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 4px; padding: 12px 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-lg); }
.save-note { font-size: 14px; font-weight: 600; color: var(--ink-3); }
.save-note.warn { color: var(--err); }
@media (max-width: 520px) {
  .save-bar :deep(button) { flex: 1 1 100%; }
}
</style>
