<script setup lang="ts">
/**
 * قرارُ المرشّح في ملفّه — للمدير الإداريّ وحده (قرار المستخدم 2026-10-31؛ وحارسُ `candidate_touch` في القاعدة):
 * ملاحظةُ القرار ومقبول · تأهيل · مرفوض (والنتيجةُ تُحسب تلقائياً من التقييم، واليدويُّ يثبت — 2026-10-31)، وإبلاغُه النتيجةَ SMS بعد القرار، وإنشاءُ حساب معلّمٍ للمقبول، وحذفُ المرشّح.
 */
import type { Candidate } from '~/composables/useCandidates'
import { CANDIDATE_PASS_MARK, CANDIDATE_QUALIFY_MARK, type CandidateStatus } from '~/constants/candidates'
import { interviewWhen, resultKind } from '~/utils/candidates'

const props = defineProps<{ candidate: Candidate, busy: boolean }>()
const emit = defineEmits<{ decide: [status: CandidateStatus, note: string], resultSms: [], hire: [], remove: [] }>()

const note = ref('')
watch(() => props.candidate.id, () => (note.value = props.candidate.decision_note ?? ''), { immediate: true })
const decided = computed(() => !!resultKind(props.candidate.status))
const DECISIONS = [
  { status: 'accepted', label: 'مقبول', icon: 'i-lucide-circle-check', color: 'success' },
  { status: 'reserve', label: 'تأهيل', icon: 'i-lucide-graduation-cap', color: 'primary' },
  { status: 'rejected', label: 'مرفوض', icon: 'i-lucide-circle-x', color: 'error' }
] as const
</script>

<template>
  <section class="dc">
    <h3>القرار</h3>
    <p class="dc-hint">
      تُحسب النتيجة تلقائياً من تقييمك: مقبول من {{ CANDIDATE_PASS_MARK }}، وتأهيل من {{ CANDIDATE_QUALIFY_MARK }}، ومرفوض دونها.
      اختيارُك أحدَها يدوياً يثبّته فلا يغيّره الحساب.
    </p>
    <UTextarea
      v-model="note"
      :rows="2"
      autoresize
      placeholder="ملاحظة القرار (اختيارية)"
      class="w-full"
    />
    <div class="dc-actions">
      <UButton
        v-for="d in DECISIONS"
        :key="d.status"
        :label="d.label"
        :icon="d.icon"
        :color="d.color"
        :variant="candidate.status === d.status ? 'solid' : 'soft'"
        :loading="busy"
        :ui="{ base: 'rounded-[12px] min-h-11' }"
        @click="emit('decide', d.status, note)"
      />
    </div>
    <p
      v-if="candidate.result_sms_at"
      class="dc-sent"
    >
      <UIcon
        name="i-lucide-message-square-check"
        class="size-4"
      />أُرسلت رسالة النتيجة SMS · {{ interviewWhen(candidate.result_sms_at) }}
    </p>
    <UButton
      v-if="decided"
      :label="candidate.result_sms_at ? 'أعد إرسال النتيجة SMS' : 'أرسل النتيجة SMS'"
      icon="i-lucide-message-square-text"
      color="primary"
      variant="soft"
      :ui="{ base: 'rounded-[12px] min-h-11 self-start' }"
      @click="emit('resultSms')"
    />
    <UButton
      v-if="candidate.status === 'accepted'"
      label="أنشئ له حساب معلّم"
      icon="i-lucide-user-plus"
      color="primary"
      block
      :loading="busy"
      :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
      @click="emit('hire')"
    />
    <UButton
      label="احذف المرشّح"
      icon="i-lucide-trash-2"
      color="error"
      variant="ghost"
      :ui="{ base: 'rounded-[12px] min-h-11 self-start' }"
      @click="emit('remove')"
    />
  </section>
</template>

<style scoped>
.dc { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line); }
.dc h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--ink); }
.dc-hint { margin: 0; font-size: 13px; color: var(--ink-3); line-height: 1.7; }
.dc-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.dc-sent { margin: 0; display: inline-flex; align-items: center; gap: 6px; color: var(--green-ink); font-size: 13.5px; font-weight: 600; }
</style>
