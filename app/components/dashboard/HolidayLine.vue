<script setup lang="ts">
/**
 * سطرٌ هادئ «اليوم إجازة: <السبب>» أعلى لوحات الكادر (بلاغ «لم تنعقد» 2026-10-30): لا تصيّر شيئاً ما لم يكن اليومُ
 * إجازةً عامة. قراءتُه متّصلة وصامتةٌ عند الفشل (`useTodayHoliday`). لوحةُ المعلّم تعرض الإجازةَ ببند «المطلوب منك».
 */
const { reason } = useTodayHoliday()
</script>

<template>
  <p
    v-if="reason"
    class="hl"
    role="status"
  >
    <UIcon
      name="i-lucide-calendar-off"
      class="size-5 shrink-0"
    />
    <span>اليوم إجازة: {{ reason }}</span>
  </p>
</template>

<style scoped>
.hl { display: flex; align-items: center; gap: 10px; margin: -12px 0 20px; padding: 10px 14px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-2); font-size: 14.5px; font-weight: 600; line-height: 1.7; }
</style>
