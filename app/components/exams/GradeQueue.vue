<script setup lang="ts">
/**
 * طابورُ الرصد (المختبِر لحلقاته، والمديران احتياطاً — كما يسمح RLS): البنودُ بلا نتيجة بدورتها ونطاقها
 * وحدودها من التقسيمة؛ والبنودُ القديمة (`exam_plan_id` بلا دورة) تُعرض بنطاق خطتها كما هي حتى تُحذف.
 * يفتح نافذةَ الرصد (ExamsGradeModal)، وللمديرَين سحبُ الترشيح المعلّق. على الجوال بطاقات.
 */
import type { Database } from '~/types/database.types'
import { cycleSpanLabel, toExamCycle, type ExamCycleRow } from '~/utils/exams/cycles'
import { examTargetText, type OldPlanRef, type WithdrawTarget } from '~/utils/exams/nomination'

const emit = defineEmits<{ graded: [] }>()

const supabase = useSupabaseClient<Database>()
const { role } = useProfile()
const { isManager } = usePermissions()
const quran = useQuranReference()

type QueueRaw = {
  id: string
  student: { id: string, full_name: string } | null
  exam_cycle: ExamCycleRow | null
  exam_plan: OldPlanRef | null
  exam_list: { halaqa: { name: string } | null, teacher: { full_name: string } | null } | null
  exam_results: { id: string }[] | null
}
/** صفُّ الطابور المعروض. */
type QueueRow = { id: string, student: { id: string, full_name: string } | null, name: string, halaqa: string, teacher: string, title: string, detail: string, span: string }

/** سقفُ الطابور المعروض (الأحدثُ أولاً) — دون سقف PostgREST (1000) كي لا يُقصّ بصمت. */
const QUEUE_LIMIT = 500

const { data: raw, refresh, pending } = useLazyAsyncData<QueueRaw[]>('exams-queue', async () => {
  void quran.load()
  // المعلّقُ وحده يُصفّى في الخادم: ضمٌّ عكسيّ (البنودُ التي لا نتيجةَ لها)
  const { data, error } = await supabase
    .from('exam_list_items')
    .select('id, student:student_id(id, full_name), exam_cycle:exam_cycle_id(id, stage_number, cycle_number, parts_from, parts_to, surahs_label, sort_order), exam_plan:exam_plan_id(parts_from, parts_to), exam_list:exam_list_id(halaqa:halaqa_id(name), teacher:teacher_id(full_name)), exam_results(id)')
    .is('exam_results', null)
    .order('created_at', { ascending: false })
    .limit(QUEUE_LIMIT)
    .returns<QueueRaw[]>()
  if (error) {
    console.error('[exams] queue:', error.message)
    return []
  }
  return data ?? []
}, { server: false, default: () => [], watch: [role] })

const rows = computed<QueueRow[]>(() => (raw.value ?? []).map((i) => {
  const cycle = i.exam_cycle ? toExamCycle(i.exam_cycle) : null
  const t = examTargetText(cycle, i.exam_plan)
  return {
    id: i.id,
    student: i.student,
    name: i.student?.full_name ?? '—',
    halaqa: i.exam_list?.halaqa?.name ?? '—',
    teacher: i.exam_list?.teacher?.full_name ?? '—',
    title: t.title,
    detail: t.detail,
    span: cycle ? cycleSpanLabel(cycle, quran.juz.value, quran.surahName) : ''
  }
}))

const columns = [
  { key: 'name', label: 'الطالب' },
  { key: 'halaqa', label: 'الحلقة' },
  { key: 'teacher', label: 'المعلّم' },
  { key: 'cycle', label: 'الدورة' },
  { key: 'actions', label: 'إجراء', align: 'end' as const }
]

const gradeOpen = ref(false)
const gradeTarget = ref<QueueRow | null>(null)
function openGrade(r: QueueRow) {
  gradeTarget.value = r
  gradeOpen.value = true
}
async function onGraded() {
  await refresh()
  emit('graded')
}

const withdrawTarget = ref<WithdrawTarget | null>(null)
function askWithdraw(r: QueueRow) {
  withdrawTarget.value = { itemId: r.id, studentName: r.name, cycleTitle: r.title }
}
</script>

<template>
  <div>
    <h3 class="sec-title">
      الاختبارات الواردة <span class="count">{{ rows.length }}</span>
    </h3>
    <UiSkeletonTable
      v-if="pending && !raw.length"
      :columns="columns"
    />
    <UiEmptyState
      v-else-if="!rows.length"
      icon="i-lucide-clipboard-check"
      title="لا اختبارات واردة"
      description="ستظهر هنا ترشيحات المعلّمين فور إرسالها."
    />
    <UiDataTable
      v-else
      :columns="columns"
      :rows="rows"
      row-key="id"
    >
      <template #name="{ row }">
        <span class="strong">{{ row.name }}</span>
      </template>
      <template #halaqa="{ row }">
        <span class="muted">{{ row.halaqa }}</span>
      </template>
      <template #teacher="{ row }">
        <span class="muted">{{ row.teacher }}</span>
      </template>
      <template #cycle="{ row }">
        <div class="cyc">
          <span class="strong">{{ row.title }}</span>
          <span class="muted sm">{{ row.detail }}</span>
          <span
            v-if="row.span"
            class="muted sm"
          >{{ row.span }}</span>
        </div>
      </template>
      <template #actions="{ row }">
        <div class="actions">
          <UButton
            label="رصد النتيجة"
            color="primary"
            size="sm"
            icon="i-lucide-clipboard-pen"
            :ui="{ base: 'rounded-[10px]' }"
            @click="openGrade(row)"
          />
          <UButton
            v-if="isManager"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-undo-2"
            aria-label="سحب الترشيح"
            :ui="{ base: 'rounded-[10px]' }"
            @click="askWithdraw(row)"
          />
        </div>
      </template>
      <template #card="{ row }">
        <UiCardRow
          :title="row.name"
          :subtitle="row.title"
          :fields="[
            { label: 'الحلقة', value: row.halaqa },
            { label: 'المعلّم', value: row.teacher },
            { label: 'النطاق', value: row.detail },
            { label: 'حدودُها', value: row.span }
          ]"
        >
          <template #actions>
            <UButton
              label="رصد النتيجة"
              color="primary"
              icon="i-lucide-clipboard-pen"
              :ui="{ base: 'rounded-[10px]' }"
              @click="openGrade(row)"
            />
            <UButton
              v-if="isManager"
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

    <ExamsGradeModal
      v-model:open="gradeOpen"
      :target="gradeTarget"
      @saved="onGraded"
    />
    <ExamsWithdrawModal
      v-model:target="withdrawTarget"
      @withdrawn="refresh"
    />
  </div>
</template>

<style scoped>
.sec-title { font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 14px; display: flex; align-items: center; gap: 9px; }
.count { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13px; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--ink-2); }
.sm { font-size: 13px; }
.cyc { display: flex; flex-direction: column; gap: 2px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
