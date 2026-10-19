<script setup lang="ts">
/**
 * ترشيحُ المعلّم للاختبار بالدورات: لكلّ طالبٍ نشط دورتُه المستحقّة ثابتةً (أوّلُ دورةٍ لم يجتزها) بتسميتها
 * ونطاقها وحدودها من التقسيمة، وحالتُه («بانتظار رصد المختبِر» مع سحب الترشيح، أو «أتمّ الخطة»)،
 * وتلميحٌ لا منع إن لم يبلغ موضعُه المعتمد حدودَ الدورة. الإرسالُ قائمةٌ لكلّ حلقة ببنودٍ بـ`exam_cycle_id`؛
 * والحكمُ لحارس القاعدة (الترتيب والمعلّق) ورسائلِه العربيّة. على الجوال بطاقات.
 */
import type { Database } from '~/types/database.types'
import { CYCLE_COLUMNS, cycleLabel, cycleRange, cycleSpanLabel, toExamCycle } from '~/utils/exams/cycles'
import {
  approvedJuzReached, buildNomineeRows,
  type CycleItemRow, type NomineeRow, type WithdrawTarget
} from '~/utils/exams/nomination'
import { HISTORY_MONTHS, type HistoryRow } from '~/utils/quran/monthHistory'
import { shiftMonth } from '~/utils/reportWindow'

const supabase = useSupabaseClient<Database>()
const { role, profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()
const quran = useQuranReference()

async function load(): Promise<NomineeRow[]> {
  await quran.load()
  const [students, cycles] = await Promise.all([
    supabase.from('students').select('id, full_name, quran_parts, halaqa_id').eq('status', 'active').order('full_name'),
    supabase.from('exam_cycles').select(CYCLE_COLUMNS).order('sort_order')
  ])
  const failure = students.error ?? cycles.error
  if (failure) throw failure
  const ids = (students.data ?? []).map(s => s.id)
  if (!ids.length) return []
  const now = new Date()
  const lowerYear = shiftMonth(now.getFullYear(), now.getMonth() + 1, -HISTORY_MONTHS).year
  const [items, history] = await Promise.all([
    supabase.from('exam_list_items').select('id, student_id, exam_cycle_id, exam_results(passed)')
      .in('student_id', ids).not('exam_cycle_id', 'is', null).returns<CycleItemRow[]>(),
    // آخرُ نهايةٍ معتمَدة لكلّ طالب: استعلامٌ واحد على سجلّات الأشهر المعتمدة، محدودٌ بآخر HISTORY_MONTHS
    // شهراً على مستوى السنة ومرتّبٌ بالأحدث — كـuseQuranMonth (`latestEnds` يحسم الأدقّ)
    supabase.from('quran_records')
      .select('student_id, to_surah, to_ayah, report:monthly_reports!inner(report_year, report_month, status)')
      .in('student_id', ids).not('to_surah', 'is', null).eq('report.status', 'approved')
      .gte('report.report_year', lowerYear)
      .order('report(report_year)', { ascending: false })
      .order('report(report_month)', { ascending: false })
      .returns<HistoryRow[]>()
  ])
  const failure2 = items.error ?? history.error
  if (failure2) throw failure2
  const reached = approvedJuzReached(students.data ?? [], history.data ?? [], quran.juz.value)
  return buildNomineeRows(students.data ?? [], (cycles.data ?? []).map(toExamCycle), items.data ?? [], reached)
}

const { data: rows, refresh, pending } = useLazyAsyncData<NomineeRow[]>('exams-nominate', async () => {
  if (role.value !== 'teacher') return []
  try {
    return await load()
  } catch (err) {
    handle(err)
    return []
  }
}, { server: false, default: () => [], watch: [role] })

const span = (r: NomineeRow) => (r.cycle ? cycleSpanLabel(r.cycle, quran.juz.value, quran.surahName) : '')
const statusText = (r: NomineeRow) => (r.blocked === 'pending' ? 'بانتظار رصد المختبِر' : r.blocked === 'done' ? 'أتمّ الخطة' : '')
const selectable = (r: NomineeRow) => !!r.cycle && !r.blocked

const checked = reactive<Record<string, boolean>>({})
const chosen = computed(() => (rows.value ?? []).filter(r => selectable(r) && checked[r.id]))

const columns = [
  { key: 'nom', label: 'ترشيح' },
  { key: 'full_name', label: 'الطالب' },
  { key: 'juz', label: 'الأجزاء المعتمدة' },
  { key: 'cycle', label: 'الدورة المستحقّة' },
  { key: 'status', label: 'الحالة', align: 'end' as const }
]

const sending = ref(false)
async function send() {
  const picked = chosen.value
  if (!picked.length || !profile.value) return
  sending.value = true
  try {
    const byHalaqa = new Map<string, NomineeRow[]>()
    for (const r of picked) if (r.halaqa_id) byHalaqa.set(r.halaqa_id, [...(byHalaqa.get(r.halaqa_id) ?? []), r])
    const today = new Date().toISOString().slice(0, 10)
    let sent = 0
    for (const [halaqaId, studs] of byHalaqa) {
      const { data: list, error: e1 } = await supabase.from('exam_lists')
        .insert({ halaqa_id: halaqaId, teacher_id: profile.value.id, week_date: today, status: 'sent' })
        .select('id').single()
      if (e1) throw e1
      if (!list) throw new Error('تعذّر إنشاء قائمة الترشيح. حاول مجدداً.')
      const items = studs.map(s => ({ exam_list_id: list.id, student_id: s.id, exam_cycle_id: s.cycle!.id }))
      const { error: e2 } = await supabase.from('exam_list_items').insert(items)
      if (e2) {
        // لا تبقى قائمةٌ فارغة إن ردّ الحارسُ بنودَها
        await supabase.from('exam_lists').delete().eq('id', list.id)
        throw e2
      }
      sent += studs.length
    }
    toast.add({ title: `أُرسل للمختبِر عددُ المرشّحين: ${sent}.`, color: 'success', icon: 'i-lucide-send' })
    for (const k of Object.keys(checked)) checked[k] = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    sending.value = false
  }
}

const withdrawTarget = ref<WithdrawTarget | null>(null)
function askWithdraw(r: NomineeRow) {
  if (!r.pendingItemId) return
  withdrawTarget.value = { itemId: r.pendingItemId, studentName: r.full_name, cycleTitle: r.cycle ? cycleLabel(r.cycle) : 'الدورة' }
}
</script>

<template>
  <div class="nominate">
    <UiSkeletonTable
      v-if="pending && !rows.length"
      :columns="columns"
    />
    <UiEmptyState
      v-else-if="!rows.length"
      icon="i-lucide-users"
      title="لا طلاب في حلقتك"
      description="أضِف طلاباً لحلقتك أولاً من شاشة الطلاب."
    />
    <template v-else>
      <UiDataTable
        :columns="columns"
        :rows="rows"
        row-key="id"
      >
        <template #nom="{ row }">
          <UCheckbox
            v-if="selectable(row)"
            v-model="checked[row.id]"
            :aria-label="`ترشيح ${row.full_name}`"
          />
          <span
            v-else
            class="muted"
          >—</span>
        </template>
        <template #full_name="{ row }">
          <span class="strong">{{ row.full_name }}</span>
        </template>
        <template #juz="{ row }">
          <span class="muted">{{ row.juzReached }}</span>
        </template>
        <template #cycle="{ row }">
          <div
            v-if="row.cycle"
            class="cyc"
          >
            <span class="strong">{{ cycleLabel(row.cycle) }}</span>
            <span class="muted sm">{{ cycleRange(row.cycle) }}</span>
            <span
              v-if="span(row)"
              class="muted sm"
            >{{ span(row) }}</span>
            <span
              v-if="row.hint"
              class="hint"
            ><UIcon name="i-lucide-info" /> {{ row.hint }}</span>
          </div>
          <span
            v-else
            class="muted"
          >—</span>
        </template>
        <template #status="{ row }">
          <div class="status">
            <span
              v-if="row.blocked"
              class="tag"
            >{{ statusText(row) }}</span>
            <UButton
              v-if="row.pendingItemId"
              label="سحب الترشيح"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-undo-2"
              :ui="{ base: 'rounded-[10px]' }"
              @click="askWithdraw(row)"
            />
          </div>
        </template>
        <template #card="{ row }">
          <UiCardRow
            :title="row.full_name"
            :subtitle="row.cycle ? cycleLabel(row.cycle) : null"
            :fields="[
              { label: 'الأجزاء المعتمدة', value: row.juzReached },
              { label: 'النطاق', value: row.cycle ? cycleRange(row.cycle) : null },
              { label: 'حدودُها', value: span(row) },
              ...(row.hint ? [{ label: 'تنبيه', value: row.hint }] : [])
            ]"
          >
            <template
              v-if="row.blocked"
              #badge
            >
              <span class="tag">{{ statusText(row) }}</span>
            </template>
            <template
              v-if="selectable(row) || row.pendingItemId"
              #actions
            >
              <UButton
                v-if="selectable(row)"
                :label="checked[row.id] ? 'محدَّدٌ للترشيح' : 'رشّحه'"
                :color="checked[row.id] ? 'primary' : 'neutral'"
                :variant="checked[row.id] ? 'solid' : 'outline'"
                :icon="checked[row.id] ? 'i-lucide-check' : 'i-lucide-plus'"
                :aria-pressed="!!checked[row.id]"
                :ui="{ base: 'rounded-[10px]' }"
                @click="checked[row.id] = !checked[row.id]"
              />
              <UButton
                v-else
                label="سحب الترشيح"
                color="neutral"
                variant="outline"
                icon="i-lucide-undo-2"
                :ui="{ base: 'rounded-[10px]' }"
                @click="askWithdraw(row)"
              />
            </template>
          </UiCardRow>
        </template>
      </UiDataTable>
      <div class="send-bar">
        <span>المحدّدون: <strong>{{ chosen.length }}</strong></span>
        <UButton
          label="إرسال للمختبِر"
          color="primary"
          size="lg"
          icon="i-lucide-send"
          :disabled="!chosen.length"
          :loading="sending"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="send"
        />
      </div>
    </template>
    <ExamsWithdrawModal
      v-model:target="withdrawTarget"
      @withdrawn="refresh"
    />
  </div>
</template>

<style scoped>
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--ink-2); }
.sm { font-size: 13px; }
.cyc { display: flex; flex-direction: column; gap: 2px; }
.hint { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--chip-warn-ink); margin-top: 2px; }
.status { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.tag { display: inline-flex; align-items: center; height: 26px; padding: 0 11px; border-radius: 999px; font-size: 12.5px; font-weight: 700; background: var(--surface-3); color: var(--ink-3); white-space: nowrap; }
.send-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 4px 0; flex-wrap: wrap; }
.send-bar strong { color: var(--ink); }
.send-bar :deep(button) { min-height: 44px; }
</style>
