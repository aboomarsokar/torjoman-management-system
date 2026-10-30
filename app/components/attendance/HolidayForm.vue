<script setup lang="ts">
/**
 * نموذجُ «إضافة إجازة» في شاشة أيام الإجازة: «من يوم — إلى يوم» (يومٌ واحدٌ إن تساويا) وسببٌ نصٌّ حرّ حتى 80 حرفاً.
 * لا يكتب شيئاً: يرفع `submit` بالمدى والسببِ المشذَّب فتؤكّده الصفحةُ. الجُمَعُ في المدى تُتخطّى تلقائياً.
 * والتاريخُ لا يسبق بدايةَ المشروع (المنتقي)، ولا يتجاوز أفقَ التعيين.
 */
import { HOLIDAY_REASON_MAX } from '~/constants/holidays'
import { cleanHolidayReason } from '~/utils/holidays'

defineProps<{
  /** آخرُ يومٍ يُختار (اليوم + أفق التعيين). */
  max: string
  /** الطلبُ جارٍ — يعطّل الزرّ. */
  busy: boolean
}>()
const emit = defineEmits<{ submit: [payload: { from: string, to: string, reason: string }] }>()

const from = defineModel<string>('from', { required: true })
const to = defineModel<string>('to', { required: true })
const reason = ref('')
const cleaned = computed(() => cleanHolidayReason(reason.value))

// «إلى» لا يسبق «من»: رفعُ «من» فوقه يرفعه معه
watch(from, (v) => {
  if (to.value < v) to.value = v
})

function submit() {
  if (cleaned.value) emit('submit', { from: from.value, to: to.value, reason: cleaned.value })
}

/** بعد نجاح الإضافة تُفرَّغ خانةُ السبب. */
function reset() {
  reason.value = ''
}
defineExpose({ reset })
</script>

<template>
  <form
    class="card hf"
    @submit.prevent="submit"
  >
    <div class="pf">
      <label>من يوم</label>
      <AttendanceDayPicker
        v-model="from"
        :max="max"
      />
    </div>
    <div class="pf">
      <label>إلى يوم</label>
      <AttendanceDayPicker
        v-model="to"
        :max="max"
      />
    </div>
    <div class="pf wide">
      <label for="holiday-reason">السبب</label>
      <UInput
        id="holiday-reason"
        v-model="reason"
        size="lg"
        class="w-full"
        placeholder="مثل: عيد الفطر، أو ظرفٌ أمني"
        :maxlength="HOLIDAY_REASON_MAX"
        :ui="{ base: 'rounded-[13px] min-h-12' }"
      />
    </div>
    <UButton
      type="submit"
      label="إضافة إجازة"
      icon="i-lucide-calendar-plus"
      size="lg"
      :loading="busy"
      :disabled="!cleaned"
      :ui="{ base: 'rounded-[13px] font-semibold min-h-12 justify-center' }"
    />
    <p class="note">
      الجُمَعُ في المدى تُتخطّى تلقائياً، والحضورُ الذي سُجّل قبل تعيين الإجازة يبقى كما هو.
    </p>
  </form>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 20px; margin-bottom: 16px; }
.hf { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.pf { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 8px; }
.pf.wide { flex: 2 1 280px; }
.pf label { font-size: 13px; font-weight: 600; color: var(--ink-2); }
.note { flex-basis: 100%; margin: 0; font-size: 13px; color: var(--ink-3); }
</style>
