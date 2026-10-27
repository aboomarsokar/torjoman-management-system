<script setup lang="ts">
/**
 * نموذجُ الرسالة المجدولة (طلب المستخدم 2026-10-27): العنوانُ والنصّ، والمستلمون (فئاتُ الكادر والإدارة والقسم)، والقناةُ
 * (داخل المنصّة و/أو SMS — للمدير الإداريّ)، والتكرارُ (مرّةً بيومٍ ووقت، أو أسبوعياً بيومٍ من الأسبوع، أو شهرياً بيومٍ من الشهر).
 * المديرُ الفنيّ والمديرةُ الإدارية قسمُهما ثابت.
 */
import { SCHEDULE_ROLES, WEEKDAYS, blankSchedule, type ScheduleDraft } from '~/composables/useScheduledMessages'
import { gazaToday } from '~/utils/reportWindow'
import { timeOptions } from '~/utils/dateTimeField'

const props = defineProps<{ busy: boolean, initial: ScheduleDraft | null, editing: boolean, canSms: boolean, fixedSection: 'male' | 'female' | null }>()
const emit = defineEmits<{ save: [d: ScheduleDraft] }>()
const open = defineModel<boolean>('open', { required: true })

const form = reactive<ScheduleDraft>(blankSchedule())
watch(open, (o) => {
  if (o) Object.assign(form, props.initial ?? blankSchedule(props.fixedSection ?? 'all'))
})

const sectionItems = [{ label: 'القسمان', value: 'all' }, { label: 'البنين', value: 'male' }, { label: 'البنات', value: 'female' }]
const recurrenceItems = [{ label: 'مرّة واحدة', value: 'once' }, { label: 'أسبوعياً', value: 'weekly' }, { label: 'شهرياً', value: 'monthly' }]
const weekdayItems = WEEKDAYS.map((label, value) => ({ label, value })).filter(d => d.value !== 5) // الجمعةُ عطلة
const monthDayItems = Array.from({ length: 28 }, (_, i) => ({ label: String(i + 1), value: i + 1 }))
const times = timeOptions([form.run_time])
const today = gazaToday()

function toggleRole(key: string) {
  form.roles = form.roles.includes(key) ? form.roles.filter(r => r !== key) : [...form.roles, key]
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="editing ? 'تعديل الرسالة المجدولة' : 'رسالةٌ مجدولة جديدة'"
  >
    <template #body>
      <div class="sf">
        <UFormField label="العنوان">
          <UInput
            v-model="form.title"
            size="xl"
            class="w-full"
            placeholder="مثلاً: تذكير باجتماع المعلمين"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <UFormField
          label="التفاصيل (اختياريّة)"
          :hint="`${form.body.length} / 600`"
        >
          <UTextarea
            v-model="form.body"
            :rows="3"
            autoresize
            class="w-full"
            placeholder="مثلاً: الاجتماع الساعة 4 عصراً في مقرّ المشروع."
          />
        </UFormField>
        <UFormField label="المستلمون">
          <div class="roles">
            <UButton
              v-for="r in SCHEDULE_ROLES"
              :key="r.key"
              :label="r.label"
              :color="form.roles.includes(r.key) ? 'primary' : 'neutral'"
              :variant="form.roles.includes(r.key) ? 'solid' : 'outline'"
              size="sm"
              :ui="{ base: 'rounded-full min-h-9 px-4' }"
              @click="toggleRole(r.key)"
            />
          </div>
        </UFormField>
        <UFormField
          v-if="!fixedSection"
          label="القسم"
        >
          <UiSelect
            v-model="form.section"
            :items="sectionItems"
            size="lg"
            class="w-full"
          />
        </UFormField>
        <UFormField label="القناة">
          <div class="chan">
            <UCheckbox
              v-model="form.in_app"
              label="داخل المنصّة (رسائل الإدارة والجرس)"
            />
            <UCheckbox
              v-if="canSms"
              v-model="form.sms"
              label="SMS على الجوال (يُخصم من الرصيد)"
            />
          </div>
        </UFormField>
        <div class="two">
          <UFormField label="التكرار">
            <UiSelect
              v-model="form.recurrence"
              :items="recurrenceItems"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="form.recurrence === 'once'"
            label="اليوم"
          >
            <UInput
              v-model="form.run_date"
              type="date"
              :min="today"
              dir="ltr"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-else-if="form.recurrence === 'weekly'"
            label="يوم الأسبوع"
          >
            <UiSelect
              v-model="form.weekday"
              :items="weekdayItems"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-else
            label="يوم الشهر"
          >
            <UiSelect
              v-model="form.month_day"
              :items="monthDayItems"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="الوقت (بتوقيت غزة)">
            <UiSelect
              v-model="form.run_time"
              :items="times"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="open = false"
        />
        <UButton
          :label="editing ? 'احفظ' : 'جدوِل'"
          icon="i-lucide-calendar-clock"
          color="primary"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="emit('save', { ...form, roles: [...form.roles] })"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.sf { display: flex; flex-direction: column; gap: 14px; }
.roles { display: flex; flex-wrap: wrap; gap: 6px; }
.chan { display: flex; flex-direction: column; gap: 8px; }
.two { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
@media (max-width: 640px) { .two { grid-template-columns: 1fr; } }
</style>
