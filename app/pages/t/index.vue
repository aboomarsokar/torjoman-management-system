<script setup lang="ts">
/**
 * حضورُ حلقتي — شاشةُ المعلّم التي تعمل بلا إنترنت (البند 14 — نمطُ الصحابة، 2026-10-26).
 * تُصيَّر في المتصفّح وتُخزَّن في عامل الخدمة، والبياناتُ من نسخة الجهاز: الحلقةُ وطلابُها وآخرُ أربعين يوماً.
 * «حفظ الحضور» يُكتب على الجهاز فوراً ويُرفع في الخلفية حين يعود الاتصال، يوماً يوماً؛ وما رفضته الإدارةُ يُعرض
 * للمعلّم بإعادةٍ أو ترك. وبلا نافذةٍ مشتركةٍ مع اللوحة: لا شيءَ فيها يحتاج الشبكةَ ليظهر.
 */
import { formatDay, isFriday } from '~/utils/reportWindow'

definePageMeta({ layout: false })
useSeoMeta({ title: 'حضور حلقتي — ترجمان', robots: 'noindex' })

const {
  ready, access, mirror, outbox, start, today, day, students, shown, locked, draft, dirty,
  dayUnknown, canWrite, setChoice, save, statusText
} = useOfflineAttendance()
onMounted(start)

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
const syncedAt = computed(() => mirror.value?.syncedAt
  ? new Date(mirror.value.syncedAt).toLocaleString('en-GB', { timeZone: 'Asia/Gaza', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ' ·')
  : null)
</script>

<template>
  <div class="tp">
    <header class="tp-head">
      <img
        src="/brand/turjuman-mark.png"
        alt="ترجمان"
        class="mark"
      >
      <div class="who">
        <h1>حضور حلقتي</h1>
        <span v-if="mirror?.halaqa">{{ mirror.halaqa.name }}</span>
      </div>
      <UButton
        v-if="outbox.online.value"
        to="/dashboard"
        label="اللوحة"
        icon="i-lucide-layout-dashboard"
        color="neutral"
        variant="ghost"
        :ui="{ base: 'rounded-xl min-h-11' }"
      />
    </header>

    <main class="tp-main">
      <OfflineSyncChip
        v-if="access === 'teacher'"
        :text="statusText"
        :online="outbox.online.value"
        :pending="outbox.pending.value.length"
        :rejected="outbox.rejected.value.length"
        :syncing="outbox.syncing.value"
        @sync="outbox.flush()"
      />
      <OfflineRejectedDays
        v-if="outbox.rejected.value.length"
        :entries="outbox.rejected.value"
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

      <template v-else>
        <div class="card pick">
          <label>اليوم</label>
          <AttendanceDayPicker
            v-model="dayModel"
            :max="today"
          />
          <small v-if="syncedAt">آخرُ تحديثٍ من الإدارة: <bdi>{{ syncedAt }}</bdi></small>
        </div>

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
            :class="{ on: shown.held }"
          >
            <UIcon
              :name="shown.pending ? 'i-lucide-cloud-upload' : shown.held ? 'i-lucide-calendar-check' : 'i-lucide-calendar-clock'"
              class="size-5 shrink-0"
            />
            <span>{{ shown.pending ? `حضور ${formatDay(day)} محفوظ على جهازك — لم يُرفع بعد.` : shown.held ? 'سُجّل حضور هذا اليوم — عدّل ثم احفظ إن لزم.' : 'لم يُسجَّل حضور هذا اليوم — الجميع حاضر افتراضاً، سجّل الغيابات ثم احفظ.' }}</span>
          </div>
          <p
            class="summary"
            aria-live="polite"
          >
            حضر {{ summary.present }} · بعذر {{ summary.excused }} · بلا عذر {{ summary.unexcused }}
          </p>
          <ul class="card list">
            <li
              v-for="s in students"
              :key="s.id"
              class="row"
            >
              <span class="name">{{ s.full_name }}</span>
              <AttendanceStatusSegment
                :model-value="draft[s.id] ?? 'present'"
                :name="s.full_name"
                :disabled="!canWrite"
                @update:model-value="setChoice(s.id, $event)"
              />
            </li>
          </ul>
          <div
            v-if="canWrite"
            class="save-bar"
          >
            <span
              class="save-note"
              :class="{ warn: dirty }"
            >{{ dirty ? 'لديك تعديلٌ لم يُحفظ' : shown.held ? 'كلُّ شيءٍ محفوظ' : 'لم يُحفظ بعد' }}</span>
            <UButton
              label="حفظ الحضور"
              icon="i-lucide-save"
              color="primary"
              size="lg"
              :loading="saving"
              :disabled="!canSave"
              :ui="{ base: 'min-h-12 rounded-xl font-semibold justify-center px-6' }"
              @click="onSave"
            />
          </div>
        </template>
      </template>
    </main>
  </div>
</template>

<style scoped>
.tp { min-height: 100dvh; background: var(--bg); }
.tp-head { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--line); }
.mark { width: 40px; height: 40px; object-fit: contain; filter: var(--logo-filter); }
.who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.who h1 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.who span { font-size: 13.5px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-main { max-width: 760px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 16px 18px; }
.pick { display: flex; flex-direction: column; gap: 8px; }
.pick label { font-size: 13px; font-weight: 600; color: var(--ink-2); }
.pick small { font-size: 12.5px; color: var(--ink-3); }
.pick small bdi { font-variant-numeric: tabular-nums; }
.note { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-2); font-size: 14px; font-weight: 600; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.day-state { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--blue-soft); color: var(--blue-ink); font-size: 14.5px; font-weight: 600; line-height: 1.6; }
.day-state.on { background: var(--green-soft); color: var(--green-ink); }
.summary { margin: 0 4px; font-size: 15px; font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.list { list-style: none; margin: 0; padding: 6px 18px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 10px 0; }
.row + .row { border-top: 1px solid var(--line); }
.name { font-size: 15.5px; font-weight: 600; color: var(--ink); min-width: 0; }
.save-bar { position: sticky; bottom: 12px; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-lg); }
.save-note { font-size: 14px; font-weight: 600; color: var(--ink-3); }
.save-note.warn { color: var(--err); }
@media (max-width: 520px) {
  .row { flex-direction: column; align-items: stretch; gap: 8px; }
  .save-bar :deep(button) { flex: 1 1 100%; }
}
</style>
