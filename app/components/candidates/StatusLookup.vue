<script setup lang="ts">
/** الاستعلامُ عن طلب الالتحاق برقم الهوية والجوال معاً (لا يُكشف طلبُ أحدٍ برقم هويته وحده). */
import { CANDIDATE_PUBLIC_STATUS } from '~/constants/candidates'
import type { CandidateLookup } from '~/composables/useCandidateRegistration'

const { busy, error, lookup } = useCandidateRegistration()
const form = reactive({ id: '', phone: '' })
const result = ref<CandidateLookup | null | undefined>(undefined)

async function check() {
  result.value = await lookup(form.id, form.phone)
}
const when = (iso: string) => new Date(iso).toLocaleString('ar-EG-u-nu-latn', {
  timeZone: 'Asia/Gaza', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
})
</script>

<template>
  <form
    class="sl"
    novalidate
    @submit.prevent="check"
  >
    <div class="sl-row">
      <UFormField label="رقم الهوية">
        <UInput
          v-model="form.id"
          inputmode="numeric"
          dir="ltr"
          size="xl"
          class="w-full"
          maxlength="9"
        />
      </UFormField>
      <UFormField label="رقم الجوال">
        <UInput
          v-model="form.phone"
          inputmode="tel"
          dir="ltr"
          placeholder="05XXXXXXXX"
          size="xl"
          class="w-full"
        />
      </UFormField>
    </div>
    <UButton
      type="submit"
      label="استعلم"
      icon="i-lucide-search"
      color="primary"
      size="xl"
      block
      :loading="busy"
      :disabled="!form.id.trim() || !form.phone.trim()"
      :ui="{ base: 'rounded-[12px] min-h-12 font-semibold' }"
    />
    <p
      v-if="error"
      class="sl-msg err"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-else-if="result === null"
      class="sl-msg"
      role="status"
    >
      لا يوجد طلبٌ بهذه البيانات. تأكّد من رقم الهوية والجوال كما سجّلتهما.
    </p>
    <div
      v-else-if="result"
      class="sl-result"
      role="status"
    >
      <b>{{ result.full_name }}</b>
      <span>{{ CANDIDATE_PUBLIC_STATUS[result.status] }}</span>
      <span
        v-if="result.interview_at"
        class="sl-when"
      >
        <UIcon
          name="i-lucide-calendar-clock"
          class="size-4.5"
        />
        {{ when(result.interview_at) }}<template v-if="result.interview_place"> · {{ result.interview_place }}</template>
      </span>
    </div>
  </form>
</template>

<style scoped>
.sl { display: flex; flex-direction: column; gap: 14px; }
.sl-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.sl-msg { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--surface-3); color: var(--ink-2); font-size: 14px; }
.sl-msg.err { background: var(--err-soft); color: var(--err); font-weight: 600; }
.sl-result { display: flex; flex-direction: column; gap: 6px; padding: 16px; border-radius: 14px; background: var(--blue-soft); color: var(--ink-2); line-height: 1.8; }
.sl-result b { color: var(--ink); font-size: 16px; }
.sl-when { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--blue-ink); }
@media (max-width: 560px) {
  .sl-row { grid-template-columns: 1fr; }
}
</style>
