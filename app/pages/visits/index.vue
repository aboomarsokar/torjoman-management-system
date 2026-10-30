<script setup lang="ts">
/**
 * الزيارات الإشرافية (§4.9 — ROADMAP #15): كلُّ مشرفٍ ميدانيّ يجدول زياراته لحلقاته ويرفع نتائجها،
 * والإدارةُ (المديران والمديرة ومشرف المشروع) تتابع: الشهرُ والمشرفُ فلتران، و«إنجازُ الزيارات» (المنفّذةُ ÷ زيارتين لكلّ حلقة في الشهر)،
 * وتفاصيلُ كلّ زيارةٍ بسجلّ تغييرات موعدها وأسبابه. ثلاثُ حالات (`visitDisplayStatus`، قرار 2026-10-21):
 * مجدولة، ومتأخّرة (فات موعدُها بلا تنفيذ)، وتمّت (كلُّ منفّذة). والمشرفُ الميدانيّ لا يرى «الزائر» — هو الزائر.
 * الحذفُ لصاحب الزيارة وللمدير الإداري (تنظيف خطأ).
 * المشرفُ الميداني بلا اتصال (2026-10-29): تُعرض نسخةُ الزيارات من جهازه، وما حفظه من تقييمٍ ينتظر الرفع يظهر في صفّه
 * مقفلاً بشارة «بانتظار الرفع» (الحالةُ والفلاترُ والعدّاداتُ بحالة القاعدة)؛ والجدولةُ والتأجيلُ والحذفُ تحتاج اتصالاً.
 */
import type { Database } from '~/types/database.types'
import type { VisitRow } from '~/types/visits'
import type { VisitDisplayStatus } from '~/utils/visitStatus'
import { roleLabel } from '~/constants/roles'
import { VISIT_MAX } from '~/utils/visitForm'
import { SCREEN_KEYS } from '~/utils/teacherScreens'
import { useVisitsData } from '~/composables/useVisitsData'
import { useDeductionItems } from '~/composables/useDeductionItems'
import { queueOnline as online } from '~/composables/useOfflineQueue'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الزيارات الإشرافية — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()
const { isAdmin, isFieldSupervisor, isTeacher, isTechnical } = usePermissions()
// والمديرُ الفنيّ يجدول ويزور حلقاتِ البنين بنفسه (طلب المستخدم 2026-10-26) — زيارتُه للاطّلاع لا لسجلّ التقييم
const isVisitor = computed(() => isFieldSupervisor.value || isTechnical.value)
const canSchedule = isVisitor
/** التقييم: مجموعُ النموذج «35 / 42»، وللزيارة القديمة تقييمُها النصّيّ. */
const ratingText = (v: VisitRow) => v.score != null ? `${v.score} / ${VISIT_MAX}` : v.flow_rating || '—'
/** موعدُ الزيارة ونتيجتُها لصاحبها الزائر وحده (visits_update) — المشرفُ الميدانيّ أو المديرُ الفنيّ. */
const canEditVisit = (v: VisitRow) => isVisitor.value && v.supervisor_id === profile.value?.id

// جلبُ الزيارات والحلقات في `useVisitsData`: خطأُ الخادم متّصلاً لا يكتب نسخةً فارغة، ويُعرض كما كان
const { fetched, refresh, pending, halqat } = useVisitsData()
// بنودُ الخصم (جلبٌ مشتركٌ مع نافذة النتيجة): بها يُحسب مجموعُ ما ينتظر الرفع
const { items } = useDeductionItems()
const { rowsFor, badgeFor, rejected, retry, discard, lastUploaded } = useVisitOffline()
/** الصفوفُ المعروضة: نسخةُ القاعدة وعليها ما رُفع الآن وما حُفظ على الجهاز ولم يُرفع بعد. */
const visits = rowsFor(fetched, items)
// رُفع سطرٌ: يظهر ردُّ القاعدة فوراً، ثم تُجلب النسخةُ الجديدة
watch(lastUploaded, () => refresh())

const today = gazaToday()
const display = (v: VisitRow) => visitDisplayStatus(v, today)
/** شارةُ الحالة: ما ينتظر الرفع على الجهاز يحمل شارتَه بدل حالةِ القاعدة. */
const statusBadge = (v: VisitRow) => badgeFor(v.id, { label: VISIT_STATUS[display(v)]?.label, color: VISIT_STATUS[display(v)]?.color })

// ── الفلاتر: الشهر (افتراضاً الجاري) والمشرف (للإدارة) ثم شرائح الحالة ──
const periodOf = (v: VisitRow) => gazaDayOf(v.scheduled_at).slice(0, 7)
const currentPeriod = today.slice(0, 7)
const period = ref<string>(currentPeriod)
const periodItems = computed(() => {
  const set = new Set([currentPeriod, ...(visits.value ?? []).map(periodOf)])
  const list = [...set].sort().reverse().map((p) => {
    const [y, m] = p.split('-').map(Number)
    return { label: periodLabel(y!, m!), value: p }
  })
  return [{ label: 'كل الشهور', value: 'all' }, ...list]
})
// «عرض الكل» من صفحة المشرف يفتح زياراتِه وحدها (?supervisor= — طلب المستخدم 2026-10-22)
const supQuery = useRoute().query.supervisor
const supervisorF = ref<string>(typeof supQuery === 'string' ? supQuery : 'all')
const supervisorItems = computed(() => {
  const map = new Map<string, string>()
  // المشرفون الميدانيّون وحدهم — زيارةٌ قديمة جدولها مديرٌ قبل قصر الجدولة على المشرف لا تُدخله القائمة (2026-10-22)
  for (const v of visits.value ?? []) if (v.supervisor?.role === 'field_supervisor') map.set(v.supervisor_id, v.supervisor.full_name)
  return [{ label: 'كل المشرفين', value: 'all' }, ...[...map].map(([value, label]) => ({ label, value }))]
})
// الحلقة (طلب المستخدم 2026-10-21): حلقاتُ الزيارات الظاهرة للمشرف المختار، فلا تُعرض حلقةٌ لا زيارةَ لها
const halqaF = ref<string>('all')
const halqaItems = computed(() => {
  const map = new Map<string, string>()
  for (const v of visits.value ?? []) {
    if (supervisorF.value !== 'all' && v.supervisor_id !== supervisorF.value) continue
    map.set(v.halaqa_id, v.halaqa?.name ?? '—')
  }
  const list = [...map].map(([value, label]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label, 'ar'))
  return [{ label: 'كل الحلقات', value: 'all' }, ...list]
})
// تبديلُ المشرف يُسقط حلقةً ليست من حلقاته
watch(halqaItems, (items) => {
  if (!items.some(i => i.value === halqaF.value)) halqaF.value = 'all'
})
const scoped = computed(() => (visits.value ?? []).filter(v =>
  (period.value === 'all' || periodOf(v) === period.value)
  && (supervisorF.value === 'all' || v.supervisor_id === supervisorF.value)
  && (halqaF.value === 'all' || v.halaqa_id === halqaF.value)))

const statusF = ref<VisitDisplayStatus | 'all'>('all')
// الحالةُ قائمةٌ منسدلة في صفّ الفلاتر بعدد كلّ حالةٍ في الشهر والمشرف المختارَين (طلب المستخدم 2026-10-20)
const statusItems = computed(() => {
  const list = scoped.value.map(display)
  const n = (s: VisitDisplayStatus) => list.filter(x => x === s).length
  return [
    { value: 'all' as const, label: `كل الحالات (${list.length})` },
    { value: 'scheduled' as const, label: `مجدولة (${n('scheduled')})` },
    { value: 'done' as const, label: `تمّت (${n('done')})` },
    { value: 'late' as const, label: `متأخّرة (${n('late')})` }
  ]
})
const filtered = computed(() => scoped.value.filter(v => statusF.value === 'all' || display(v) === statusF.value))
// المطلوبُ للإنجاز: حلقاتُ النطاق النشطةُ ذاتُ المشرف (المشرفُ والحلقةُ المختاران) × 2 × أشهرُ العرض
const requiredHalqat = computed(() => (halqat.value ?? []).filter(h =>
  h.status === 'active' && !!h.supervisor_id
  && (supervisorF.value === 'all' || h.supervisor_id === supervisorF.value)
  && (halqaF.value === 'all' || h.id === halqaF.value)).length)
const monthsShown = computed(() => period.value === 'all' ? new Set(scoped.value.map(periodOf)).size : 1)
const stats = computed(() => {
  const list = scoped.value.map(display)
  // نسبةُ الإنجاز على زيارات المشرفين الميدانيّين — زيارةُ المدير الفنيّ لا تُتمّ المطلوبَ منهم
  const c = visitCompletion(scoped.value.filter(v => v.supervisor?.role !== 'technical_manager'), requiredHalqat.value, monthsShown.value)
  return {
    scheduled: list.filter(s => s === 'scheduled').length,
    done: list.filter(s => s === 'done').length,
    overdue: list.filter(s => s === 'late').length,
    completion: c.pct === null ? '—' : `${c.pct}%`,
    completionSub: c.required ? `${c.done} من ${c.required}` : 'لا حلقات نشطة'
  }
})
// المشرفُ الميدانيّ يرى زياراته وحدها — هو الزائر فيها، فلا عمودَ «الزائر» له (طلب المستخدم 2026-10-21)
const showVisitor = computed(() => !isFieldSupervisor.value)
const columns = computed(() => [
  { key: 'num', label: '#' },
  { key: 'halqa', label: 'الحلقة' },
  { key: 'teacher', label: 'المعلّم' },
  ...(showVisitor.value ? [{ key: 'visitor', label: 'الزائر' }] : []),
  { key: 'date', label: 'الموعد' },
  { key: 'rating', label: 'التقييم' },
  { key: 'status', label: 'الحالة' },
  { key: 'actions', label: 'إجراءات', align: 'end' as const }
])
/** زرُّ الزيارة الرئيسيّ: صاحبُها ينفّذها ما لم تُنفَّذ، وغيرُه يطّلع على نتيجتها أو تفاصيلها. */
function mainAction(v: VisitRow) {
  if (canEditVisit(v) && !v.executed_at) return { label: 'تنفيذ', icon: 'i-lucide-clipboard-pen', color: 'primary' as const, variant: 'solid' as const }
  return { label: v.executed_at ? 'النتيجة' : 'التفاصيل', icon: 'i-lucide-eye', color: 'neutral' as const, variant: 'outline' as const }
}
const canReschedule = (v: VisitRow) => canEditVisit(v) && !v.executed_at

// ── النوافذ ──
const schedOpen = ref(false)
const schedVisit = ref<VisitRow | null>(null)
function openSchedule(v: VisitRow | null) {
  schedVisit.value = v
  schedOpen.value = true
}
const resultOpen = ref(false)
const resultVisit = ref<VisitRow | null>(null)
function openResult(v: VisitRow) {
  resultVisit.value = v
  resultOpen.value = true
}

// ── حذف ──
const deleteTarget = ref<VisitRow | null>(null)
const deleting = ref(false)
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const { error } = await supabase.from('supervision_visits').delete().eq('id', deleteTarget.value.id)
    if (error) throw error
    toast.add({ title: 'تم حذف الزيارة.', color: 'neutral', icon: 'i-lucide-trash-2' })
    deleteTarget.value = null
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="visits">
    <UiPageHeader
      title="الزيارات الإشرافية"
      :subtitle="isTeacher ? 'زيارات حلقتك الإشرافية ونتائجها — افتح كلَّ نتيجةٍ وأقِرّ بالاطّلاع عليها.' : 'جدولة الزيارات ومتابعة إنجازها ونتائجها.'"
    >
      <template #actions>
        <UButton
          v-if="canSchedule"
          label="جدولة زيارة"
          color="primary"
          size="lg"
          icon="i-lucide-plus"
          :disabled="!online"
          :title="online ? undefined : 'يحتاج اتصالاً'"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="openSchedule(null)"
        />
      </template>
    </UiPageHeader>
    <OfflineSavedNote :keys="[SCREEN_KEYS.visits]" />
    <ClientOnly>
      <OfflineRejectedDays
        v-if="rejected.length"
        title="لم تقبلها القاعدة"
        :entries="rejected"
        @retry="retry"
        @discard="discard"
      />
    </ClientOnly>

    <div class="filters">
      <UiSelect
        v-model="period"
        :items="periodItems"
        size="xl"
        class="sel"
        aria-label="الشهر"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
      <!-- المعلم: حلقةٌ واحدة ومشرفُها — لا فلترَ للمشرف ولا للحلقة -->
      <UiSelect
        v-if="!isFieldSupervisor && !isTeacher"
        v-model="supervisorF"
        :items="supervisorItems"
        size="xl"
        class="sel wide"
        aria-label="المشرف"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
      <UiSelect
        v-if="!isTeacher"
        v-model="halqaF"
        :items="halqaItems"
        size="xl"
        class="sel wide"
        aria-label="الحلقة"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
      <UiSelect
        v-model="statusF"
        :items="statusItems"
        size="xl"
        class="sel"
        aria-label="الحالة"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
    </div>

    <div class="stats">
      <UiStatCard
        icon="i-lucide-calendar"
        :value="stats.scheduled"
        label="مجدولة قادمة"
        tone="blue"
      />
      <UiStatCard
        icon="i-lucide-circle-check-big"
        :value="stats.done"
        label="تمّت"
        tone="green"
      />
      <UiStatCard
        icon="i-lucide-circle-alert"
        :value="stats.overdue"
        label="متأخّرة"
        tone="err"
      />
      <UiStatCard
        icon="i-lucide-gauge"
        :value="stats.completion"
        label="إنجاز الزيارات"
        :sub="stats.completionSub"
        tone="blue"
      />
    </div>

    <ClientOnly>
      <UiSkeletonTable
        v-if="pending"
        :columns="columns"
      />
      <UiEmptyState
        v-else-if="filtered.length === 0"
        icon="i-lucide-clipboard-check"
        title="لا زيارات بهذه التصفية"
        :description="canSchedule ? 'جدوِل زيارة جديدة لتظهر هنا.' : 'غيّر الشهر أو المشرف لترى زيارات أخرى.'"
      />
      <UiDataTable
        v-else
        :columns="columns"
        :rows="filtered"
        row-key="id"
      >
        <template #num="{ index }">
          <span class="muted">{{ index + 1 }}</span>
        </template>
        <template #halqa="{ row }">
          <span class="strong">{{ row.halaqa?.name || '—' }}</span>
        </template>
        <template #teacher="{ row }">
          <span class="muted">{{ row.halaqa?.teacher?.full_name || '—' }}</span>
        </template>
        <template #visitor="{ row }">
          <div class="visitor-cell">
            <span class="strong">{{ row.supervisor?.full_name || '—' }}</span>
            <UBadge
              v-if="row.supervisor && row.supervisor.role !== 'field_supervisor'"
              :label="roleLabel(row.supervisor.role, row.supervisor.gender)"
              color="primary"
              variant="soft"
              size="sm"
            />
          </div>
        </template>
        <template #date="{ row }">
          <span
            class="muted"
            dir="ltr"
          >{{ formatVisitMoment(row.scheduled_at) }}</span>
        </template>
        <template #rating="{ row }">
          <span
            v-if="row.score != null"
            class="strong"
          >{{ ratingText(row) }}</span>
          <span
            v-else
            class="muted"
          >{{ ratingText(row) }}</span>
        </template>
        <template #status="{ row }">
          <UBadge
            v-bind="statusBadge(row)"
            variant="soft"
          />
        </template>
        <template #actions="{ row }">
          <div class="actions">
            <UButton
              v-bind="mainAction(row)"
              size="sm"
              :ui="{ base: 'rounded-[10px]' }"
              @click="openResult(row)"
            />
            <UButton
              v-if="canReschedule(row)"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-calendar-clock"
              :ui="{ base: 'rounded-[10px]' }"
              :disabled="!online"
              :title="online ? undefined : 'يحتاج اتصالاً'"
              aria-label="تعديل الموعد"
              @click="openSchedule(row)"
            />
            <UButton
              v-if="isAdmin || canEditVisit(row)"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-trash-2"
              :ui="{ base: 'rounded-[10px]' }"
              :disabled="!online"
              :title="online ? undefined : 'يحتاج اتصالاً'"
              aria-label="حذف"
              @click="deleteTarget = row"
            />
          </div>
        </template>
        <template #card="{ row }">
          <UiCardRow
            :title="row.halaqa?.name || '—'"
            :subtitle="formatVisitMoment(row.scheduled_at)"
            subtitle-dir="ltr"
            :fields="[
              { label: 'المعلّم', value: row.halaqa?.teacher?.full_name },
              ...(showVisitor ? [{ label: 'الزائر', value: row.supervisor?.full_name }] : []),
              { label: 'التقييم', value: ratingText(row), muted: row.score == null && !row.flow_rating },
              ...(row.locked_at ? [{ label: 'اطّلاع المعلم', value: row.teacher_ack_at ? 'اطّلع' : 'لم يطّلع بعد', muted: !row.teacher_ack_at }] : [])
            ]"
          >
            <template #badge>
              <UBadge
                v-bind="statusBadge(row)"
                variant="soft"
              />
            </template>
            <template #actions>
              <UButton
                v-bind="mainAction(row)"
                :ui="{ base: 'rounded-[11px]' }"
                @click="openResult(row)"
              />
              <UButton
                v-if="canReschedule(row)"
                label="تعديل الموعد"
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar-clock"
                :ui="{ base: 'rounded-[11px]' }"
                :disabled="!online"
                :title="online ? undefined : 'يحتاج اتصالاً'"
                @click="openSchedule(row)"
              />
              <UButton
                v-if="isAdmin || canEditVisit(row)"
                class="icon-only"
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                aria-label="حذف"
                :disabled="!online"
                :title="online ? undefined : 'يحتاج اتصالاً'"
                :ui="{ base: 'rounded-[11px]' }"
                @click="deleteTarget = row"
              />
            </template>
          </UiCardRow>
        </template>
      </UiDataTable>
    </ClientOnly>

    <VisitsScheduleModal
      v-model:open="schedOpen"
      :visit="schedVisit"
      :halqat="halqat ?? []"
      @saved="refresh"
    />
    <VisitsResultModal
      v-model:open="resultOpen"
      :visit="resultVisit"
      :can-edit="!!resultVisit && canEditVisit(resultVisit)"
      @saved="refresh"
    />

    <UiConfirmModal
      :open="!!deleteTarget"
      title="حذف الزيارة"
      :loading="deleting"
      @update:open="v => { if (!v) deleteTarget = null }"
      @confirm="confirmDelete"
    >
      هل أنت متأكّد من حذف زيارة حلقة «<strong>{{ deleteTarget?.halaqa?.name }}</strong>»؟ لا يمكن التراجع.
    </UiConfirmModal>
  </div>
</template>

<style scoped>
.filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; container: vfilters / inline-size; }
.sel { width: 170px; }
.sel.wide { width: 220px; }
/* ضيّقٌ: القوائمُ تتقاسم الصفّ (والمشرفُ سطرٌ كامل للإدارة) بعرض الشريط لا الشاشة */
@container vfilters (max-width: 599px) {
  .sel { flex: 1 1 0; width: auto; min-width: 0; }
  .sel.wide { flex-basis: 100%; order: -1; }
}
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-bottom: 22px; }
.strong { font-weight: 600; color: var(--ink); white-space: nowrap; }
.visitor-cell { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.muted { color: var(--ink-2); white-space: nowrap; }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }

@media (max-width: 1100px) { .stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .stats { grid-template-columns: 1fr 1fr; gap: 12px; } }
</style>
