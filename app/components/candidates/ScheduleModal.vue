<script setup lang="ts">
/**
 * دعوةُ مرشّحٍ أو أكثر إلى المقابلة (طلب المستخدم 2026-10-30): الموعدُ والمكانُ واللجنة (من الإداريين والمختبرين، يقيّم كلٌّ من حسابه).
 * يُعبّأ بموعد المرشّح ولجنته إن كان واحداً قد دُعي من قبل.
 */
import type { Candidate, CandidateScheduleDraft, CandidateStaffOption } from '~/composables/useCandidates'
import { CANDIDATE_COMMITTEE_ROLES, MAX_INTERVIEW_PLACE } from '~/constants/candidates'
import { roleLabel } from '~/constants/roles'

const props = defineProps<{ candidates: Candidate[], staff: CandidateStaffOption[], busy: boolean }>()
const emit = defineEmits<{ save: [draft: CandidateScheduleDraft] }>()
const open = defineModel<boolean>('open', { required: true })

const form = reactive({ at: '', place: '', committee: [] as string[] })
/** `YYYY-MM-DDTHH:mm` بتوقيت المتصفّح (كجدولة الزيارات) — للحقل المشترك `UiDateTimeField`. */
function toLocal(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
watch(open, (o) => {
  if (!o) return
  const one = props.candidates.length === 1 ? props.candidates[0] : null
  Object.assign(form, {
    at: one?.interview_at ? toLocal(one.interview_at) : '',
    place: one?.interview_place ?? '',
    committee: one ? [...one.committee] : []
  })
})
const staffItems = computed(() => props.staff.filter(s => (CANDIDATE_COMMITTEE_ROLES as readonly string[]).includes(s.role)).map(s => ({ label: `${s.name} · ${roleLabel(s.role, s.gender)}`, value: s.id })))
const title = computed(() => props.candidates.length === 1 ? `دعوة ${props.candidates[0]!.full_name} للمقابلة` : `دعوة ${props.candidates.length} مرشّحين للمقابلة`)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
  >
    <template #body>
      <div class="sm">
        <UFormField label="موعد المقابلة">
          <UiDateTimeField v-model="form.at" />
        </UFormField>
        <UFormField
          label="المكان (اختياري)"
          :hint="`${form.place.trim().length}/${MAX_INTERVIEW_PLACE}`"
        >
          <UInput
            v-model="form.place"
            size="xl"
            class="w-full"
            placeholder="مثال: مقرّ المشروع — الرمال"
            :maxlength="MAX_INTERVIEW_PLACE"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <UFormField
          label="لجنة التحكيم"
          hint="كلُّ عضوٍ يقيّم من حسابه"
        >
          <USelectMenu
            v-model="form.committee"
            :items="staffItems"
            value-key="value"
            multiple
            placeholder="اختر أعضاء اللجنة"
            :search-input="{ placeholder: 'ابحث بالاسم' }"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
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
          label="احفظ الدعوة"
          icon="i-lucide-calendar-check"
          color="primary"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="emit('save', { ids: candidates.map(c => c.id), at: form.at, place: form.place, committee: [...form.committee] })"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.sm { display: flex; flex-direction: column; gap: 14px; }
</style>
