<script setup lang="ts">
/**
 * حقل التاريخ والوقت — بديل datetime-local الأصليّ (كان يعرض «ةنس/رهش/موي» مقلوبةً، ويخلط
 * الأرقام الهندية باللاتينية، ويعرض عمود دقائقٍ دقيقةً دقيقة).
 * التاريخ: زرّ بالعربية يفتح تقويماً (السبت أوّل الأسبوع، أرقام لاتينية). الوقت: قائمة كل ربع ساعة «4:30 م».
 * v-model نصّ محلّي `YYYY-MM-DDTHH:mm` (كقيمة datetime-local) — لا يتغيّر شيء عند المستهلك.
 * `suggestedTime` يُملأ تلقائياً حين يُختار اليوم والوقت فارغ (وقت الحلقة اليومي مثلاً).
 * لا يومَ قبل بداية المشروع `PROJECT_START_DATE` (قرار المستخدم 2026-10-24).
 */
import { CalendarDate, parseDate, type DateValue } from '@internationalized/date'
import { PROJECT_START_DATE } from '~/constants/project'

interface Props {
  /** وقتٌ مقترح `HH:mm` يُملأ عند اختيار اليوم إن لم يُحدَّد وقت. */
  suggestedTime?: string | null
}
const props = defineProps<Props>()
const model = defineModel<string>({ default: '' })

const LOCALE = 'ar-u-nu-latn'
const SATURDAY = 6
const minValue = parseDate(PROJECT_START_DATE)

const parts = computed(() => splitDateTime(model.value))
const open = ref(false)
// اليوم المختار قبل اختيار الوقت (القيمة لا تكتمل إلا بالاثنين)
const pendingDate = ref('')

const calendarValue = computed<DateValue | undefined>({
  get: () => (parts.value.date ? parseDate(parts.value.date) : undefined),
  set: (d) => {
    if (!d) return
    const date = new CalendarDate(d.year, d.month, d.day).toString()
    const time = parts.value.time || validSuggested.value
    pendingDate.value = date
    model.value = joinDateTime(date, time)
    open.value = false
  }
})
const dateShown = computed(() => parts.value.date || pendingDate.value)
// المقترحُ يُقبل بصيغة `HH:MM` وحدها — غيرُها (كـ«4:00 م») يُفسد القيمة
const validSuggested = computed(() => normalizeSuggestedTime(props.suggestedTime))

const time = computed({
  get: () => parts.value.time,
  set: (t: string) => {
    model.value = joinDateTime(dateShown.value, t)
  }
})

const dateLabel = computed(() => {
  if (!dateShown.value) return ''
  const [y, m, d] = dateShown.value.split('-').map(Number)
  return new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(y!, m! - 1, d!))
})
const items = computed(() => timeOptions([parts.value.time, props.suggestedTime?.slice(0, 5)]))

// قيمةٌ جديدة من الخارج (فتح نافذة لزيارةٍ أخرى) تُسقط اليوم المعلّق
watch(model, (v) => {
  if (!v) pendingDate.value = ''
})
</script>

<template>
  <div class="dtf">
    <UPopover v-model:open="open">
      <UButton
        color="neutral"
        variant="outline"
        size="lg"
        icon="i-lucide-calendar-days"
        class="dtf-date"
        :class="{ empty: !dateLabel }"
        :label="dateLabel || 'اختر اليوم'"
        :ui="{ base: 'rounded-[13px] w-full justify-start' }"
      />
      <template #content>
        <UCalendar
          v-model="calendarValue"
          :locale="LOCALE"
          :week-starts-on="SATURDAY"
          :min-value="minValue"
          class="p-2"
        />
      </template>
    </UPopover>
    <USelect
      v-model="time"
      :items="items"
      :disabled="!dateShown"
      placeholder="الوقت"
      icon="i-lucide-clock"
      size="lg"
      class="dtf-time"
      :ui="{ base: 'rounded-[13px]' }"
    />
  </div>
</template>

<style scoped>
.dtf { display: flex; gap: 10px; flex-wrap: wrap; }
.dtf-date { flex: 1 1 220px; }
.dtf-date.empty :deep(span) { color: var(--ink-3); }
.dtf-time { flex: 0 1 150px; min-width: 130px; }
</style>
