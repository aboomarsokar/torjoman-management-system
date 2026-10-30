<script setup lang="ts">
/**
 * نموذجُ التسجيل العامّ للمرشّحين (طلب المستخدم 2026-10-30): البياناتُ الأساسية والقرآنية والخبرة، ثم شاشةُ «استلمنا طلبك».
 * الأرقامُ العربية تُقبل وتُحوَّل، والتحقّقُ في `candidateDraftError` قبل الإرسال وفي القاعدة بعده.
 */
import { TAJWEED_LEVELS } from '~/constants/profileChoices'
import { MAX_CANDIDATE_LONG } from '~/constants/candidates'
import { blankCandidate } from '~/composables/useCandidateRegistration'

const emit = defineEmits<{ lookup: [] }>()
const { busy, error, register } = useCandidateRegistration()
const form = reactive(blankCandidate())
const done = ref(false)
const genderItems = [{ label: 'ذكر', value: 'male' }, { label: 'أنثى', value: 'female' }]
const tajweedItems = TAJWEED_LEVELS.map(l => ({ label: l, value: l }))

async function submit() {
  if (await register(form)) done.value = true
}
</script>

<template>
  <section
    v-if="done"
    class="jf-done"
  >
    <UIcon
      name="i-lucide-circle-check"
      class="size-12"
    />
    <h2>استلمنا طلبك</h2>
    <p>سنراجع بياناتك ونتواصل معك على رقم جوالك لتحديد موعد المقابلة. يمكنك متابعة حالة طلبك برقم هويتك وجوالك.</p>
    <UButton
      label="تابع حالة طلبي"
      icon="i-lucide-search"
      color="primary"
      variant="soft"
      :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
      @click="emit('lookup')"
    />
  </section>

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
        <UInput
          v-model="form.national_id"
          inputmode="numeric"
          dir="ltr"
          size="xl"
          class="w-full"
          maxlength="9"
        />
      </UFormField>
      <UFormField
        label="رقم الجوال"
        required
      >
        <UInput
          v-model="form.phone"
          inputmode="tel"
          autocomplete="tel"
          dir="ltr"
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
      <UFormField label="السكن">
        <UInput
          v-model="form.residence"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField label="أقرب مسجد">
        <UInput
          v-model="form.nearest_mosque"
          size="xl"
          class="w-full"
        />
      </UFormField>
    </fieldset>

    <fieldset class="jf-group">
      <legend>القرآن والخبرة</legend>
      <UFormField label="عدد الأجزاء المحفوظة">
        <UInput
          v-model="form.quran_parts"
          inputmode="numeric"
          dir="ltr"
          placeholder="0 – 30"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField label="مستوى التجويد">
        <UiSelect
          v-model="form.tajweed_level"
          :items="tajweedItems"
          placeholder="اختر إن وُجد"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="المؤهل العلمي والتخصص"
        class="span-2"
      >
        <UInput
          v-model="form.education"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="الخبرة في التحفيظ والتعليم"
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
.jf-done { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 24px 8px; color: var(--green-ink); }
.jf-done h2 { margin: 0; font-size: 22px; color: var(--ink); }
.jf-done p { margin: 0; color: var(--ink-2); line-height: 1.9; max-width: 440px; }
@media (max-width: 560px) {
  .jf-group { grid-template-columns: 1fr; }
  .span-2 { grid-column: auto; }
}
</style>
