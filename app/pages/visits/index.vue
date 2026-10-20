<script setup lang="ts">
/**
 * الزيارات الإشرافية (§4.9 — ROADMAP #15): كلُّ مشرفٍ ميدانيّ يجدول زياراته لحلقاته ويرفع نتائجها،
 * والإدارةُ (المديران والمديرة ومشرف المشروع) تتابع: الشهرُ والمشرفُ فلتران، ونسبةُ الالتزام بالمواعيد،
 * وتفاصيلُ كلّ زيارةٍ بسجلّ تغييرات موعدها وأسبابه. الحالةُ من القاعدة (في وقتها / متأخّرة)،
 * و«فائتة» تُشتقّ عند العرض (`visitDisplayStatus`). الحذفُ لصاحب الزيارة وللمدير الإداري (تنظيف خطأ).
 */
import type { Database } from '~/types/database.types'
import type { VisitHalqaOption, VisitRow } from '~/types/visits'
import type { VisitDisplayStatus } from '~/utils/visitStatus'
import { roleLabel } from '~/constants/roles'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الزيارات الإشرافية — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()
const { isAdmin, isFieldSupervisor } = usePermissions()
const canSchedule = computed(() => isFieldSupervisor.value)
/** موعدُ الزيارة ونتيجتُها لصاحبها المشرف الميداني وحده (visits_update) — المديران يطّلعون. */
const canEditVisit = (v: VisitRow) => isFieldSupervisor.value && v.supervisor_id === profile.value?.id

const { data: visits, refresh, pending } = useLazyAsyncData<VisitRow[]>('visits-list', async () => {
  const { data, error } = await supabase
    .from('supervision_visits')
    .select('*, halaqa:halaqa_id(name, teacher:teacher_id(full_name)), supervisor:supervisor_id(full_name, role, gender)')
    .order('scheduled_at', { ascending: false })
    .returns<VisitRow[]>()
  if (error) handle(error)
  return data ?? []
}, { server: false, default: () => [] })
const { data: halqat } = useLazyAsyncData<VisitHalqaOption[]>('visits-halqat', async () => {
  const { data } = await supabase.from('halaqat')
    .select('id, name, daily_time, supervisor_id, teacher:teacher_id(full_name)').order('name')
    .returns<VisitHalqaOption[]>()
  return data ?? []
}, { server: false, default: () => [] })

const today = gazaToday()
const display = (v: VisitRow) => visitDisplayStatus(v, today)

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
const supervisorF = ref<string>('all')
const supervisorItems = computed(() => {
  const map = new Map<string, string>()
  for (const v of visits.value ?? []) if (v.supervisor) map.set(v.supervisor_id, v.supervisor.full_name)
  return [{ label: 'كل المشرفين', value: 'all' }, ...[...map].map(([value, label]) => ({ label, value }))]
})
const scoped = computed(() => (visits.value ?? []).filter(v =>
  (period.value === 'all' || periodOf(v) === period.value)
  && (supervisorF.value === 'all' || v.supervisor_id === supervisorF.value)))

const statusF = ref<VisitDisplayStatus | 'all'>('all')
// الحالةُ قائمةٌ منسدلة في صفّ الفلاتر بعدد كلّ حالةٍ في الشهر والمشرف المختارَين (طلب المستخدم 2026-10-20)
const statusItems = computed(() => {
  const list = scoped.value.map(display)
  const n = (s: VisitDisplayStatus) => list.filter(x => x === s).length
  return [
    { value: 'all' as const, label: `كل الحالات (${list.length})` },
    { value: 'scheduled' as const, label: `مجدولة (${n('scheduled')})` },
    { value: 'done' as const, label: `في وقتها (${n('done')})` },
    { value: 'late' as const, label: `متأخّرة (${n('late')})` },
    { value: 'missed' as const, label: `فائتة (${n('missed')})` }
  ]
})
const filtered = computed(() => scoped.value.filter(v => statusF.value === 'all' || display(v) === statusF.value))
const stats = computed(() => {
  const list = scoped.value.map(display)
  const commitment = visitCommitment(scoped.value, today)
  return {
    scheduled: list.filter(s => s === 'scheduled').length,
    done: list.filter(s => s === 'done').length,
    overdue: list.filter(s => s === 'late' || s === 'missed').length,
    commitment: commitment === null ? '—' : `${commitment}%`
  }
})
const columns = [
  { key: 'num', label: '#' },
  { key: 'halqa', label: 'الحلقة' },
  { key: 'teacher', label: 'المعلّم' },
  { key: 'visitor', label: 'الزائر' },
  { key: 'date', label: 'الموعد' },
  { key: 'rating', label: 'التقييم' },
  { key: 'status', label: 'الحالة' },
  { key: 'actions', label: 'إجراءات', align: 'end' as const }
]
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
      subtitle="جدولة الزيارات ومتابعة الالتزام بمواعيدها ونتائجها."
    >
      <template #actions>
        <UButton
          v-if="canSchedule"
          label="جدولة زيارة"
          color="primary"
          size="lg"
          icon="i-lucide-plus"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="openSchedule(null)"
        />
      </template>
    </UiPageHeader>

    <div class="filters">
      <UiSelect
        v-model="period"
        :items="periodItems"
        size="xl"
        class="sel"
        aria-label="الشهر"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
      <UiSelect
        v-if="!isFieldSupervisor"
        v-model="supervisorF"
        :items="supervisorItems"
        size="xl"
        class="sel wide"
        aria-label="المشرف"
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
        label="تمّت في وقتها"
        tone="green"
      />
      <UiStatCard
        icon="i-lucide-circle-alert"
        :value="stats.overdue"
        label="متأخّرة / فائتة"
        tone="err"
      />
      <UiStatCard
        icon="i-lucide-gauge"
        :value="stats.commitment"
        label="الالتزام بالمواعيد"
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
          <span class="muted">{{ row.flow_rating || '—' }}</span>
        </template>
        <template #status="{ row }">
          <UBadge
            :label="VISIT_STATUS[display(row)]?.label"
            :color="VISIT_STATUS[display(row)]?.color"
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
              { label: 'الزائر', value: row.supervisor?.full_name },
              { label: 'التقييم', value: row.flow_rating, muted: !row.flow_rating }
            ]"
          >
            <template #badge>
              <UBadge
                :label="VISIT_STATUS[display(row)]?.label"
                :color="VISIT_STATUS[display(row)]?.color"
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
                @click="openSchedule(row)"
              />
              <UButton
                v-if="isAdmin || canEditVisit(row)"
                class="icon-only"
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                aria-label="حذف"
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
