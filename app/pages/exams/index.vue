<script setup lang="ts">
/**
 * الاختبارات (§4.16) — موجّهة بالدور:
 * - المعلّم: يختار محطة الاختبار لكل طالب بحكم معرفته الفعلية بمستواه (بلا شرط
 *   على الأجزاء المثبتة)، ويرسل القائمة. الخيارات تستبعد المُجتاز والمعلّق فقط.
 * - المختبِر (لحلقاته المُسنَدة) / المدير احتياطاً: يرصد نتيجة كل اختبار وارد
 *   (ExamsGradeModal) — الاجتياز يرفع الأجزاء المثبتة بمُشغِّلٍ في القاعدة.
 *   المشرف لم يعد يرصد (يتابع النتائج فقط).
 * - الجميع: متابعة النتائج حسب النطاق (ExamsResultsBrowser بفلاتر هرمية).
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الاختبارات — ترجمان' })

type PlanRow = { id: number, parts_from: number, parts_to: number, stage_type: 'partial' | 'cumulative' }

const supabase = useSupabaseClient<Database>()
const { role, profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()

const { isTeacher, isManager, isExaminer } = usePermissions()
/** الرصد: المختبِر لحلقاته، والمديران (الإداري والفني) احتياطاً — كما يسمح RLS. */
const canGrade = computed(() => isManager.value || isExaminer.value)

const stageLabel = (s: string) => s === 'partial' ? 'مرحلي' : 'تجميعي'

// جلب غير حاجز (useLazyAsyncData): الاستعلامات الأربعة أدناه مستقلّة وتعمل بالتوازي تلقائياً
const { data: plan } = useLazyAsyncData<PlanRow[]>('exams-plan', async () => {
  const { data } = await supabase.from('exam_plan').select('id, parts_from, parts_to, stage_type').order('parts_to')
  return (data ?? []) as PlanRow[]
}, { server: false, default: () => [] })

// ═══ المعلّم: الترشيح ═══
type RosterStudent = { id: string, full_name: string, quran_parts: number | null, halaqa_id: string | null }
const { data: roster, refresh: refreshRoster, pending: rosterPending } = useLazyAsyncData<RosterStudent[]>('exams-roster', async () => {
  if (role.value !== 'teacher') return []
  const { data } = await supabase.from('students').select('id, full_name, quran_parts, halaqa_id').eq('status', 'active').order('full_name')
  return data ?? []
}, { server: false, default: () => [], watch: [role] })

// حالة اختبارات الطلاب: المُجتاز (لا يُرشَّح ثانيةً) والمعلّق (بانتظار الرصد)
type ResRow = { student_id: string, exam_list_item: { exam_plan_id: number | null } | null }
type ItemRow = { student_id: string, exam_plan_id: number | null, exam_results: { id: string }[] }
const { data: examState, refresh: refreshState } = useLazyAsyncData<{ passed: Record<string, number[]>, pending: Record<string, number[]> }>('exams-state', async () => {
  if (role.value !== 'teacher') return { passed: {} as Record<string, number[]>, pending: {} as Record<string, number[]> }
  const [{ data: res }, { data: items }] = await Promise.all([
    supabase.from('exam_results').select('student_id, exam_list_item:exam_list_item_id(exam_plan_id)').eq('passed', true).returns<ResRow[]>(),
    supabase.from('exam_list_items').select('student_id, exam_plan_id, exam_results(id)').returns<ItemRow[]>()
  ])
  const passed: Record<string, number[]> = {}
  for (const r of res ?? []) {
    const pid = r.exam_list_item?.exam_plan_id
    if (pid != null) (passed[r.student_id] ??= []).push(pid)
  }
  const pending: Record<string, number[]> = {}
  for (const it of items ?? []) {
    if (it.exam_plan_id != null && !it.exam_results?.length) (pending[it.student_id] ??= []).push(it.exam_plan_id)
  }
  return { passed, pending }
}, { server: false, default: () => ({ passed: {}, pending: {} }), watch: [role] })

const passedOf = (id: string) => new Set(examState.value?.passed[id] ?? [])
const pendingOf = (id: string) => new Set(examState.value?.pending[id] ?? [])
// المحطات المتاحة للترشيح: كل محطات الخطة، ناقص المُجتازة والمعلّقة (بانتظار الرصد)
// للطالب — بلا شرط على الأجزاء المثبتة؛ المعلّم يختار حسب معرفته الفعلية
// بمستوى الطالب. القائمة مرتّبة أصلاً (parts_to تصاعدياً)، فأول خيار متبقٍّ
// يكون تلقائياً المحطة التالية بعد آخر ما اجتازه.
function availableStations(s: RosterStudent) {
  const passed = passedOf(s.id)
  const pending = pendingOf(s.id)
  return (plan.value ?? []).filter(p => !passed.has(p.id) && !pending.has(p.id))
}

const nominees = reactive<Record<string, { checked: boolean, planId: string }>>({})
const nomineeCount = computed(() => Object.values(nominees).filter(n => n.checked).length)

const rosterRows = computed(() => (roster.value ?? []).map((s) => {
  const avail = availableStations(s)
  let blockReason = ''
  if (!avail.length) blockReason = pendingOf(s.id).size ? 'بانتظار رصد المختبِر' : 'اجتاز كل الخطة'
  return {
    ...s,
    nom: nominees[s.id] ?? { checked: false, planId: '' },
    options: avail.map(p => ({ label: `الأجزاء ${p.parts_from}–${p.parts_to} (${stageLabel(p.stage_type)})`, value: String(p.id) })),
    blockReason
  }
}))

const sending = ref(false)
async function sendNominees() {
  const chosen = (roster.value ?? []).filter(s => nominees[s.id]?.checked && nominees[s.id]?.planId)
  if (!chosen.length) return
  // تحقّق دفاعي: استبعد المُجتاز/المعلّق (الحالتان 1 و2)
  const valid: RosterStudent[] = []
  const skipped: string[] = []
  for (const s of chosen) {
    const pid = Number(nominees[s.id]!.planId)
    if (passedOf(s.id).has(pid)) skipped.push(`${s.full_name} (اجتاز هذا الاختبار مسبقاً)`)
    else if (pendingOf(s.id).has(pid)) skipped.push(`${s.full_name} (مرشّح مسبقاً وبانتظار الرصد)`)
    else valid.push(s)
  }
  if (skipped.length) {
    toast.add({ title: `تُجوهل ${skipped.length}: ${skipped.join(' · ')}`, color: 'warning', icon: 'i-lucide-triangle-alert' })
  }
  if (!valid.length) return
  sending.value = true
  try {
    // مجموعة حسب الحلقة → قائمة لكل حلقة
    const byHalqa = new Map<string, RosterStudent[]>()
    for (const s of valid) {
      if (!s.halaqa_id) continue
      const arr = byHalqa.get(s.halaqa_id) ?? []
      arr.push(s)
      byHalqa.set(s.halaqa_id, arr)
    }
    const today = new Date().toISOString().slice(0, 10)
    for (const [halaqaId, studs] of byHalqa) {
      const { data: list, error: e1 } = await supabase
        .from('exam_lists')
        .insert({ halaqa_id: halaqaId, teacher_id: profile.value!.id, week_date: today, status: 'sent' })
        .select('id').single()
      if (e1 || !list) throw e1
      const items = studs.map(s => ({ exam_list_id: list.id, student_id: s.id, exam_plan_id: Number(nominees[s.id]!.planId) }))
      const { error: e2 } = await supabase.from('exam_list_items').insert(items)
      if (e2) throw e2
    }
    toast.add({ title: `أُرسلت ${valid.length} ترشيحاً للمختبِر.`, color: 'success', icon: 'i-lucide-send' })
    for (const n of Object.values(nominees)) n.checked = false
    await Promise.all([refreshRoster(), refreshState()])
  } catch (err) {
    handle(err)
  } finally {
    sending.value = false
  }
}

// ═══ المختبِر/المدير: الاختبارات الواردة ═══
type QueueItem = {
  id: string
  student: { id: string, full_name: string } | null
  exam_plan: { parts_from: number, parts_to: number, stage_type: string } | null
  exam_list: { halaqa: { name: string } | null, teacher: { full_name: string } | null } | null
  exam_results: { id: string }[]
}
const { data: queueRaw, refresh: refreshQueue, pending: queuePending } = useLazyAsyncData<QueueItem[]>('exams-queue', async () => {
  if (!canGrade.value) return []
  const { data, error } = await supabase
    .from('exam_list_items')
    .select('id, student:student_id(id, full_name), exam_plan:exam_plan_id(parts_from, parts_to, stage_type), exam_list:exam_list_id(halaqa:halaqa_id(name), teacher:teacher_id(full_name)), exam_results(id)')
    .order('created_at', { ascending: true })
    .returns<QueueItem[]>()
  if (error) {
    console.error('[exams] queue:', error.message)
    return []
  }
  return data ?? []
}, { server: false, default: () => [], watch: [role] })

// تهيئة اختيارات الترشيح لكل طالب (بعد توفّر roster والحالة)
watchEffect(() => {
  for (const s of roster.value ?? []) {
    const avail = availableStations(s)
    const cur = nominees[s.id]
    if (!cur) {
      nominees[s.id] = { checked: false, planId: avail.length ? String(avail[0]!.id) : '' }
    } else if (cur.planId && !avail.some(p => String(p.id) === cur.planId)) {
      cur.planId = avail.length ? String(avail[0]!.id) : ''
      if (!cur.planId) cur.checked = false
    }
  }
})

const queue = computed(() => (queueRaw.value ?? []).filter(i => !i.exam_results?.length))

// نافذة الرصد (ExamsGradeModal) + تحديث القائمة والنتائج بعد الحفظ
const gradeOpen = ref(false)
const gradeTarget = ref<QueueItem | null>(null)
const resultsRef = ref<{ refresh: () => Promise<void> } | null>(null)
function openGrade(item: QueueItem) {
  gradeTarget.value = item
  gradeOpen.value = true
}
async function onGraded() {
  await Promise.all([refreshQueue(), resultsRef.value?.refresh()])
}
</script>

<template>
  <div class="exams">
    <UiPageHeader
      title="الاختبارات"
      :subtitle="isTeacher ? 'رشّح طلابك للمحطة المناسبة حسب مستواهم الفعلي وأرسل القائمة للمختبِر.' : canGrade ? 'الاختبارات الواردة من المعلّمين — افتح كلّ اختبار وارصد نتيجته من 100، وتابع النتائج في نطاقك.' : 'تابع نتائج اختبارات الطلاب في نطاقك.'"
    />

    <ClientOnly>
      <!-- ═══ المعلّم: الترشيح ═══ -->
      <template v-if="isTeacher">
        <UiSkeletonTable
          v-if="rosterPending"
          :columns="[{ key: 'num', label: '#' }, { key: 'nom', label: 'ترشيح' }, { key: 'name', label: 'الطالب' }, { key: 'parts', label: 'المحفوظ' }, { key: 'exam', label: 'الاختبار المستحقّ' }]"
        />
        <UiEmptyState
          v-else-if="!(roster || []).length"
          icon="i-lucide-users"
          title="لا طلاب في حلقتك"
          description="أضِف طلاباً لحلقتك أولاً من شاشة الطلاب."
        />
        <div
          v-else
          class="card table-wrap"
        >
          <table>
            <thead>
              <tr>
                <th class="ta-start">
                  #
                </th>
                <th class="ta-start">
                  ترشيح
                </th>
                <th class="ta-start">
                  الطالب
                </th>
                <th class="ta-start">
                  المحفوظ
                </th>
                <th class="ta-start">
                  الاختبار المستحقّ
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in rosterRows"
                :key="row.id"
              >
                <td class="muted">
                  {{ i + 1 }}
                </td>
                <td>
                  <UCheckbox
                    v-if="row.options.length"
                    v-model="row.nom.checked"
                  />
                  <span
                    v-else
                    class="muted"
                  >—</span>
                </td>
                <td class="strong">
                  {{ row.full_name }}
                </td>
                <td class="muted">
                  {{ row.quran_parts != null ? `${row.quran_parts} جزء` : '—' }}
                </td>
                <td>
                  <UiSelect
                    v-if="row.options.length"
                    v-model="row.nom.planId"
                    :items="row.options"
                    size="sm"
                  />
                  <span
                    v-else
                    class="tag tag-soon"
                  >{{ row.blockReason }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="send-bar">
            <span>المحدّدون: <strong>{{ nomineeCount }}</strong></span>
            <UButton
              label="إرسال للمختبِر"
              color="primary"
              size="lg"
              icon="i-lucide-send"
              :disabled="nomineeCount === 0"
              :loading="sending"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
              @click="sendNominees"
            />
          </div>
        </div>
      </template>

      <!-- ═══ المختبِر/المدير: الواردة ═══ -->
      <template v-else-if="canGrade">
        <h3 class="sec-title">
          الاختبارات الواردة <span class="count">{{ queue.length }}</span>
        </h3>
        <UiSkeletonTable
          v-if="queuePending"
          :columns="[{ key: 'num', label: '#' }, { key: 'student', label: 'الطالب' }, { key: 'halqa', label: 'الحلقة' }, { key: 'teacher', label: 'المعلّم' }, { key: 'range', label: 'النطاق' }, { key: 'actions', label: 'إجراء', align: 'end' }]"
        />
        <UiEmptyState
          v-else-if="!queue.length"
          icon="i-lucide-clipboard-check"
          title="لا اختبارات واردة"
          description="ستظهر هنا ترشيحات المعلّمين فور إرسالها."
        />
        <div
          v-else
          class="card table-wrap"
        >
          <table>
            <thead>
              <tr>
                <th class="ta-start">
                  #
                </th>
                <th class="ta-start">
                  الطالب
                </th>
                <th class="ta-start">
                  الحلقة
                </th>
                <th class="ta-start">
                  المعلّم
                </th>
                <th class="ta-start">
                  النطاق
                </th>
                <th class="ta-end">
                  إجراء
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(it, i) in queue"
                :key="it.id"
              >
                <td class="muted">
                  {{ i + 1 }}
                </td>
                <td class="strong">
                  {{ it.student?.full_name || '—' }}
                </td>
                <td class="muted">
                  {{ it.exam_list?.halaqa?.name || '—' }}
                </td>
                <td class="muted">
                  {{ it.exam_list?.teacher?.full_name || '—' }}
                </td>
                <td class="muted">
                  <span v-if="it.exam_plan">الأجزاء {{ it.exam_plan.parts_from }}–{{ it.exam_plan.parts_to }} ({{ stageLabel(it.exam_plan.stage_type) }})</span>
                  <span v-else>—</span>
                </td>
                <td>
                  <div class="actions">
                    <UButton
                      label="رصد النتيجة"
                      color="primary"
                      size="sm"
                      icon="i-lucide-clipboard-pen"
                      :ui="{ base: 'rounded-[10px]' }"
                      @click="openGrade(it)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ═══ النتائج (للجميع، بفلاتر هرمية حسب النطاق) ═══ -->
      <div class="results-slot">
        <ExamsResultsBrowser ref="resultsRef" />
      </div>
    </ClientOnly>

    <ExamsGradeModal
      v-model:open="gradeOpen"
      :target="gradeTarget"
      @saved="onGraded"
    />
  </div>
</template>

<style scoped>
.exams { max-width: 1280px; margin: 0 auto; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }
.table-wrap { overflow-x: auto; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 15px; }
@media (max-width: 640px) { .table-wrap table { min-width: 600px; } }
.table-wrap thead tr { background: var(--surface-2); }
.table-wrap th { padding: 14px 18px; font-weight: 600; color: var(--ink-3); font-size: 13px; white-space: nowrap; }
.ta-start { text-align: start; }
.ta-end { text-align: end; }
.table-wrap tbody tr { border-top: 1px solid var(--line); }
.table-wrap td { padding: 13px 18px; vertical-align: middle; white-space: nowrap; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--ink-2); }
.actions { display: flex; justify-content: flex-end; }
.tag { display: inline-flex; align-items: center; height: 26px; padding: 0 11px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
.tag-soon { background: var(--surface-3); color: var(--ink-3); }

.send-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; border-top: 1px solid var(--line); flex-wrap: wrap; }
.send-bar strong { color: var(--ink); }

.sec-title { font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 14px; display: flex; align-items: center; gap: 9px; }
.count { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13px; }
.results-slot { margin-top: 30px; }
</style>
