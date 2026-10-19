<script setup lang="ts">
/**
 * منتقي الشهر بالأرقام: سهما شهرٍ سابق/لاحق، وشهرٌ `01..12` وسنة. لا شهرَ بعد `max`
 * (شهرُ اليوم بتوقيت غزة)، وتغييرُ السنة إلى سنة `max` يُرجع الشهرَ المستقبليّ إلى حدّه.
 */
import { PERIOD_YEARS_BACK as YEARS_BACK } from '~/utils/quran/screen'

const props = defineProps<{ max: { year: number, month: number }, disabled?: boolean }>()
const year = defineModel<number>('year', { required: true })
const month = defineModel<number>('month', { required: true })

const atMax = computed(() => year.value * 12 + month.value >= props.max.year * 12 + props.max.month)
const atMin = computed(() => year.value <= props.max.year - YEARS_BACK && month.value <= 1)
const monthOptions = computed(() => Array.from({ length: 12 }, (_, i) => i + 1)
  .filter(m => year.value < props.max.year || m <= props.max.month)
  .map(m => ({ label: String(m).padStart(2, '0'), value: m })))
const yearOptions = computed(() => Array.from({ length: YEARS_BACK + 1 }, (_, i) => props.max.year - YEARS_BACK + i)
  .map(y => ({ label: String(y), value: y })))

const yearModel = computed<number>({
  get: () => year.value,
  set: (y) => {
    year.value = y
    if (y === props.max.year && month.value > props.max.month) month.value = props.max.month
  }
})

function step(by: number) {
  const next = shiftMonth(year.value, month.value, by)
  if (next.year * 12 + next.month > props.max.year * 12 + props.max.month) return
  if (next.year < props.max.year - YEARS_BACK) return
  // تُبدَّل القيمتان في دورةٍ واحدة فيُحمَّل الشهرُ الجديد مرّةً واحدة
  year.value = next.year
  month.value = next.month
}
</script>

<template>
  <div class="mp">
    <!-- في الواجهة اليمينية: السهمُ إلى اليمين يعني الرجوعَ إلى الشهر السابق -->
    <UButton
      color="neutral"
      variant="outline"
      size="lg"
      icon="i-lucide-chevron-right"
      aria-label="الشهر السابق"
      class="mp-step"
      :disabled="disabled || atMin"
      :ui="{ base: 'rounded-[13px] justify-center' }"
      @click="step(-1)"
    />
    <UiSelect
      v-model="month"
      :items="monthOptions"
      size="lg"
      class="mp-field"
      aria-label="الشهر"
      :disabled="disabled"
    />
    <span
      class="mp-sep"
      aria-hidden="true"
    >-</span>
    <UiSelect
      v-model="yearModel"
      :items="yearOptions"
      size="lg"
      class="mp-field"
      aria-label="السنة"
      :disabled="disabled"
    />
    <UButton
      color="neutral"
      variant="outline"
      size="lg"
      icon="i-lucide-chevron-left"
      aria-label="الشهر التالي"
      class="mp-step"
      :disabled="disabled || atMax"
      :ui="{ base: 'rounded-[13px] justify-center' }"
      @click="step(1)"
    />
  </div>
</template>

<style scoped>
/* يملأ عرضَ حاويته: السهمان ثابتان والحقلان يتقاسمان الباقي */
.mp { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; }
.mp-step { flex: none; min-width: 48px; min-height: 48px; }
.mp-field { flex: 1 1 0; width: auto; min-width: 0; min-height: 48px; font-variant-numeric: tabular-nums; }
.mp-sep { flex: none; color: var(--ink-3); }
/* جوال ضيّق: يضيق الصفّ بالحقلين لا بالسهمين (أهدافُ اللمس تبقى ≥ 44px) */
@media (max-width: 480px) {
  .mp { gap: 4px; }
  .mp-step { min-width: 44px; min-height: 44px; }
  .mp-field { padding-inline: 8px 24px; }
  .mp-field :deep([data-slot='trailing']) { padding-inline-end: 6px; }
}
</style>
