<script setup lang="ts">
/**
 * حضورُ حلقتي — شاشةُ المعلّم التي تعمل بلا إنترنت (البند 14 — نمطُ الصحابة، 2026-10-26).
 * تُصيَّر في المتصفّح وتُخزَّن في عامل الخدمة، والبياناتُ من نسخة الجهاز: الحلقةُ وطلابُها وآخرُ أربعين يوماً.
 * بسيطةٌ عن قصد (طلب المستخدم 2026-10-26): لا بطاقةَ للحلقة، وسطرُ حالةٍ رفيعٌ يقول ما ينتظر الرفعَ بعدده، وشريطُ آخر 15 يومَ دوامٍ يُري ما لم يُسجَّل، و«حفظ الحضور» يُكتب على الجهاز
 * فوراً ويُرفع في الخلفية يوماً يوماً؛ وما رفضته الإدارةُ يُعرض للمعلّم بإعادةٍ أو ترك. في قالب اللوحة (القائمةُ والجرسُ
 * والصورة — طلب المستخدم 2026-10-26)، والقالبُ يقرأ بلا إنترنت آخرَ ما عُرف (`offlineCache`).
 * و«لم تنعقد الحلقة» (2026-10-30): يومُ الإجازة شريطٌ وحده، ويومُ البلاغ شريطُه بلا قائمة، وغيرُهما زرُّ البلاغ بجانب الحفظ.
 */
import { formatDay, isFriday } from '~/utils/reportWindow'
import { weekdayName } from '~/utils/recordingStatus'
import type { OffReason } from '~/utils/offDays'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'حضور حلقتي — ترجمان', robots: 'noindex' })

const {
  ready, access, mirror, outbox, start, today, day, students, shown, locked, draft, dirty,
  dayUnknown, canWrite, setChoice, save, statusText, retrying, strip, rejectedRows,
  holiday, off, reportBlock, reportShown, canReport, canWithdraw, reportOff, withdrawOff
} = useOfflineAttendance()
const { state: readiness } = useOfflineReadiness()
onMounted(start)
// التطبيقُ المثبَّت يُقلع هنا لكلّ الأدوار: غيرُ المعلّم متّصلاً يذهب إلى لوحته بلا شاشةٍ بينهما
watch(access, (a) => {
  if (a === 'other') navigateTo('/dashboard', { replace: true })
})

const toast = useToast()
const { handle } = useErrorHandler()
const saving = ref(false)
async function onSave() {
  saving.value = true
  try {
    if (await save()) toast.add({ title: outbox.online.value ? 'حُفظ الحضور، ويُرفع الآن.' : 'حُفظ على جهازك — يُرفع حين يعود الاتصال.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

const summary = computed(() => summarizeDay(students.value, draft.value))
const canSave = computed(() => canWrite.value && (dirty.value || !shown.value.held))
const { keepsEdits } = useUnsavedGuard(dirty, 'لديك تعديلٌ في الحضور لم يُحفظ — هل تتركه؟')
const dayModel = computed<string>({
  get: () => day.value,
  set: (v) => {
    if (!keepsEdits()) day.value = v
  }
})
const dayState = computed(() => shown.value.pending && shown.value.held // سطرُ سحبٍ بانتظار الرفع: اليومُ غيرُ مسجَّل
  ? { cls: 'queued', icon: 'i-lucide-cloud-upload', text: `حضور ${formatDay(day.value)} محفوظ على جهازك — بانتظار الرفع.` }
  : shown.value.held
    ? { cls: 'on', icon: 'i-lucide-calendar-check', text: 'سُجّل حضور هذا اليوم — عدّل ثم احفظ إن لزم.' }
    : { cls: '', icon: 'i-lucide-calendar-clock', text: 'لم يُسجَّل حضور هذا اليوم — الجميع حاضر افتراضاً، سجّل الغيابات ثم احفظ.' })

// ── «لم تنعقد الحلقة»: النافذةُ معبّأةٌ بالبلاغ المعروض إن وُجد («عدّل البلاغ»)، وفارغةٌ من زرّ القائمة ──
const reportOpen = ref(false)
const offBusy = ref(false)
function openReport() {
  if (keepsEdits()) reportOpen.value = true
}
async function runOff(act: () => Promise<boolean>, done: string) {
  offBusy.value = true
  const ok = await act().catch((err: unknown) => void handle(err))
  offBusy.value = false
  if (ok) toast.add({ title: done, color: 'success', icon: 'i-lucide-circle-check' })
  return ok
}
async function onReport(reason: OffReason, note: string | null) {
  if (await runOff(() => reportOff(reason, note), outbox.online.value ? 'أُرسل البلاغ، ويُرفع الآن.' : 'حُفظ البلاغ على جهازك — يُرفع حين يعود الاتصال.')) reportOpen.value = false
}
const onWithdraw = () => runOff(withdrawOff, 'سُحب البلاغ، ويعود اليومُ للتسجيل.')
</script>

<template>
  <div class="tp-main">
    <OfflineSyncStatus
      v-if="access === 'teacher'"
      :text="statusText"
      :online="outbox.online.value"
      :pending="outbox.pending.value.length"
      :syncing="outbox.syncing.value"
      :retrying="retrying"
      :readiness="readiness"
      @retry="outbox.flush()"
    />
    <OfflineRejectedDays
      v-if="rejectedRows.length"
      title="أيامٌ لم تقبلها الإدارة"
      :entries="rejectedRows"
      @retry="outbox.retry"
      @discard="outbox.discard"
    />

    <div
      v-if="!ready"
      class="stack"
      aria-busy="true"
    >
      <UiSkeletonRow
        v-for="i in 4"
        :key="i"
        :desc="false"
        :action="false"
      />
    </div>
    <UiEmptyState
      v-else-if="access === 'other'"
      icon="i-lucide-user-round"
      title="هذه الشاشةُ لحضور المعلّم"
      description="الحضورُ لغير المعلّم في «الحضور اليوميّ» من اللوحة."
    >
      <UButton
        to="/attendance"
        label="الحضور اليوميّ"
        color="primary"
        :ui="{ base: 'rounded-xl min-h-11' }"
      />
    </UiEmptyState>
    <UiEmptyState
      v-else-if="!mirror"
      icon="i-lucide-wifi-off"
      title="افتح هذه الشاشة مرّةً وأنت متّصل"
      description="تُحفظ حلقتُك وطلابُك على جهازك عند أوّل فتحٍ متّصل، ثمّ تعمل بلا إنترنت."
    >
      <UButton
        v-if="outbox.online.value"
        to="/login"
        label="تسجيل الدخول"
        color="primary"
        :ui="{ base: 'rounded-xl min-h-11' }"
      />
    </UiEmptyState>
    <UiEmptyState
      v-else-if="!mirror.halaqa"
      icon="i-lucide-book-open"
      title="لا حلقة معيّنة لك"
    />

    <!-- الشاشةُ الكبيرة: اليومُ وشريطُه عمودٌ ثابت، والقائمةُ بجانبه (لقطة المستخدم 2026-10-27) -->
    <div
      v-else
      class="att-grid"
    >
      <section class="card main">
        <div class="day">
          <div class="day-label">
            <small>{{ mirror.halaqa.name }}</small>
            <b>{{ weekdayName(day) }} · <bdi>{{ formatDay(day) }}</bdi></b>
          </div>
          <AttendanceDayPicker
            v-model="dayModel"
            :max="today"
          />
        </div>
        <AttendanceWindowStrip
          :days="strip.days"
          :missing="strip.missing"
          :selected="day"
          @select="dayModel = $event"
        />
      </section>

      <div class="att-body">
        <div
          v-if="locked"
          class="note"
        >
          <UIcon
            name="i-lucide-lock"
            class="size-5 shrink-0"
          />رصدُ هذا الشهر معتمَد فلا تُعدَّل أيامُه.
        </div>
        <UiEmptyState
          v-if="isFriday(day)"
          icon="i-lucide-calendar-off"
          title="الجمعة عطلة — لا يُسجَّل فيها حضور"
        />
        <AttendanceHolidayBanner
          v-else-if="holiday"
          :reason="holiday"
        />
        <AttendanceOffDayBanner
          v-else-if="off"
          :day-label="formatDay(day)"
          :off="off"
          :can-withdraw="canWithdraw"
          :can-edit="canReport"
          :busy="offBusy"
          @withdraw="onWithdraw"
          @edit="openReport"
        />
        <UiEmptyState
          v-else-if="dayUnknown"
          icon="i-lucide-cloud-off"
          title="هذا اليومُ أقدمُ ممّا حُفظ على جهازك"
          description="اتّصل بالإنترنت لعرضه أو تعديله."
        />
        <UiEmptyState
          v-else-if="!students.length"
          icon="i-lucide-users"
          title="لا طلاب ملتحقون في هذا اليوم"
        />
        <template v-else>
          <div
            class="day-state"
            :class="dayState.cls"
          >
            <UIcon
              :name="dayState.icon"
              class="size-5 shrink-0"
            />
            <span>{{ dayState.text }}</span>
          </div>
          <OfflineAttendanceList
            :students="students"
            :draft="draft"
            :summary="summary"
            :disabled="!canWrite"
            @set="setChoice"
          />
          <div
            v-if="canWrite"
            class="save-bar"
          >
            <span
              class="save-note"
              :class="{ warn: dirty }"
            >{{ dirty ? 'لديك تعديلٌ لم يُحفظ' : shown.held ? 'كلُّ شيءٍ محفوظ' : 'لم يُحفظ بعد' }}</span>
            <div class="save-acts">
              <AttendanceOffDayAction
                v-if="reportShown && !shown.held"
                :disabled="!canReport"
                :block="reportBlock"
                @open="openReport"
              />
              <!-- لا جديدَ يُحفظ: إطارٌ هادئ لا زرٌّ ممتلئٌ باهت (طلب المستخدم 2026-10-28) -->
              <UButton
                label="حفظ الحضور"
                icon="i-lucide-save"
                :color="canSave ? 'primary' : 'neutral'"
                :variant="canSave ? 'solid' : 'outline'"
                size="lg"
                :loading="saving"
                :disabled="!canSave"
                :ui="{ base: 'min-h-12 rounded-xl font-semibold justify-center px-6' }"
                @click="onSave"
              />
            </div>
          </div>
          <AttendanceOffDayAction
            v-if="reportShown && (shown.held || !canWrite)"
            link
            :disabled="!canReport"
            :block="reportBlock"
            @open="openReport"
          />
        </template>
        <AttendanceOffDayModal
          v-model:open="reportOpen"
          :day-label="formatDay(day)"
          :held="shown.held"
          :initial="off"
          @confirm="onReport"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* يملأ عرضَ المحتوى كسائر الصفحات (لقطة المستخدم 2026-10-27: كان عموداً ضيّقاً إلى اليمين على الشاشة الكبيرة) */
.tp-main { display: flex; flex-direction: column; gap: 14px; }
.att-grid, .att-body { display: flex; flex-direction: column; gap: 14px; }
@media (min-width: 1100px) {
  .att-grid { display: grid; grid-template-columns: minmax(340px, 400px) minmax(0, 1fr); align-items: start; }
  .att-grid > .main { position: sticky; top: 16px; }
}
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 18px; }
.main { display: flex; flex-direction: column; gap: 18px; }
.day-label small { font-size: 12.5px; color: var(--ink-3); font-weight: 500; }
.day { display: flex; flex-direction: column; gap: 10px; }
.day-label { display: flex; flex-direction: column; }
.day-label b { font-size: 15.5px; font-weight: 700; color: var(--ink); }
.day-label bdi { font-variant-numeric: tabular-nums; }
.note { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-2); font-size: 14px; font-weight: 600; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.day-state { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 14px; background: var(--chip-warn-bg); color: var(--chip-warn-ink); font-size: 14.5px; font-weight: 600; line-height: 1.6; }
.day-state.on { background: var(--green-soft); color: var(--green-ink); }
.day-state.queued { background: var(--blue-soft); color: var(--blue-ink); }
.save-bar { position: sticky; bottom: 12px; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: 18px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-lg); }
.save-note { font-size: 14px; font-weight: 600; color: var(--ink-3); }
.save-note.warn { color: var(--err); }
.save-acts { display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
@media (max-width: 520px) {
  .save-acts, .save-acts > :deep(*) { flex: 1 1 100%; }
}
</style>
