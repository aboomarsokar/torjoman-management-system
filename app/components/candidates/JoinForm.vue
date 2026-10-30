<script setup lang="ts">
/**
 * نموذجُ التسجيل العامّ للمرشّحين (طلب المستخدم 2026-10-30): البياناتُ الأساسية، والسكنُ ومكانُ الحلقة، والقرآنُ والخبرة،
 * وسؤالا الالتزام، والإقرارُ بالشروط، ثم شاشةُ «استلمنا طلبك». من لا تنطبق عليه الشروط يسجّل ويُعلَّم للإدارة.
 * الأرقامُ العربية تُقبل وتُحوَّل، والتحقّقُ في `candidateDraftError` قبل الإرسال وفي القاعدة بعده.
 */
import { TAJWEED_LEVELS } from '~/constants/profileChoices'
import { CANDIDATE_PHONE_LENGTH, CANDIDATE_RESIDENCES, HALAQA_AREAS, MAX_ADDRESS_DETAIL, MAX_EXPERIENCE_YEARS, MAX_CANDIDATE_LONG, OTHER_AREA, SMALL_NUMBER_DIGITS } from '~/constants/candidates'
import { IDENTITY_LENGTH } from '~/constants/identity'
import { PROGRAM_JUZ_COUNT } from '~/constants/quran'
import { blankCandidate } from '~/composables/useCandidateRegistration'

const emit = defineEmits<{ lookup: [] }>()
const { busy, error, register } = useCandidateRegistration()
const form = reactive(blankCandidate())
const done = ref(false)
const genderItems = [{ label: 'ذكر', value: 'male' }, { label: 'أنثى', value: 'female' }]
const toItems = (list: readonly string[]) => list.map(l => ({ label: l, value: l }))
const tajweedItems = toItems(TAJWEED_LEVELS)
const residenceItems = toItems(CANDIDATE_RESIDENCES)
const areaItems = toItems(HALAQA_AREAS)

async function submit() {
  if (await register(form)) done.value = true
}
</script>

<template>
  <CandidatesJoinDone
    v-if="done"
    @lookup="emit('lookup')"
  />

  <form
    v-else
    class="jf"
    novalidate
    @submit.prevent="submit"
  >
    <fieldset class="jf-group">
      <legend>البيانات الأساسية</legend>
      <UFormField
        label="الاسم الرباعي"
        required
        class="span-2"
      >
        <UInput
          v-model="form.full_name"
          autocomplete="name"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="رقم الهوية"
        required
      >
        <UiDigitsInput
          v-model="form.national_id"
          :max="IDENTITY_LENGTH"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="رقم الجوال"
        required
      >
        <UiDigitsInput
          v-model="form.phone"
          :max="CANDIDATE_PHONE_LENGTH"
          autocomplete="tel"
          placeholder="05XXXXXXXX"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="الجنس"
        required
      >
        <UiSelect
          v-model="form.gender"
          :items="genderItems"
          placeholder="اختر"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField label="تاريخ الميلاد">
        <UInput
          v-model="form.birth_date"
          type="date"
          dir="ltr"
          size="xl"
          class="w-full"
        />
      </UFormField>
    </fieldset>

    <fieldset class="jf-group">
      <legend>السكن ومكان الحلقة</legend>
      <UFormField
        label="مكان السكن"
        required
      >
        <UiSelect
          v-model="form.residence"
          :items="residenceItems"
          placeholder="اختر"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-if="form.residence === OTHER_AREA"
        label="اكتب مكان السكن"
        required
      >
        <UInput
          v-model="form.residence_other"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="منطقة الحلقة"
        required
      >
        <UiSelect
          v-model="form.halaqa_area"
          :items="areaItems"
          placeholder="اختر"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-if="form.halaqa_area === OTHER_AREA"
        label="اكتب منطقة الحلقة"
        required
      >
        <UInput
          v-model="form.halaqa_area_other"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="اسم المسجد أو المصلّى"
        required
      >
        <UInput
          v-model="form.nearest_mosque"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="العنوان بالتفصيل"
        required
        class="span-2"
      >
        <UInput
          v-model="form.address_detail"
          placeholder="الحيّ، الشارع، أقرب معلم"
          size="xl"
          class="w-full"
          :maxlength="MAX_ADDRESS_DETAIL"
        />
      </UFormField>
    </fieldset>

    <fieldset class="jf-group">
      <legend>القرآن والخبرة</legend>
      <UFormField
        label="عدد الأجزاء المحفوظة"
        required
      >
        <UiDigitsInput
          v-model="form.quran_parts"
          :max="SMALL_NUMBER_DIGITS"
          :max-value="PROGRAM_JUZ_COUNT"
          placeholder="0 – 30"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="دورة التجويد المجتازة"
        required
      >
        <UiSelect
          v-model="form.tajweed_level"
          :items="tajweedItems"
          placeholder="اختر"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="سنوات الخبرة في التحفيظ"
        required
      >
        <UiDigitsInput
          v-model="form.experience_years"
          :max="SMALL_NUMBER_DIGITS"
          :max-value="MAX_EXPERIENCE_YEARS"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField label="المؤهل العلمي والتخصص">
        <UInput
          v-model="form.education"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="نبذة عن خبرتك في التحفيظ والتعليم"
        class="span-2"
      >
        <UTextarea
          v-model="form.experience"
          :rows="3"
          autoresize
          class="w-full"
          :maxlength="MAX_CANDIDATE_LONG"
        />
      </UFormField>
      <UFormField
        label="ما الذي تودّ إضافته؟"
        class="span-2"
      >
        <UTextarea
          v-model="form.about"
          :rows="2"
          autoresize
          class="w-full"
          :maxlength="MAX_CANDIDATE_LONG"
        />
      </UFormField>
    </fieldset>

    <CandidatesJoinCommitment
      v-model:gather="form.can_gather"
      v-model:daily="form.daily_commitment"
      v-model:terms="form.terms_accepted"
    />

    <p
      v-if="error"
      class="jf-err"
      role="alert"
    >
      <UIcon
        name="i-lucide-circle-alert"
        class="size-4.5"
      />{{ error }}
    </p>
    <UButton
      type="submit"
      label="أرسل الطلب"
      icon="i-lucide-send"
      color="primary"
      size="xl"
      block
      :loading="busy"
      :ui="{ base: 'rounded-[12px] min-h-12 font-semibold' }"
    />
  </form>
</template>

<style scoped>
.jf { display: flex; flex-direction: column; gap: 20px; }
.jf-group { border: 0; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; }
.jf-group legend { font-size: 15px; font-weight: 700; color: var(--ink); margin-bottom: 12px; padding: 0; }
.span-2 { grid-column: span 2; }
.jf-err { margin: 0; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; background: var(--err-soft); color: var(--err); font-weight: 600; font-size: 14px; }
@media (max-width: 560px) {
  .jf-group { grid-template-columns: 1fr; }
  .span-2 { grid-column: auto; }
}
</style>
