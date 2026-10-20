<script setup lang="ts">
/**
 * بطاقةُ طالبٍ في كشف الإنجاز القرآني — هويّةٌ ثمّ وقائعُ ثمّ فعل: الاسمُ وما وصل إليه من الأجزاء
 * (أو «خَتم»)، ثم شاراتُ الشهر (الصفحاتُ وأجزاؤها، المطلوبُ والتصنيف، الحضور، حالةُ الرصد)، ثم زرٌّ
 * «رصد» / «تعديل» / «عرض» بحسب ما يملكه الناظر (`cardAction`)؛ وما رُصد في الحلقة السابقة تحمله شارةٌ محايدة بدل حالة تقرير هذه الحلقة ويُعرض للقراءة وحدَها. لا منطقَ هنا غيرُ العرض.
 */
import { PROGRAM_JUZ_COUNT, monthlyJuzLabel } from '~/constants/quran'
import type { StudentMonthRow } from '~/utils/quran/month'
import type { CardAction, ReportStatus } from '~/utils/quran/screen'
import { OUTCOME_COLORS, REPORT_STATUS_COLORS, REPORT_STATUS_LABELS, planBadge, positionLabel } from '~/utils/quran/screen'

const props = defineProps<{
  row: StudentMonthRow
  /** حالةُ رصد الشهر للحلقة (null = لم يبدأ). */
  status: ReportStatus | null
  action: CardAction | null
  surahName: (n: number) => string
}>()
const emit = defineEmits<{ open: [] }>()

const ACTIONS: Record<CardAction, { label: string, icon: string, color: 'primary' | 'neutral', variant: 'soft' | 'outline' }> = {
  record: { label: 'رصد', icon: 'i-lucide-pen-line', color: 'primary', variant: 'soft' },
  edit: { label: 'تعديل', icon: 'i-lucide-pencil', color: 'neutral', variant: 'outline' },
  view: { label: 'عرض', icon: 'i-lucide-eye', color: 'neutral', variant: 'outline' }
}

const progressText = computed(() => props.row.khatm ? 'خَتم القرآن' : `وصل ${props.row.juzDone} من ${PROGRAM_JUZ_COUNT} جزءاً`)
const record = computed(() => props.row.record)
const rangeText = computed(() => {
  const r = record.value
  if (!r) return null
  if (!r.from) return 'لم يحفظ جديداً هذا الشهر'
  return `من ${positionLabel(r.from, props.surahName)} إلى ${positionLabel(r.to, props.surahName)}`
})
const pagesText = computed(() => {
  const r = record.value
  if (!r) return null
  const juz = monthlyJuzLabel(r.pagesMemorized)
  return juz ? `${r.pagesMemorized} صفحة · ${juz}` : `${r.pagesMemorized} صفحة`
})
const statusKey = computed(() => props.status ?? 'none')
const button = computed(() => props.action ? ACTIONS[props.action] : null)
</script>

<template>
  <article class="sc">
    <div class="who">
      <h3 class="name">
        {{ row.name }}
      </h3>
      <span
        class="progress"
        :class="{ khatm: row.khatm }"
      >{{ progressText }}</span>
      <span
        v-if="rangeText"
        class="range"
      >{{ rangeText }}</span>
    </div>
    <div class="facts">
      <UBadge
        v-if="pagesText"
        color="primary"
        variant="soft"
        size="lg"
        :label="pagesText"
      />
      <UBadge
        :color="OUTCOME_COLORS[row.outcome]"
        variant="soft"
        size="lg"
        :label="planBadge(row)"
      />
      <UBadge
        color="neutral"
        variant="outline"
        size="lg"
        :label="row.daysHeld ? `حضر ${row.daysAttended} من ${row.daysHeld}` : 'لا أيامَ للحلقة بعد'"
      />
      <UBadge
        v-if="row.recordedElsewhere"
        color="neutral"
        variant="subtle"
        size="lg"
        icon="i-lucide-history"
        label="رُصد في حلقته السابقة"
      />
      <UBadge
        v-else-if="record"
        :color="REPORT_STATUS_COLORS[statusKey]"
        variant="subtle"
        size="lg"
        :label="REPORT_STATUS_LABELS[statusKey]"
      />
    </div>
    <UButton
      v-if="button"
      :label="button.label"
      :icon="button.icon"
      :color="button.color"
      :variant="button.variant"
      size="lg"
      block
      class="act"
      :aria-label="`${button.label} — ${row.name}`"
      :ui="{ base: 'rounded-[13px] justify-center font-semibold' }"
      @click="emit('open')"
    />
  </article>
</template>

<style scoped>
.sc { display: flex; flex-direction: column; gap: 10px; padding: 16px 20px; }
.who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.name { margin: 0; font-size: 16.5px; font-weight: 600; color: var(--ink); }
.progress { font-size: 13.5px; color: var(--ink-2); }
.progress.khatm { color: var(--green-ink); font-weight: 600; }
.range { font-size: 13.5px; color: var(--ink-3); }
.facts { display: flex; flex-wrap: wrap; gap: 6px; }
.act { min-height: 44px; }

@media (min-width: 900px) {
  .sc { flex-direction: row; align-items: center; gap: 16px; }
  .who { flex: 0 0 260px; }
  .facts { flex: 1; }
  .act { width: auto; flex: 0 0 140px; }
}
</style>
