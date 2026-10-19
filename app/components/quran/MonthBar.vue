<script setup lang="ts">
/**
 * شريطُ حالة رصد الشهر وإجراءاتُه: شريطٌ كهرمانيّ بملاحظة الإعادة حين يعود الشهرُ مسوّدة، وشارةُ الحالة،
 * و«إرسال للاعتماد» للمعلم (معطَّلٌ قبل يوم الفتح أو بلا رصد، بتأكيدٍ يذكر من لم يُرصد)، و«اعتماد»
 * و«إعادة بملاحظة» للمعتمِد على المُرسَل، و«إعادة فتح» على المعتمَد. الإجراءاتُ تُمرَّر دوالَّ تُرجع
 * نجاحها (أخطاؤها تُعرض في `useQuranMonth`)، ويُبلَّغ الأبُ بـ`changed` بعد كلّ نجاح.
 */
import type { ReportStatus } from '~/utils/quran/screen'
import { REPORT_STATUS_COLORS, REPORT_STATUS_LABELS } from '~/utils/quran/screen'

const props = defineProps<{
  status: ReportStatus | null
  returnNote: string | null
  /** `10-2026`. */
  period: string
  /** المعلمُ يرى الإرسال. */
  canSubmit: boolean
  /** سببُ تعطيل الإرسال (قبل يوم الفتح / بلا رصد)؛ null = متاح. */
  submitBlock: string | null
  /** المعتمِدُ في هذه الحلقة (ومشرفُ المشروع مستثنى). */
  canDecide: boolean
  unrecorded: number
  total: number
  loading?: boolean
  submit: () => Promise<boolean>
  approve: () => Promise<boolean>
  returnWithNote: (note: string) => Promise<boolean>
}>()
const emit = defineEmits<{ changed: [] }>()
const toast = useToast()

const busy = ref(false)
const confirmSubmit = ref(false)
const returnMode = ref<'return' | 'reopen' | null>(null)
const returnOpen = computed({
  get: () => returnMode.value !== null,
  set: (v) => {
    if (!v) returnMode.value = null
  }
})
const statusKey = computed(() => props.status ?? 'none')
const showSubmit = computed(() => props.canSubmit && (props.status === null || props.status === 'draft'))
const submitMessage = computed(() => (props.unrecorded ? `لم يُرصد بعدُ ${props.unrecorded} من ${props.total} طالباً. ` : 'رُصد الطلابُ كلُّهم. ')
  + 'وبعد الإرسال لا يُعدَّل إلا أن يُعيده المعتمِد.')

async function run(action: () => Promise<boolean>, done: string): Promise<boolean> {
  busy.value = true
  const ok = await action()
  busy.value = false
  if (ok) {
    toast.add({ title: done, color: 'success', icon: 'i-lucide-circle-check' })
    emit('changed')
  }
  return ok
}
async function onSubmit() {
  if (await run(props.submit, `أُرسل رصدُ ${props.period} للاعتماد`)) confirmSubmit.value = false
}
async function onApprove() {
  await run(props.approve, `اعتُمد رصدُ ${props.period}`)
}
async function onReturn(note: string) {
  const done = returnMode.value === 'reopen' ? 'أُعيد فتحُ الشهر للمعلم' : 'أُعيد الرصدُ إلى المعلم بملاحظتك'
  if (await run(() => props.returnWithNote(note), done)) returnMode.value = null
}
</script>

<template>
  <div
    v-if="status === 'draft' && returnNote"
    class="returned"
    role="status"
  >
    <UIcon
      name="i-lucide-undo-2"
      class="size-5 shrink-0"
    />
    <span><strong>أُعيد الرصدُ بملاحظة:</strong> {{ returnNote }}</span>
  </div>

  <div class="bar">
    <UBadge
      :color="REPORT_STATUS_COLORS[statusKey]"
      variant="soft"
      size="lg"
      :label="`رصد ${period}: ${REPORT_STATUS_LABELS[statusKey]}`"
    />
    <span
      v-if="showSubmit && submitBlock"
      class="muted"
    >{{ submitBlock }}</span>
    <div class="acts">
      <UButton
        v-if="showSubmit"
        label="إرسال للاعتماد"
        icon="i-lucide-send"
        size="lg"
        :disabled="!!submitBlock || loading"
        :ui="{ base: 'rounded-[13px] justify-center font-semibold' }"
        @click="confirmSubmit = true"
      />
      <template v-if="canDecide && status === 'submitted'">
        <UButton
          label="إعادة بملاحظة"
          icon="i-lucide-undo-2"
          color="warning"
          variant="soft"
          size="lg"
          :disabled="busy"
          :ui="{ base: 'rounded-[13px] justify-center' }"
          @click="returnMode = 'return'"
        />
        <UButton
          label="اعتماد"
          icon="i-lucide-badge-check"
          color="success"
          size="lg"
          :loading="busy"
          :ui="{ base: 'rounded-[13px] justify-center font-semibold' }"
          @click="onApprove"
        />
      </template>
      <UButton
        v-if="canDecide && status === 'approved'"
        label="إعادة فتح"
        icon="i-lucide-lock-open"
        color="warning"
        variant="soft"
        size="lg"
        :ui="{ base: 'rounded-[13px] justify-center' }"
        @click="returnMode = 'reopen'"
      />
    </div>
  </div>

  <QuranReturnModal
    v-model:open="returnOpen"
    :title="returnMode === 'reopen' ? `إعادة فتح رصد ${period}` : `إعادة رصد ${period} إلى المعلم`"
    :description="returnMode === 'reopen' ? 'يعود الشهرُ مسوّدةً فيعدّله المعلم ثم يُرسله من جديد.' : 'يعود الرصدُ مسوّدةً ويرى المعلمُ ملاحظتك أعلى شاشته.'"
    :confirm-label="returnMode === 'reopen' ? 'إعادة فتح' : 'إعادة'"
    :loading="busy"
    @confirm="onReturn"
  />
  <UiConfirmModal
    v-model:open="confirmSubmit"
    :title="`إرسال رصد ${period} للاعتماد؟`"
    :message="submitMessage"
    confirm-label="إرسال"
    confirm-color="primary"
    confirm-icon="i-lucide-send"
    :loading="busy"
    @confirm="onSubmit"
  />
</template>

<style scoped>
.returned { display: flex; align-items: flex-start; gap: 10px; background: var(--chip-warn-bg); color: var(--chip-warn-ink); border-radius: var(--r-control); padding: 12px 16px; font-size: 14.5px; line-height: 1.7; margin-bottom: 16px; }
.bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 20px; margin-bottom: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); }
.acts { display: flex; gap: 8px; flex-wrap: wrap; margin-inline-start: auto; }
.muted { font-size: 14px; color: var(--ink-2); }

@media (max-width: 520px) {
  .acts { width: 100%; }
  .acts > * { flex: 1; min-height: 44px; }
}
</style>
