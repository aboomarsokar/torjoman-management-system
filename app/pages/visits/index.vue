<script setup lang="ts">
/**
 * الزيارات الإشرافية (§4.15).
 * المديران (الإداري والفني) والمشرف الميداني يجدولون زيارة لحلقة ثم ترفع نتائجها (نقاط قوة/تحسين/توصيات/تقييم).
 * الزائر قد يكون مشرفاً ميدانياً أو أحد المديرَين (يزور بصفته).
 * RLS: المديران يديران الكل، والمشرف الميداني زياراته. الحذف للمديرَين. مشرف المشروع والمديرة الإدارية للاطّلاع.
 */
import type { Database } from '~/types/database.types'
import { roleLabel, type Role } from '~/constants/roles'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الزيارات الإشرافية — ترجمان' })

type VisitStatus = Database['public']['Enums']['visit_status']
type VisitRow = Database['public']['Tables']['supervision_visits']['Row'] & {
  halaqa: { name: string, teacher: { full_name: string } | null } | null
  supervisor: { full_name: string, role: Role, gender: Gender | null } | null
}
type Gender = Database['public']['Enums']['gender_type']
type VisitorRow = { id: string, full_name: string, role: Role, gender: Gender | null }
/** أدوار الزائر: المديران والمشرف الميداني. */
const VISITOR_ROLES: Role[] = ['admin_manager', 'technical_manager', 'field_supervisor']
type HalqaOption = { id: string, name: string, daily_time: string | null, teacher: { full_name: string } | null }

const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()
const { isManager, isFieldSupervisor } = usePermissions()
const canSchedule = computed(() => isManager.value || isFieldSupervisor.value)
/**
 * تعديل زيارةٍ قائمة (موعدها أو نتيجتها): المديران لكل زيارة، والمشرف الميداني لزياراته هو وحده
 * (visits_update: supervisor_id = auth.uid()) — لا لزيارةٍ جدولها مديرٌ لحلقته باسم غيره.
 */
function canEditVisit(v: VisitRow) {
  return isManager.value || (isFieldSupervisor.value && v.supervisor_id === profile.value?.id)
}
/** تحديثٌ لم يمسّ صفّاً = رفضته RLS بصمت — يُعرض خطأً لا نجاحاً. */
const VISIT_NOT_UPDATED = 'لم يُحفظ التغيير — هذه الزيارة ليست ضمن صلاحيتك.'

// جلب غير حاجز (useLazyAsyncData): الاستعلامات الثلاثة مستقلّة وتعمل بالتوازي تلقائياً
const { data: visits, refresh, pending } = useLazyAsyncData<VisitRow[]>(
  'visits-list',
  async () => {
    const { data, error } = await supabase
      .from('supervision_visits')
      .select('*, halaqa:halaqa_id(name, teacher:teacher_id(full_name)), supervisor:supervisor_id(full_name, role, gender)')
      .order('scheduled_at', { ascending: false })
      .returns<VisitRow[]>()
    if (error) {
      console.error('[visits] فشل الجلب:', error.message)
      return []
    }
    return data ?? []
  },
  { server: false, default: () => [] }
)
const { data: halqat } = useLazyAsyncData<HalqaOption[]>('visits-halqat', async () => {
  const { data } = await supabase
    .from('halaqat')
    .select('id, name, daily_time, teacher:teacher_id(full_name)')
    .order('name')
    .returns<HalqaOption[]>()
  return data ?? []
}, { server: false, default: () => [] })
// الزائر: أحد المديرَين أو مشرف ميداني (المدير يزور بصفته أيضاً)
const { data: visitors } = useLazyAsyncData<VisitorRow[]>('visits-visitors', async () => {
  const { data } = await supabase.from('profiles').select('id, full_name, role, gender').in('role', VISITOR_ROLES).eq('status', 'active').order('full_name')
  return data ?? []
}, { server: false, default: () => [] })
const halqaItems = computed(() => (halqat.value ?? []).map(h => ({
  label: h.teacher?.full_name ? `${h.name} — ${h.teacher.full_name}` : h.name,
  value: h.id
})))
const visitorItems = computed(() => (visitors.value ?? []).map(v => ({
  label: v.role === 'field_supervisor' ? v.full_name : `${v.full_name} (${roleLabel(v.role, v.gender)})`,
  value: v.id
})))

const statusF = ref<VisitStatus | 'all'>('all')
const chipOptions = [
  { value: 'all' as const, label: 'الكل' },
  { value: 'scheduled' as const, label: 'مجدولة' },
  { value: 'done' as const, label: 'تمّت' },
  { value: 'late' as const, label: 'متأخّرة' },
  { value: 'missed' as const, label: 'فائتة' }
]
const filtered = computed(() => (visits.value ?? []).filter(v => statusF.value === 'all' || v.status === statusF.value))
const stats = computed(() => {
  const list = visits.value ?? []
  return {
    scheduled: list.filter(v => v.status === 'scheduled').length,
    done: list.filter(v => v.status === 'done').length,
    overdue: list.filter(v => v.status === 'late' || v.status === 'missed').length
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
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })
}

// ── جدولة ──
const schedOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const sched = reactive({ halaqa_id: '', supervisor_id: '', scheduled_at: '' })
// وقت الحلقة المختارة (يظهر كتلميح في نافذة الجدولة)
const selectedHalqaTime = computed(() => {
  const h = (halqat.value ?? []).find(x => x.id === sched.halaqa_id)
  return h?.daily_time ? h.daily_time.slice(0, 5) : ''
})
function openSchedule() {
  editingId.value = null
  sched.halaqa_id = ''
  // من يجدول (المديران والمشرف الميداني) يُعيَّن زائراً افتراضيّاً (نفسه)
  sched.supervisor_id = canSchedule.value ? (profile.value?.id ?? '') : ''
  sched.scheduled_at = ''
  schedOpen.value = true
}
function openEditSchedule(v: VisitRow) {
  editingId.value = v.id
  sched.halaqa_id = v.halaqa_id
  sched.supervisor_id = v.supervisor_id
  sched.scheduled_at = v.scheduled_at ? v.scheduled_at.slice(0, 16) : ''
  schedOpen.value = true
}
function validateSched(s: typeof sched) {
  const e: { name: string, message: string }[] = []
  if (!s.halaqa_id) e.push({ name: 'halaqa_id', message: 'اختر الحلقة.' })
  if (!s.supervisor_id) e.push({ name: 'supervisor_id', message: 'اختر الزائر.' })
  if (!s.scheduled_at) e.push({ name: 'scheduled_at', message: 'حدّد موعد الزيارة.' })
  return e
}
async function saveSchedule() {
  saving.value = true
  try {
    const payload = { halaqa_id: sched.halaqa_id, supervisor_id: sched.supervisor_id, scheduled_at: new Date(sched.scheduled_at).toISOString() }
    if (editingId.value) {
      const { data, error } = await supabase.from('supervision_visits').update(payload).eq('id', editingId.value).select('id')
      if (error) throw error
      if (!data?.length) throw new Error(VISIT_NOT_UPDATED)
    } else {
      const { error } = await supabase.from('supervision_visits').insert(payload)
      if (error) throw error
    }
    toast.add({ title: editingId.value ? 'تم تحديث موعد الزيارة.' : 'تمت جدولة الزيارة.', color: 'success', icon: 'i-lucide-calendar-check' })
    schedOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

// ── تنفيذ ──
const execOpen = ref(false)
const execTarget = ref<VisitRow | null>(null)
const execSaving = ref(false)
const result = reactive({ flow_rating: '', strengths: '', improvements: '', recommendations: '', notes: '' })
const ratingItems = [
  { label: 'ممتاز', value: 'ممتاز' },
  { label: 'جيد جداً', value: 'جيد جداً' },
  { label: 'جيد', value: 'جيد' },
  { label: 'يحتاج تحسين', value: 'يحتاج تحسين' }
]
function openExec(v: VisitRow) {
  execTarget.value = v
  result.flow_rating = v.flow_rating ?? 'ممتاز'
  result.strengths = v.strengths ?? ''
  result.improvements = v.improvements ?? ''
  result.recommendations = v.recommendations ?? ''
  result.notes = v.notes ?? ''
  execOpen.value = true
}
async function saveResult() {
  if (!execTarget.value) return
  execSaving.value = true
  try {
    const payload = {
      flow_rating: result.flow_rating || null,
      strengths: result.strengths.trim() || null,
      improvements: result.improvements.trim() || null,
      recommendations: result.recommendations.trim() || null,
      notes: result.notes.trim() || null,
      executed_at: execTarget.value.executed_at ?? new Date().toISOString(),
      status: 'done' as VisitStatus
    }
    const { data, error } = await supabase.from('supervision_visits').update(payload).eq('id', execTarget.value.id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error(VISIT_NOT_UPDATED)
    toast.add({ title: 'تم رفع نتيجة الزيارة.', color: 'success', icon: 'i-lucide-circle-check' })
    execOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    execSaving.value = false
  }
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
      subtitle="جدولة الزيارات ومتابعة الالتزام بمواعيدها ورفع نتائجها."
    >
      <template #actions>
        <UButton
          v-if="canSchedule"
          label="جدولة زيارة"
          color="primary"
          size="lg"
          icon="i-lucide-plus"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="openSchedule"
        />
      </template>
    </UiPageHeader>

    <div class="stats">
      <UiStatCard
        icon="i-lucide-calendar"
        :value="stats.scheduled"
        label="زيارة مجدولة"
        tone="blue"
      />
      <UiStatCard
        icon="i-lucide-circle-check-big"
        :value="stats.done"
        label="زيارة تمّت"
        tone="green"
      />
      <UiStatCard
        icon="i-lucide-circle-alert"
        :value="stats.overdue"
        label="متأخّرة / فائتة"
        tone="err"
      />
    </div>

    <UiFilterChips
      v-model="statusF"
      :options="chipOptions"
      class="mb-4"
    />

    <ClientOnly>
      <UiSkeletonTable
        v-if="pending"
        :columns="columns"
      />
      <UiEmptyState
        v-else-if="filtered.length === 0"
        icon="i-lucide-clipboard-check"
        title="لا زيارات في هذا التصنيف"
        :description="canSchedule ? 'جدوِل زيارة جديدة لتظهر هنا.' : 'لا زيارات في نطاقك حاليّاً.'"
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
              v-if="row.supervisor"
              :label="roleLabel(row.supervisor.role, row.supervisor.gender)"
              :color="row.supervisor.role === 'field_supervisor' ? 'info' : 'primary'"
              variant="soft"
              size="sm"
            />
          </div>
        </template>
        <template #date="{ row }">
          <span class="muted">{{ fmtDate(row.scheduled_at) }}</span>
        </template>
        <template #rating="{ row }">
          <span class="muted">{{ row.flow_rating || '—' }}</span>
        </template>
        <template #status="{ row }">
          <UBadge
            :label="VISIT_STATUS[row.status]?.label"
            :color="VISIT_STATUS[row.status]?.color"
            variant="soft"
          />
        </template>
        <template #actions="{ row }">
          <div class="actions">
            <UButton
              v-if="row.status === 'done' || canEditVisit(row)"
              :label="row.status === 'done' ? 'النتيجة' : 'تنفيذ'"
              :color="row.status === 'done' ? 'neutral' : 'primary'"
              :variant="row.status === 'done' ? 'outline' : 'solid'"
              size="sm"
              :icon="row.status === 'done' ? 'i-lucide-eye' : 'i-lucide-clipboard-pen'"
              :ui="{ base: 'rounded-[10px]' }"
              @click="openExec(row)"
            />
            <UButton
              v-if="canEditVisit(row)"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-pencil"
              :ui="{ base: 'rounded-[10px]' }"
              aria-label="تعديل الموعد"
              @click="openEditSchedule(row)"
            />
            <UButton
              v-if="isManager"
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
      </UiDataTable>
    </ClientOnly>

    <!-- نافذة الجدولة -->
    <UModal
      v-model:open="schedOpen"
      :title="editingId ? 'تعديل موعد الزيارة' : 'جدولة زيارة'"
    >
      <template #body>
        <UForm
          :state="sched"
          :validate="validateSched"
          class="form"
          @submit="saveSchedule"
        >
          <UFormField
            label="الحلقة"
            name="halaqa_id"
            :hint="selectedHalqaTime ? `وقت الحلقة اليومي: ${selectedHalqaTime}` : ''"
          >
            <UiSelect
              v-model="sched.halaqa_id"
              :items="halqaItems"
              placeholder="اختر الحلقة"
              size="lg"
            />
          </UFormField>
          <UFormField
            label="الزائر"
            name="supervisor_id"
            :hint="visitorItems.length ? 'المدير أو أحد المشرفين' : 'لا زائرون متاحون بعد'"
          >
            <UiSelect
              v-model="sched.supervisor_id"
              :items="visitorItems"
              placeholder="اختر الزائر"
              size="lg"
            />
          </UFormField>
          <UFormField
            label="موعد الزيارة"
            name="scheduled_at"
          >
            <UInput
              v-model="sched.scheduled_at"
              type="datetime-local"
              dir="ltr"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <div class="form-actions">
            <UButton
              label="إلغاء"
              color="neutral"
              variant="ghost"
              size="lg"
              :ui="{ base: 'rounded-[13px]' }"
              @click="schedOpen = false"
            />
            <UButton
              type="submit"
              :label="editingId ? 'حفظ' : 'جدولة'"
              color="primary"
              size="lg"
              :loading="saving"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
            />
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- نافذة التنفيذ -->
    <UModal
      v-model:open="execOpen"
      :title="`نتيجة زيارة ${execTarget?.halaqa?.name || ''}`"
    >
      <template #body>
        <div class="form">
          <UFormField label="تقييم سير الحلقة">
            <USelect
              v-model="result.flow_rating"
              :items="ratingItems"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField label="نقاط القوة">
            <UTextarea
              v-model="result.strengths"
              :rows="2"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField label="جوانب التحسين">
            <UTextarea
              v-model="result.improvements"
              :rows="2"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField label="التوصيات">
            <UTextarea
              v-model="result.recommendations"
              :rows="2"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField label="ملاحظات إضافية">
            <UTextarea
              v-model="result.notes"
              :rows="2"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <div class="form-actions">
            <UButton
              label="إغلاق"
              color="neutral"
              variant="ghost"
              size="lg"
              :ui="{ base: 'rounded-[13px]' }"
              @click="execOpen = false"
            />
            <UButton
              v-if="execTarget && canEditVisit(execTarget)"
              label="حفظ النتيجة"
              color="primary"
              size="lg"
              icon="i-lucide-check"
              :loading="execSaving"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
              @click="saveResult"
            />
          </div>
        </div>
      </template>
    </UModal>

    <!-- تأكيد الحذف -->
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
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 22px; }
.mb-4 { margin-bottom: 18px; }
.strong { font-weight: 600; color: var(--ink); white-space: nowrap; }
.visitor-cell { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.muted { color: var(--ink-2); white-space: nowrap; }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.form { display: flex; flex-direction: column; gap: 14px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }

@media (max-width: 768px) { .stats { grid-template-columns: 1fr; } }
</style>
