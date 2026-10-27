<script setup lang="ts">
/**
 * «طلبُ إضافة طالب» (المعلّم — طلب المستخدم 2026-10-27): الاسمُ الرباعيّ والهويةُ والميلادُ وجوالُ وليّ الأمر
 * ودورةُ الأحكام والسكنُ وأقربُ مسجد وملاحظة، والحلقةُ حلقتُه. يصل الطلبُ الإدارةَ فتُنشئ الحساب. التحقّقُ في
 * `useStudentRequests`، والقاعدةُ تحكم بعده (الهويةُ المسجّلة تُرفض هناك).
 */
import { TAJWEED_LEVELS, choiceItems } from '~/constants/profileChoices'
import { blankStudentRequest, type StudentRequestDraft } from '~/composables/useStudentRequests'
import { gazaToday } from '~/utils/reportWindow'

const props = defineProps<{ busy: boolean, female: boolean }>()
const emit = defineEmits<{ save: [draft: StudentRequestDraft] }>()
const open = defineModel<boolean>('open', { required: true })

const form = reactive<StudentRequestDraft>(blankStudentRequest())
watch(open, (o) => {
  if (o) Object.assign(form, blankStudentRequest())
})
const tajweedItems = choiceItems(TAJWEED_LEVELS)
const today = gazaToday()
const who = computed(() => (props.female ? 'الطالبة' : 'الطالب'))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="female ? 'طلبُ إضافة طالبة' : 'طلبُ إضافة طالب'"
    description="يصل طلبُك إلى الإدارة فتُضيف الحسابَ وتُشعرك."
  >
    <template #body>
      <div class="rf">
        <UFormField :label="`اسم ${who} رباعياً`">
          <UInput
            v-model="form.full_name"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <div class="two">
          <UFormField label="رقم الهوية">
            <UInput
              v-model="form.national_id"
              inputmode="numeric"
              maxlength="9"
              dir="ltr"
              size="xl"
              class="w-full"
              :ui="{ base: 'rounded-[12px] min-h-12 tabular-nums' }"
            />
          </UFormField>
          <UFormField label="تاريخ الميلاد">
            <UInput
              v-model="form.birth_date"
              type="date"
              :max="today"
              dir="ltr"
              size="xl"
              class="w-full"
              :ui="{ base: 'rounded-[12px] min-h-12' }"
            />
          </UFormField>
        </div>
        <div class="two">
          <UFormField label="جوال وليّ الأمر">
            <UInput
              v-model="form.guardian_phone"
              inputmode="tel"
              maxlength="10"
              dir="ltr"
              placeholder="05XXXXXXXX"
              size="xl"
              class="w-full"
              :ui="{ base: 'rounded-[12px] min-h-12 tabular-nums' }"
            />
          </UFormField>
          <UFormField label="آخر دورة أحكام">
            <UiSelect
              v-model="form.tajweed_level"
              :items="tajweedItems"
              placeholder="اختر"
              size="xl"
              class="w-full"
              :ui="{ base: 'rounded-[12px] min-h-12' }"
            />
          </UFormField>
        </div>
        <div class="two">
          <UFormField label="السكن">
            <UInput
              v-model="form.residence"
              size="xl"
              class="w-full"
              :ui="{ base: 'rounded-[12px] min-h-12' }"
            />
          </UFormField>
          <UFormField label="أقرب مسجد">
            <UInput
              v-model="form.nearest_mosque"
              size="xl"
              class="w-full"
              :ui="{ base: 'rounded-[12px] min-h-12' }"
            />
          </UFormField>
        </div>
        <UFormField label="ملاحظة (اختياريّة)">
          <UTextarea
            v-model="form.note"
            :rows="2"
            autoresize
            class="w-full"
          />
        </UFormField>
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
          label="أرسل الطلب"
          icon="i-lucide-send"
          color="primary"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="emit('save', { ...form })"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.rf { display: flex; flex-direction: column; gap: 14px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 560px) { .two { grid-template-columns: 1fr; } }
</style>
