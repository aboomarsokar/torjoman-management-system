<script setup lang="ts">
/**
 * طابورُ الرصد (المختبِر لحلقاته، والمديران احتياطاً — كما يسمح RLS): البنودُ بلا نتيجة بدورتها ونطاقها
 * وحدودها من التقسيمة؛ ولا يُعرض بندٌ بلا دورة.
 * يفتح نافذةَ الرصد (ExamsGradeModal)، وللمديرَين سحبُ الترشيح المعلّق. على الجوال بطاقات.
 */
import type { Database } from '~/types/database.types'
import { cycleSpanLabel, toExamCycle } from '~/utils/exams/cycles'
import { examTargetText, type WithdrawTarget } from '~/utils/exams/nomination'
import { EXAMS_QUEUE_KEY, fetchExamQueue, type ExamQueueRaw } from '~/utils/fieldScreens'

const emit = defineEmits<{ graded: [] }>()

const supabase = useSupabaseClient<Database>()
const { role } = useProfile()
const { isManager } = usePermissions()
const { handle } = useErrorHandler()
const quran = useQuranReference()

/** صفُّ الطابور المعروض. */
type QueueRow = { id: string, student: { id: string, full_name: string } | null, name: string, halaqa: string, teacher: string, title: string, detail: string, span: string }

const { data: raw, refresh, pending } = useLazyAsyncData<ExamQueueRaw[]>(EXAMS_QUEUE_KEY, async () => {
  void quran.load()
  try {
    return await fetchExamQueue(supabase)
  } catch (error) {
    handle(error)
    return []
  }
}, { server: false, default: () => [], watch: [role] })

const rows = computed<QueueRow[]>(() => (raw.value ?? []).map((i) => {
  const cycle = i.exam_cycle ? toExamCycle(i.exam_cycle) : null
  const t = examTargetText(cycle)
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
