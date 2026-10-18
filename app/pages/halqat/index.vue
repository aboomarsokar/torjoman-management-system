<script setup lang="ts">
/**
 * الحلقات (§4.13) — الإدارة للمديرَين الإداري والفني (والحذف للإداري)، والبقية للاطّلاع ضمن نطاقهم.
 * إنشاء/تعديل/حذف حلقة وتعيين معلّم ومشرف ومختبِر لها، مع تصفية بالجنس والحالة.
 * المختبِر يُقترح تلقائياً حين يوجد مختبِرٌ نشطٌ واحدٌ من جنس الحلقة.
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الحلقات — ترجمان' })

type Gender = Database['public']['Enums']['gender_type']
type Classification = Database['public']['Enums']['halaqa_classification']
type Status = Database['public']['Enums']['halaqa_status']
type HalaqaRow = Database['public']['Tables']['halaqat']['Row'] & {
  teacher: { full_name: string } | null
  supervisor: { full_name: string } | null
  examiner: { full_name: string } | null
  student_count: { count: number }[]
}
type NameRow = { id: string, full_name: string }
type ExaminerRow = NameRow & { gender: Gender | null }

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()
/** الإنشاء والتعديل للمديرَين (الإداري والفني)، والحذف للمدير الإداري — كما يسمح RLS. */
const { isManager, isAdmin } = usePermissions()

// جلب غير حاجز (useLazyAsyncData): لا يوقف عرض الصفحة — تظهر فوراً
// بحالة pending، والسكيلتون يغطّي الانتظار ريثما تصل البيانات. الاستعلامات
// الثلاثة مستقلّة، تعمل بالتوازي تلقائياً (لا حاجة لـ Promise.all هنا).
const { data: halqat, refresh, pending } = useLazyAsyncData<HalaqaRow[]>(
  'halqat-list',
  async () => {
    const { data, error } = await supabase
      .from('halaqat')
      .select('*, teacher:teacher_id(full_name), supervisor:supervisor_id(full_name), examiner:examiner_id(full_name), student_count:students(count)')
      .order('created_at', { ascending: false })
      .returns<HalaqaRow[]>()
    if (error) {
      console.error('[halqat] فشل الجلب:', error.message)
      return []
    }
    return data ?? []
  },
  { server: false, default: () => [] }
)
const { data: teachers } = useLazyAsyncData<NameRow[]>('teachers-options', async () => {
  const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'teacher').eq('status', 'active').order('full_name')
  return data ?? []
}, { server: false, default: () => [] })
const { data: supervisors } = useLazyAsyncData<NameRow[]>('supervisors-options', async () => {
  const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'field_supervisor').eq('status', 'active').order('full_name')
  return data ?? []
}, { server: false, default: () => [] })

const { data: examiners } = useLazyAsyncData<ExaminerRow[]>('examiners-options', async () => {
  const { data } = await supabase.from('profiles').select('id, full_name, gender').eq('role', 'examiner').eq('status', 'active').order('full_name')
  return data ?? []
}, { server: false, default: () => [] })

const NO_SUP = 'none'
const teacherItems = computed(() => (teachers.value ?? []).map(t => ({ label: t.full_name, value: t.id })))
const supervisorItems = computed(() => [{ label: 'بلا مشرف', value: NO_SUP }, ...(supervisors.value ?? []).map(s => ({ label: s.full_name, value: s.id }))])

const genderF = ref<Gender | 'all'>('all')
const statusF = ref<Status | 'all'>('all')
const genderChips = [
  { value: 'all' as const, label: 'الكل' },
  { value: 'male' as const, label: 'بنين' },
  { value: 'female' as const, label: 'بنات' }
]
const filtered = computed(() => (halqat.value ?? []).filter(h =>
  (genderF.value === 'all' || h.gender === genderF.value)
  && (statusF.value === 'all' || h.status === statusF.value)
))
const { page, pageCount, total, pageSize, paged, resetPage } = usePagination(filtered, 12)
watch([genderF, statusF], resetPage)
function studentsOf(h: HalaqaRow) {
  return h.student_count?.[0]?.count ?? 0
}
const GENDER_LABEL: Record<Gender, string> = { male: 'بنين', female: 'بنات' }
const CLASS_LABEL: Record<Classification, string> = { a: 'الفئة أ', b: 'الفئة ب' }

const columns = computed(() => {
  const base = [
    { key: 'num', label: '#' },
    { key: 'name', label: 'الحلقة' },
    { key: 'teacher', label: 'المعلّم' },
    { key: 'supervisorName', label: 'المشرف' },
    { key: 'examiner', label: 'المختبِر' },
    { key: 'gender', label: 'الجنس' },
    { key: 'students', label: 'الطلاب' },
    { key: 'time', label: 'الوقت اليومي' },
    { key: 'status', label: 'الحالة' }
  ]
  // عمود الإجراءات للجميع: «تفاصيل» لكل من يرى الحلقة (ومنهم مشرف المشروع)، والتعديل والحذف مقيّدان داخله
  return [...base, { key: 'actions', label: 'إجراءات', align: 'end' as const }]
})

// ── إنشاء/تعديل ──
const modalOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({
  name: '', teacher_id: '', supervisor_id: NO_SUP, examiner_id: NO_SUP, daily_time: '',
  gender: 'male' as Gender, classification: 'a' as Classification, status: 'active' as Status
})
const genderItems = [{ label: 'بنين', value: 'male' }, { label: 'بنات', value: 'female' }]

// المختبِرون من جنس الحلقة (ومَن لم يُحدَّد جنسه) — والاقتراح حين يكون واحداً فقط
const examinersFor = (g: Gender) => (examiners.value ?? []).filter(e => !e.gender || e.gender === g)
const examinerItems = computed(() => [
  { label: 'بلا مختبِر', value: NO_SUP },
  ...examinersFor(form.gender).map(e => ({ label: e.full_name, value: e.id }))
])
function suggestedExaminer(g: Gender) {
  const exact = (examiners.value ?? []).filter(e => e.gender === g)
  return exact.length === 1 ? exact[0]!.id : NO_SUP
}
// تغيير جنس الحلقة يُسقط مختبِراً من الجنس الآخر ويقترح البديل (ولا يمسّ مختبِراً
// غير ظاهرٍ في القائمة — كأن يكون معطَّلاً — كي لا يُفرَّغ إسنادٌ قائم بصمت)
watch(() => form.gender, (g) => {
  const cur = (examiners.value ?? []).find(e => e.id === form.examiner_id)
  if (form.examiner_id === NO_SUP || (cur?.gender && cur.gender !== g)) form.examiner_id = suggestedExaminer(g)
})
const classItems = [{ label: 'الفئة أ', value: 'a' }, { label: 'الفئة ب', value: 'b' }]
const statusItems = [{ label: 'نشطة', value: 'active' }, { label: 'متوقفة', value: 'stopped' }]
function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', teacher_id: '', supervisor_id: NO_SUP, examiner_id: suggestedExaminer('male'), daily_time: '', gender: 'male', classification: 'a', status: 'active' })
  modalOpen.value = true
}
function openEdit(h: HalaqaRow) {
  editingId.value = h.id
  Object.assign(form, {
    name: h.name,
    teacher_id: h.teacher_id,
    supervisor_id: h.supervisor_id ?? NO_SUP,
    examiner_id: h.examiner_id ?? NO_SUP,
    daily_time: h.daily_time ? h.daily_time.slice(0, 5) : '',
    gender: h.gender ?? 'male',
    classification: h.classification ?? 'a',
    status: h.status
  })
  modalOpen.value = true
}
function validate(s: typeof form) {
  const errors: { name: string, message: string }[] = []
  if (!s.name.trim()) errors.push({ name: 'name', message: 'اسم الحلقة مطلوب.' })
  if (!s.teacher_id) errors.push({ name: 'teacher_id', message: 'تعيين المعلّم مطلوب.' })
  return errors
}
async function save() {
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      teacher_id: form.teacher_id,
      supervisor_id: form.supervisor_id === NO_SUP ? null : form.supervisor_id,
      examiner_id: form.examiner_id === NO_SUP ? null : form.examiner_id,
      daily_time: form.daily_time || null,
      gender: form.gender,
      classification: form.classification,
      status: form.status
    }
    const { error } = editingId.value
      ? await supabase.from('halaqat').update(payload).eq('id', editingId.value)
      : await supabase.from('halaqat').insert(payload)
    if (error) throw error
    toast.add({ title: editingId.value ? 'تم تحديث الحلقة.' : 'تم إنشاء الحلقة.', color: 'success', icon: 'i-lucide-circle-check' })
    modalOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

// ── حذف ──
const deleteTarget = ref<HalaqaRow | null>(null)
const deleting = ref(false)
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const { error } = await supabase.from('halaqat').delete().eq('id', deleteTarget.value.id)
    if (error) throw error
    toast.add({ title: 'تم حذف الحلقة.', color: 'neutral', icon: 'i-lucide-trash-2' })
    deleteTarget.value = null
    await refresh()
  } catch (err) {
    handle(err, 'تعذّر الحذف — قد تكون الحلقة مرتبطة بطلاب.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="halqat">
    <UiPageHeader
      title="الحلقات"
      :subtitle="isManager ? 'لكل حلقة معلّم ووقت يومي ثابت — أنشئ الحلقات وعيّن معلميها ومشرفيها.' : 'الحلقات ضمن نطاقك — عرض للاطّلاع.'"
    >
      <template
        v-if="isManager"
        #actions
      >
        <UButton
          label="إنشاء حلقة"
          color="primary"
          size="lg"
          icon="i-lucide-plus"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="openCreate"
        />
      </template>
    </UiPageHeader>

    <div class="filters">
      <UiFilterChips
        v-model="genderF"
        :options="genderChips"
      />
      <USelect
        v-model="statusF"
        :items="[{ label: 'كل الحالات', value: 'all' }, ...statusItems]"
        size="md"
        class="status-sel"
        :ui="{ base: 'rounded-[11px]' }"
      />
    </div>

    <ClientOnly>
      <UiSkeletonTable
        v-if="pending"
        :columns="columns"
      />
      <UiEmptyState
        v-else-if="filtered.length === 0"
        icon="i-lucide-book-open"
        title="لا حلقات بعد"
        :description="isManager ? 'أنشئ أول حلقة وعيّن لها معلّماً لتظهر هنا.' : 'لا حلقات ضمن نطاقك بعد.'"
      />
      <UiDataTable
        v-else
        :columns="columns"
        :rows="paged"
        row-key="id"
      >
        <template #num="{ index }">
          <span class="muted">{{ index + 1 }}</span>
        </template>
        <template #name="{ row }">
          <div class="h-cell">
            <div class="hicon">
              <UIcon
                name="i-lucide-book-open"
                class="size-5"
              />
            </div>
            <div>
              <div class="h-name">
                {{ row.name }}
              </div>
              <div
                v-if="row.classification"
                class="h-sub"
              >
                {{ CLASS_LABEL[row.classification] }}
              </div>
            </div>
          </div>
        </template>
        <template #teacher="{ row }">
          <span class="muted">{{ row.teacher?.full_name || '—' }}</span>
        </template>
        <template #supervisorName="{ row }">
          <span
            class="muted"
            :class="{ orphan: !row.supervisor }"
          >{{ row.supervisor?.full_name || 'بلا مشرف' }}</span>
        </template>
        <template #examiner="{ row }">
          <span
            class="muted"
            :class="{ orphan: !row.examiner }"
          >{{ row.examiner?.full_name || 'بلا مختبِر' }}</span>
        </template>
        <template #gender="{ row }">
          <UBadge
            v-if="row.gender"
            :label="GENDER_LABEL[row.gender]"
            :color="row.gender === 'male' ? 'info' : 'secondary'"
            variant="soft"
            size="sm"
          />
          <span
            v-else
            class="muted"
          >—</span>
        </template>
        <template #students="{ row }">
          <span class="muted">{{ studentsOf(row) }}</span>
        </template>
        <template #time="{ row }">
          <span class="muted">{{ row.daily_time ? row.daily_time.slice(0, 5) : '—' }}</span>
        </template>
        <template #status="{ row }">
          <UBadge
            :label="row.status === 'active' ? 'نشطة' : 'متوقفة'"
            :color="row.status === 'active' ? 'success' : 'neutral'"
            variant="soft"
            size="sm"
          />
        </template>
        <template #actions="{ row }">
          <div class="actions">
            <UButton
              :to="`/halqat/${row.id}`"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-eye"
              :ui="{ base: 'rounded-[10px]' }"
              aria-label="تفاصيل"
            />
            <UButton
              v-if="isManager"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-pencil"
              :ui="{ base: 'rounded-[10px]' }"
              aria-label="تعديل"
              @click="openEdit(row)"
            />
            <UButton
              v-if="isAdmin"
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
      <UiPaginator
        v-if="filtered.length"
        :page="page"
        :page-count="pageCount"
        :total="total"
        :page-size="pageSize"
        @update:page="page = $event"
      />
    </ClientOnly>

    <!-- نافذة إنشاء/تعديل -->
    <UModal
      v-model:open="modalOpen"
      :title="editingId ? 'تعديل الحلقة' : 'إنشاء حلقة جديدة'"
    >
      <template #body>
        <UForm
          :state="form"
          :validate="validate"
          class="form"
          @submit="save"
        >
          <UFormField
            label="اسم الحلقة"
            name="name"
          >
            <UInput
              v-model="form.name"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <div class="row">
            <UFormField
              label="المعلّم"
              name="teacher_id"
              class="f"
            >
              <UiSelect
                v-model="form.teacher_id"
                :items="teacherItems"
                placeholder="اختر معلّماً"
                size="lg"
              />
            </UFormField>
            <UFormField
              label="المشرف"
              name="supervisor_id"
              class="f"
            >
              <UiSelect
                v-model="form.supervisor_id"
                :items="supervisorItems"
                size="lg"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="الوقت اليومي"
              name="daily_time"
              class="f"
            >
              <UInput
                v-model="form.daily_time"
                type="time"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="الجنس"
              name="gender"
              class="f"
            >
              <USelect
                v-model="form.gender"
                :items="genderItems"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <UFormField
            label="المختبِر"
            name="examiner_id"
            hint="تذهب ترشيحات الحلقة إليه ليرصدها"
          >
            <UiSelect
              v-model="form.examiner_id"
              :items="examinerItems"
              size="lg"
            />
          </UFormField>
          <div class="row">
            <UFormField
              label="التصنيف"
              name="classification"
              class="f"
            >
              <USelect
                v-model="form.classification"
                :items="classItems"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="الحالة"
              name="status"
              class="f"
            >
              <USelect
                v-model="form.status"
                :items="statusItems"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="form-actions">
            <UButton
              label="إلغاء"
              color="neutral"
              variant="ghost"
              size="lg"
              :ui="{ base: 'rounded-[13px]' }"
              @click="modalOpen = false"
            />
            <UButton
              type="submit"
              :label="editingId ? 'حفظ التغييرات' : 'إنشاء الحلقة'"
              color="primary"
              size="lg"
              :loading="saving"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
            />
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- تأكيد الحذف -->
    <UiConfirmModal
      :open="!!deleteTarget"
      title="حذف الحلقة"
      :loading="deleting"
      @update:open="v => { if (!v) deleteTarget = null }"
      @confirm="confirmDelete"
    >
      هل أنت متأكّد من حذف حلقة «<strong>{{ deleteTarget?.name }}</strong>»؟ لا يمكن التراجع.
    </UiConfirmModal>
  </div>
</template>

<style scoped>
.halqat { max-width: 1280px; margin: 0 auto; }
.filters { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 20px; }
.status-sel { min-width: 150px; }

.h-cell { display: flex; align-items: center; gap: 11px; }
.hicon { width: 40px; height: 40px; border-radius: 11px; background: var(--surface-3); color: var(--ink); display: flex; align-items: center; justify-content: center; flex: none; }
.h-name { font-weight: 600; color: var(--ink); white-space: nowrap; }
.h-sub { font-size: 12.5px; color: var(--ink-3); }
.muted { color: var(--ink-2); white-space: nowrap; }
.muted.orphan { color: var(--ink-3); }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }

.form { display: flex; flex-direction: column; gap: 14px; }
.row { display: flex; gap: 14px; flex-wrap: wrap; }
.row .f { flex: 1; min-width: 150px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
</style>
