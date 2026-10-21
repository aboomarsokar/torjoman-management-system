<script setup lang="ts">
/**
 * خلاصةُ الحلقات المعروضة فوق قائمتها (طلب المستخدم 2026-10-21): عددُها ونشطُها، والطلابُ، ومتوسّطُ الحلقة،
 * والفئتان. تتبع التصفية (تُمرَّر الصفوفُ بعدها)، والحسابُ في `halqatSummary` (مختبَر).
 */
import type { SummaryHalaqa } from '~/utils/halqatSummary'
import { halqatSummary } from '~/utils/halqatSummary'

const props = defineProps<{ rows: SummaryHalaqa[] }>()
const s = computed(() => halqatSummary(props.rows))
</script>

<template>
  <section
    class="hs"
    aria-label="خلاصة الحلقات"
  >
    <UiStatCard
      icon="i-lucide-book-open"
      tone="blue"
      :value="s.halqat"
      :label="s.active === s.halqat ? 'حلقة — كلّها نشطة' : `حلقة — ${s.active} نشطة`"
      stacked
    />
    <UiStatCard
      icon="i-lucide-graduation-cap"
      tone="green"
      :value="s.students"
      label="طالباً نشطاً"
      stacked
    />
    <UiStatCard
      icon="i-lucide-users"
      tone="neutral"
      :value="String(s.perHalaqa)"
      label="طالباً في الحلقة متوسّطاً"
      stacked
    />
    <UiStatCard
      icon="i-lucide-layers"
      tone="blue"
      :value="`أ ${s.classA} · ب ${s.classB}`"
      label="الفئتان"
      stacked
    />
  </section>
</template>

<style scoped>
.hs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
@media (max-width: 900px) { .hs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
</style>
