<script setup lang="ts">
/**
 * طابورُ الرصد (المختبِر لحلقاته، والمديران احتياطاً — كما يسمح RLS): البنودُ بلا نتيجة بدورتها ونطاقها
 * وحدودها من التقسيمة؛ ولا يُعرض بندٌ بلا دورة.
 * يفتح نافذةَ الرصد (ExamsGradeModal)، وللمديرَين سحبُ الترشيح المعلّق.
 * مجمّعٌ بالحلقة (طلب المستخدم 2026-11-10 — `ExamsQueueGroup`): الأطولُ انتظاراً أولاً، والدورةُ مرّةً في رأس الحلقة،
 * وفلاترُ القسم والمختبِر المسنَد والبحث والدورة في الشريط الموحّد (`useExamQueueFilters`، في الرابط).
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
import { gazaToday } from '~/utils/reportWindow'
import { gazaDayOf } from '~/utils/visitStatus'
import { waitDaysBetween, waitLabel, waitTone, type QueueItem } from '~/utils/exams/queueGroups'

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

const today = gazaToday()
const items = computed<QueueItem[]>(() => shown.value.map((i) => {
  const cycle = i.exam_cycle ? toExamCycle(i.exam_cycle) : null
  const t = examTargetText(cycle)
  const h = i.exam_list?.halaqa
  return {
    id: i.id,
    student: i.student,
    name: i.student?.full_name ?? '—',
    halaqaId: h?.id ?? h?.name ?? '—',
    halaqa: h?.name ?? '—',
    gender: h?.gender ?? null,
    teacher: i.exam_list?.teacher?.full_name ?? '—',
    examinerId: h?.examiner?.id ?? null,
    examiner: h?.examiner?.full_name ?? null,
    cycleId: cycle ? String(cycle.id) : null,
    title: t.title,
    detail: t.detail,
    span: cycle ? cycleSpanLabel(cycle, quran.juz.value, quran.surahName) : '',
    waitDays: i.created_at ? waitDaysBetween(gazaDayOf(i.created_at), today) : null
  }
}))
const { filters, update, reset, base, shown: visible, groups, summary, genderItems, showGender, examinerItems, showExaminer, cycleItems, showCycle, active } = useExamQueueFilters(items)
const cycle = computed({ get: () => filters.value.cycle, set: (v: string) => update({ cycle: v }) })
const cycleSelect = computed(() => [{ value: 'all', label: 'كلّ الدورات' }, ...cycleItems.value])
/** «في حلقةٍ واحدة» · «في حلقتين» · «في 5 حلقات» · «في 12 حلقة». */
const halqatText = (n: number) => n === 1 ? ' في حلقةٍ واحدة' : n === 2 ? ' في حلقتين' : n <= 10 ? ` في ${n} حلقات` : ` في ${n} حلقة`

const gradeOpen = ref(false)
const gradeTarget = ref<QueueItem | null>(null)
function openGrade(r: QueueItem) {
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
function askWithdraw(r: QueueItem) {
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
    <div class="gq-head">
      <h3 class="sec-title">
        الاختبارات الواردة <span class="count">{{ base.length }}</span>
      </h3>
      <p
        v-if="groups.length"
        class="gq-sum"
      >
        <template v-if="active">
          يظهر <b>{{ summary.students }}</b>
        </template>{{ halqatText(summary.halqat) }}<template v-if="summary.oldest !== null">
          <span class="dot">·</span>
          أطولُ انتظار <b :class="`w-${waitTone(summary.oldest)}`">{{ waitLabel(summary.oldest) }}</b>
        </template>
      </p>
    </div>
    <UiSkeletonLines
      v-if="pending && !raw.length"
      :fields="3"
    />
    <UiEmptyState
      v-else-if="!base.length"
      icon="i-lucide-clipboard-check"
      title="لا اختبارات واردة"
      description="ستظهر هنا ترشيحات المعلّمين فور إرسالها."
    />
    <template v-else>
      <UiHalaqaFilters
        class="gq-filters"
        :filters="filters"
        :gender-items="genderItems"
        :sup-items="examinerItems"
        :show-gender="showGender"
        :show-supervisor="showExaminer"
        sup-label="المختبِر"
        sup-all-label="كلّ المختبِرين"
        placeholder="ابحث باسم الطالب أو الحلقة أو المعلّم"
        :shown="visible.length"
        :total="base.length"
        @update="update"
      >
        <div
          v-if="showCycle"
          class="hf-extra"
        >
          <UiSelect
            v-model="cycle"
            :items="cycleSelect"
            size="xl"
            class="w-full"
            aria-label="الدورة"
          />
        </div>
      </UiHalaqaFilters>

      <div
        v-if="!groups.length"
        class="gq-empty"
      >
        <UiEmptyState
          icon="i-lucide-filter-x"
          title="لا اختبارَ يطابق البحث والفلاتر"
        />
        <UButton
          v-if="active"
          label="امسح البحث والفلاتر"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="soft"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="reset"
        />
      </div>
      <div
        v-else
        class="gq-groups"
      >
        <ExamsQueueGroup
          v-for="g in groups"
          :key="g.halaqaId"
          :group="g"
          :can-withdraw="isManager"
          :online="online"
          @grade="openGrade"
          @withdraw="askWithdraw"
        />
      </div>
    </template>

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
.gq-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 14px; margin-bottom: 14px; }
.gq-head .sec-title { margin: 0; }
.gq-filters { margin-bottom: 16px; }
.hf-extra :deep(button) { min-block-size: 48px; }
.gq-sum { margin: 0; font-size: 14px; color: var(--ink-2); }
.gq-sum b { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
.gq-sum b.w-warn { color: var(--chip-warn-ink); }
.gq-sum b.w-late { color: var(--err); }
.gq-sum .dot { margin-inline: 6px; color: var(--ink-3); }
.gq-groups { display: flex; flex-direction: column; gap: 14px; }
.gq-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding-block: 8px 16px; }
</style>
