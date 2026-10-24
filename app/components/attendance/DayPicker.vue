<script setup lang="ts">
/**
 * منتقي اليوم: سهما يومٍ سابق/لاحق وزرٌّ يفتح تقويماً (السبت أول الأسبوع، أرقام لاتينية).
 * v-model نصٌّ `YYYY-MM-DD`، لا يتجاوز `max` (اليوم بغزة)، ويُعرض `DD-MM-YYYY`.
 * الجمعةُ عطلة: السهمان يتخطّيانها، وهي معطّلةٌ في التقويم (قرار المستخدم 2026-10-24).
 */
import { CalendarDate, parseDate, type DateValue } from '@internationalized/date'
import { isFriday } from '~/utils/reportWindow'

const props = defineProps<{ max: string, disabled?: boolean }>()
const day = defineModel<string>({ required: true })

const LOCALE = 'ar-u-nu-latn'
const SATURDAY = 6
const open = ref(false)

const calendarValue = computed<DateValue | undefined>({
  get: () => (day.value ? parseDate(day.value) : undefined),
  set: (d) => {
    if (!d) return
    day.value = new CalendarDate(d.year, d.month, d.day).toString()
    open.value = false
  }
})
const maxValue = computed(() => parseDate(props.max))
const fridayUnavailable = (d: DateValue) => isFriday(d.toString())

// اليومُ التالي/السابق مع تخطّي الجمعة — والخميسُ «آخرُ يوم» إن كان الغدُ جمعةَ اليوم
function neighbour(by: number) {
  const next = parseDate(day.value).add({ days: by })
  return (isFriday(next.toString()) ? next.add({ days: by }) : next).toString()
}
const atMax = computed(() => neighbour(1) > props.max)

function step(by: number) {
  const next = neighbour(by)
  if (next <= props.max) day.value = next
}
</script>

<template>
  <div class="dp">
    <!-- في الواجهة اليمينية: السهمُ إلى اليمين يعني الرجوعَ إلى اليوم السابق -->
    <UButton
      color="neutral"
      variant="outline"
      size="lg"
      icon="i-lucide-chevron-right"
      aria-label="اليوم السابق"
      class="dp-step"
      :disabled="disabled"
      :ui="{ base: 'rounded-[13px] justify-center' }"
      @click="step(-1)"
    />
    <UPopover v-model:open="open">
      <UButton
        color="neutral"
        variant="outline"
        size="lg"
        icon="i-lucide-calendar-days"
        class="dp-date"
        :label="formatDay(day)"
        :disabled="disabled"
        :ui="{ base: 'rounded-[13px] justify-center' }"
      />
      <template #content>
        <UCalendar
          v-model="calendarValue"
          :locale="LOCALE"
          :week-starts-on="SATURDAY"
          :max-value="maxValue"
          :is-date-unavailable="fridayUnavailable"
          class="p-2"
        />
      </template>
    </UPopover>
    <UButton
      color="neutral"
      variant="outline"
      size="lg"
      icon="i-lucide-chevron-left"
      aria-label="اليوم التالي"
      class="dp-step"
      :disabled="disabled || atMax"
      :ui="{ base: 'rounded-[13px] justify-center' }"
      @click="step(1)"
    />
  </div>
</template>

<style scoped>
/* يملأ عرضَ حاويته: السهمان ثابتان وحقلُ التاريخ يأخذ الباقي */
.dp { display: flex; align-items: center; gap: 8px; width: 100%; }
.dp-step { flex: none; min-width: 48px; min-height: 48px; }
.dp-date { flex: 1 1 0; min-width: 0; min-height: 48px; justify-content: center; font-variant-numeric: tabular-nums; }
</style>
