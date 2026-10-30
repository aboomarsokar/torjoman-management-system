<script setup lang="ts">
/**
 * طابورُ الرصد (المختبِر لحلقاته، والمديران احتياطاً — كما يسمح RLS): البنودُ بلا نتيجة بدورتها ونطاقها
 * وحدودها من التقسيمة؛ ولا يُعرض بندٌ بلا دورة.
 * يفتح نافذةَ الرصد (ExamsGradeModal)، وللمديرَين سحبُ الترشيح المعلّق. على الجوال بطاقات.
 * المختبِرُ بلا اتصال (2026-10-29): يُعرض الطابورُ من نسخة جهازه، وما رصده ينتظر الرفع في قسمٍ فوقه (لا يُرصد مرّتين)،
 * وما رفضته القاعدةُ في قسمٍ يليه. وسحبُ الترشيح يحتاج اتصالاً.
 */
import type { Database } from '~/types/database.types'
import { cycleSpanLabel, toExamCycle } from '~/utils/exams/cycles'
import { examTargetText, type WithdrawTarget } from '~/utils/exams/nomination'
import { EXAMS_QUEUE_KEY, fetchExamQueue, type ExamQueueRaw } from '~/utils/fieldScreens'
import { queueOnline as online } from '~/composables/useOfflineQueue'
import { useExamOffline } from '~/composables/useExamOffline'
import { offlineOwnerUid } from '~/utils/offlineSnapshot'
import { isOnlineNow } from '~/utils/reachability'

const emit = defineEmits<{ graded: [] }>()

const supabase = useSupabaseClient<Database>()
const { role } = useProfile()
const { isManager } = usePermissions()
const { handle } = useErrorHandler()
const quran = useQuranReference()
const { wrap } = useOfflineCopy()
// درجةُ النجاح مشتركةٌ مع النافذة (المفتاحُ نفسُه): بها يُحكم على ما رُصد على الجهاز
const { passMark } = useExamPassMark()
const { pending: onDevice, rejected, rowsFor, retry, discard, lastUploaded } = useExamOffline(passMark)

/** صفُّ الطابور المعروض. */
type QueueRow = { id: string, student: { id: string, full_name: string } | null, name: string, halaqa: string, teacher: string, title: string, detail: string, span: string }

// خطأُ الخادم والاتصالُ قائم يُرمى داخل `wrap` فلا تُكتب نسخةٌ فارغة، ويُعرض خارجه؛ وتعثّرٌ بلا اتصال يردّ فارغاً فيرجع `wrap` إلى النسخة.
// والمديران (بلا `uid`: لا نسخةَ لهما) يُرمى لهما الخطأُ دائماً ويُعرض كما كان قبل العمل بلا اتصال
const copied = wrap(EXAMS_QUEUE_KEY, () => fetchExamQueue(supabase).catch((err) => {
  if (isOnlineNow() || !offlineOwnerUid()) throw err
  return []
}))
// مرجعُ المصحف خارج `wrap`: بلا اتصالٍ ومع نسخةٍ يردّها `wrap` دون نداء الجالب، فلو كان داخله لما حُمّل
// ولخرجت حدودُ الدورة فارغةً في الطابور والنافذة (`load()` نفسُه يرجع إلى نسخة الجهاز بلا اتصال)
const { data: raw, refresh, pending } = useLazyAsyncData<ExamQueueRaw[]>(EXAMS_QUEUE_KEY, () => {
  void quran.load()
  return copied().catch((err) => {
    handle(err)
    return []
  })
}, { server: false, default: () => [], watch: [role] })

// ما على الجهاز (معلَّقاً أو مرفوضاً) أو رُفع الآن لا يُعرض في الطابور
const shown = rowsFor(raw)
// رُفع سطرٌ: يُجلب الطابورُ ومتصفّحُ النتائج من جديد (والبندُ مُسقطٌ حتى تصل النسخة فلا رمشة)
watch(lastUploaded, () => onGraded())

const rows = computed<QueueRow[]>(() => shown.value.map((i) => {
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

/** تركُ سطرٍ مرفوض يُعيد بندَه إلى الطابور — يُجلب من جديد كي يظهر قابلاً للرصد. */
async function onDiscard(key: string) {
  await discard(key)
  await refresh()
}

const withdrawTarget = ref<WithdrawTarget | null>(null)
function askWithdraw(r: QueueRow) {
  withdrawTarget.value = { itemId: r.id, studentName: r.name, cycleTitle: r.title }
}
</script>

<template>
  <div>
    <OfflineSavedNote :keys="[EXAMS_QUEUE_KEY]" />
    <ExamsPendingUploads
      v-if="onDevice.length"
      class="above"
      :items="onDevice"
    />
    <OfflineRejectedDays
      v-if="rejected.length"
      class="above"
      title="لم تقبلها القاعدة"
      :entries="rejected"
      @retry="retry"
      @discard="onDiscard"
    />
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
            :disabled="!online"
            :title="online ? undefined : 'يحتاج اتصالاً'"
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
              :disabled="!online"
              :title="online ? undefined : 'يحتاج اتصالاً'"
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
.above { margin-bottom: 16px; }
.sec-title { font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 14px; display: flex; align-items: center; gap: 9px; }
.count { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13px; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--ink-2); }
.sm { font-size: 13px; }
.cyc { display: flex; flex-direction: column; gap: 2px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
