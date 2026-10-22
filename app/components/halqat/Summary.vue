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
// قسمُ المديرة الإدارية إناثٌ كلُّه (2026-10-22)
const { isWomenAdmin: fem } = usePermissions()
const items = computed<StatItem[]>(() => {
  const s = halqatSummary(props.rows)
  return [
    { key: 'halqat', icon: 'i-lucide-book-open', value: s.halqat, label: 'حلقة', sub: s.active === s.halqat ? 'كلّها نشطة' : `${s.active} نشطة` },
    { key: 'students', icon: 'i-lucide-graduation-cap', tone: 'green', value: s.students, label: fem.value ? 'طالبةً نشطة' : 'طالباً نشطاً' },
    { key: 'avg', icon: 'i-lucide-users', tone: 'neutral', value: String(s.perHalaqa), label: fem.value ? 'طالبةً في الحلقة متوسّطاً' : 'طالباً في الحلقة متوسّطاً' },
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
