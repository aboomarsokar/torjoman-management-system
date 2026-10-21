<script setup lang="ts">
/**
 * خلاصةُ الحلقات المعروضة فوق قائمتها (طلب المستخدم 2026-10-21): عددُها ونشطُها، والطلابُ، ومتوسّطُ الحلقة،
 * والفئتان. تتبع التصفية (تُمرَّر الصفوفُ بعدها)، والحسابُ في `halqatSummary` (مختبَر).
 */
import type { StatItem } from '~/components/ui/StatStrip.vue'
import { SHOW_HALAQA_CLASSIFICATION } from '~/constants/halqat'
import type { SummaryHalaqa } from '~/utils/halqatSummary'
import { halqatSummary } from '~/utils/halqatSummary'

const props = defineProps<{ rows: SummaryHalaqa[] }>()
const items = computed<StatItem[]>(() => {
  const s = halqatSummary(props.rows)
  return [
    { key: 'halqat', icon: 'i-lucide-book-open', value: s.halqat, label: s.active === s.halqat ? 'حلقة — كلّها نشطة' : `حلقة — ${s.active} نشطة` },
    { key: 'students', icon: 'i-lucide-graduation-cap', tone: 'green', value: s.students, label: 'طالباً نشطاً' },
    { key: 'avg', icon: 'i-lucide-users', tone: 'neutral', value: String(s.perHalaqa), label: 'طالباً في الحلقة متوسّطاً' },
    // التصنيفُ ملغًى حاليّاً (constants/halqat.ts)
    ...(SHOW_HALAQA_CLASSIFICATION ? [{ key: 'class', icon: 'i-lucide-layers', value: `أ ${s.classA} · ب ${s.classB}`, label: 'الفئتان' }] : [])
  ]
})
</script>

<template>
  <UiStatStrip
    :items="items"
    label="خلاصة الحلقات"
  />
</template>
