<script setup lang="ts">
/**
 * تنبيهُ يوم الجمعة في «الحضور اليوميّ»: عطلةُ الحلقات بلا رصد، والشاشةُ تفتح على الخميس قبلها.
 */
defineProps<{
  /** الخميسُ المعروض (dd-mm-yyyy). */
  thursdayLabel: string
}>()
</script>

<template>
  <div
    class="holiday"
    role="status"
  >
    <UIcon
      name="i-lucide-calendar-off"
      class="size-6 shrink-0"
    />
    <div>
      <b>اليوم الجمعة — عطلةُ الحلقات</b>
      <span>لا يُسجَّل فيه حضور. يُعرض الخميس <bdi class="holiday-day">{{ thursdayLabel }}</bdi> لتُكمل حضوره إن لزم.</span>
    </div>
  </div>
</template>

<style scoped>
.holiday { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; margin-bottom: 16px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--blue) 40%, transparent); background: var(--blue-soft); color: var(--blue-ink); line-height: 1.6; }
.holiday b { display: block; font-size: 15.5px; font-weight: 700; }
.holiday span { font-size: 14.5px; font-weight: 500; }
.holiday-day { white-space: nowrap; font-variant-numeric: tabular-nums; }
</style>
