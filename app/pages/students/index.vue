<script setup lang="ts">
/**
 * دليل الطلاب (§4.23) — لكل طالب حساب يدخل به برقم هويته.
 * قائمة + إضافة/تعديل/حذف وإسناد للحلقة، تصفية بالحالة والحلقة.
 * الإضافة للمدير الإداري وحده عبر POST /api/students (ينشئ الحساب في الخطوة نفسها)،
 * والإسناد (الحلقة) لمن يملكه في نطاقه (canAssign)، والمعلّم يعدّل بيانات طلاب حلقته فقط.
 * الهوية والجنس للمدير الإداري وحده (حارس القاعدة)، والحذف له.
 */
import type { Database } from '~/types/database.types'
import { DEFAULT_PASSWORD } from '~/constants/auth'
import { IDENTITY_ERROR, isValidIdentity, normalizeDigits } from '~/constants/identity'
import { displayPhotoPath } from '~/constants/profilePhoto'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الطلاب — ترجمان' })

type Gender = Database['public']['Enums']['gender_type']
type StudentStatus = Database['public']['Enums']['student_status']
type StudentRow = Database['public']['Tables']['students']['Row'] & {
  halaqa: { name: string, teacher: { full_name: string } | null } | null
}
type HalqaOpt = { id: string, name: string, gender: Gender, daily_time: string | null, teacher: { full_name: string } | null }

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()

const { isAdmin, canAssign, isTeacher, isReadOnly } = usePermissions()
/** التعديل: من يملك الإسناد في نطاقه أو معلّم الحلقة — لا مشرف المشروع. */
const canManage = computed(() => !isReadOnly.value && (canAssign.value || isTeacher.value))
const canCreate = isAdmin
const canDelete = isAdmin
const HALQA_NONE = 'none'

// جلب غير حاجز (useLazyAsyncData): الاستعلامان مستقلّان ويعملان بالتوازي تلقائياً
const { data: students, refresh, pending } = useLazyAsyncData<StudentRow[]>(
  'students-list',
  async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*, halaqa:halaqa_id(name, teacher:teacher_id(full_name))')
      .order('created_at', { ascending: false })
      .returns<StudentRow[]>()
    if (error) {
      console.error('[students] فشل الجلب:', error.message)
      return []
    }
    return data ?? []
  },
  { server: false, default: () => [] }
)

const { data: halqat } = useLazyAsyncData<HalqaOpt[]>('students-halqat', async () => {
  const { data } = await supabase
    .from('halaqat')
    .select('id, name, gender, daily_time, teacher:teacher_id(full_name)')
    .order('name')
    .returns<HalqaOpt[]>()
  return data ?? []
}, { server: false, default: () => [] })
function halqaLabel(h: HalqaOpt) {
  return h.teacher?.full_name ? `${h.name} — ${h.teacher.full_name}` : h.name
}
// قائمة الإسناد: تفاصيل كاملة لتمييز الحلقة. قائمة التصفية: الاسم فقط (أوجز).
// قائمة الإسناد مقصورة على حلقات جنس الطالب المختار (جنس الطالب يطابق جنس الحلقة)
const halqaItems = computed(() => [
  { label: 'بلا حلقة', value: HALQA_NONE },
  ...(halqat.value ?? []).filter(h => h.gender === form.gender).map(h => ({ label: halqaLabel(h), value: h.id }))
])
const halqaFilterItems = computed(() => [{ label: 'كل الحلقات', value: 'all' }, ...(halqat.value ?? []).map(h => ({ label: h.name, value: h.id }))])

const statusF = ref<StudentStatus | 'all'>('all')
const halqaF = ref<string>('all')
function countFor(key: StudentStatus | 'all') {
  const list = students.value ?? []
  return key === 'all' ? list.length : list.filter(s => s.status === key).length
}
const chipOptions = computed(() => ([
  { value: 'all' as const, label: 'الكل' },
  { value: 'active' as const, label: 'نشط' },
  { value: 'withdrawn' as const, label: 'منقطع' },
  { value: 'graduated' as const, label: 'متخرّج' },
  { value: 'transferred' as const, label: 'منقول' }
]).map(c => ({ ...c, count: countFor(c.value) })))
const filtered = computed(() => (students.value ?? []).filter(s =>
  (statusF.value === 'all' || s.status === statusF.value)
  && (halqaF.value === 'all' || s.halaqa_id === halqaF.value)
))
const { page, pageCount, total, pageSize, paged, resetPage } = usePagination(filtered, 12)
watch([statusF, halqaF], resetPage)
const columns = computed(() => {
  const base = [
    { key: 'num', label: '#' },
    { key: 'student', label: 'الطالب' },
    { key: 'halqa', label: 'الحلقة' },
    { key: 'teacher', label: 'المعلّم' },
    { key: 'parts', label: 'الأجزاء المحفوظة' },
    { key: 'status', label: 'الحالة' }
  ]
  // عمود الإجراءات للجميع: «عرض الملف» متاح لكل من يرى الطالب، والتعديل والحذف مقيّدان داخله
  return [...base, { key: 'actions', label: 'إجراءات', align: 'end' as const }]
})
// الصور الشخصية: صورة الطالب على حسابه (profiles عبر students.user_id). لا مفتاح بين الجدولين
// لـPostgREST، فتُجلب مسارات حسابات الطلاب ذوات الصور وحدها (قليلة) في طلبٍ واحد بلا قائمة معرّفات.
const { data: studentPhotoPaths } = useLazyAsyncData<Record<string, string>>('students-photo-paths', async () => {
  const { data } = await supabase
    .from('profiles')
    .select('id, photo_path')
    .eq('role', 'student')
    .not('photo_path', 'is', null)
  return Object.fromEntries((data ?? []).flatMap(p => p.photo_path ? [[p.id, p.photo_path]] : []))
}, { server: false, default: () => ({}) })
function studentPhotoPath(s: StudentRow) {
  return displayPhotoPath({ gender: s.gender, photo_path: s.user_id ? studentPhotoPaths.value?.[s.user_id] : null })
}
const { prime: primePhotos, urlFor: photoUrlFor } = useProfilePhotoUrls()
watch([paged, studentPhotoPaths], ([rows]) => void primePhotos(rows.map(studentPhotoPath)), { immediate: true })
// ── إضافة/تعديل ──
const modalOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const TAJWEED_NONE = 'none'
const form = reactive({
  full_name: '', national_id: '', gender: 'male' as Gender, birth_date: '', family_count: '',
  halaqa_id: HALQA_NONE, quran_parts: '', tajweed_level: TAJWEED_NONE,
  residence: '', nearest_mosque: '',
  guardian_name: '', guardian_phone: '', phone: '', guardian_email: '', enrollment_date: '',
  status: 'active' as StudentStatus
})
// تغيير الجنس إلى الآخر يُسقط حلقةً من غير جنسه (القاعدة والخادم يرفضانها)
watch(() => form.gender, (g) => {
  const cur = (halqat.value ?? []).find(h => h.id === form.halaqa_id)
  if (cur && cur.gender !== g) form.halaqa_id = HALQA_NONE
})
const tajweedItems = [
  { label: '—', value: TAJWEED_NONE },
  { label: 'تأهيلية', value: 'تأهيلية' },
  { label: 'عليا', value: 'عليا' },
  { label: 'تأهيل سند', value: 'تأهيل سند' },
  { label: 'سند', value: 'سند' }
]
const genderItems = [{ label: 'ذكر', value: 'male' }, { label: 'أنثى', value: 'female' }]
const statusItems = [
  { label: 'نشط', value: 'active' },
  { label: 'منقطع', value: 'withdrawn' },
  { label: 'متخرّج', value: 'graduated' },
  { label: 'منقول', value: 'transferred' }
]
function openCreate() {
  editingId.value = null
  Object.assign(form, {
    full_name: '', national_id: '', gender: 'male', birth_date: '', family_count: '',
    halaqa_id: HALQA_NONE, quran_parts: '', tajweed_level: TAJWEED_NONE,
    residence: '', nearest_mosque: '',
    guardian_name: '', guardian_phone: '', phone: '', guardian_email: '', enrollment_date: '',
    status: 'active'
  })
  modalOpen.value = true
}
function openEdit(s: StudentRow) {
  editingId.value = s.id
  Object.assign(form, {
    full_name: s.full_name,
    national_id: s.national_id ?? '',
    gender: s.gender ?? 'male',
    birth_date: s.birth_date ?? '',
    family_count: s.family_count != null ? String(s.family_count) : '',
    halaqa_id: s.halaqa_id ?? HALQA_NONE,
    quran_parts: s.quran_parts != null ? String(s.quran_parts) : '',
    tajweed_level: s.tajweed_level ?? TAJWEED_NONE,
    residence: s.residence ?? '',
    nearest_mosque: s.nearest_mosque ?? '',
    guardian_name: s.guardian_name ?? '',
    guardian_phone: s.guardian_phone ?? '',
    phone: s.phone ?? '',
    guardian_email: s.guardian_email ?? '',
    enrollment_date: s.enrollment_date ?? '',
    status: s.status
  })
  modalOpen.value = true
}
function validate(s: typeof form) {
  const errors: { name: string, message: string }[] = []
  if (!s.full_name.trim()) errors.push({ name: 'full_name', message: 'اسم الطالب مطلوب.' })
  // الهوية إلزامية عند الإضافة (معرّف دخول الطالب)، وتُفحص صيغتها متى عدّلها المدير الإداري
  if ((!editingId.value || isAdmin.value) && !isValidIdentity(s.national_id)) errors.push({ name: 'national_id', message: IDENTITY_ERROR })
  if (s.quran_parts && (Number(s.quran_parts) < 0 || Number(s.quran_parts) > 30)) errors.push({ name: 'quran_parts', message: 'الأجزاء بين 0 و30.' })
  return errors
}
/** إضافة طالب (المدير الإداري): الخادم ينشئ الحساب وصفّ الطالب، ثم تُكمَل بقية البيانات بتحديث. */
async function createStudent(details: Database['public']['Tables']['students']['Update']) {
  const created = await $fetch('/api/students', {
    method: 'POST',
    body: {
      full_name: form.full_name.trim(),
      gender: form.gender,
      national_id: normalizeDigits(form.national_id.trim()),
      halaqa_id: form.halaqa_id === HALQA_NONE ? undefined : form.halaqa_id,
      birth_date: form.birth_date || undefined,
      guardian_phone: form.guardian_phone.trim() || undefined,
      password: DEFAULT_PASSWORD
    }
  })
  const { error } = await supabase.from('students').update(details).eq('id', created.id)
  if (error) throw error
}

async function save() {
  saving.value = true
  try {
    const identity = {
      national_id: normalizeDigits(form.national_id.trim()) || null,
      gender: form.gender
    }
    const details = {
      full_name: form.full_name.trim(),
      birth_date: form.birth_date || null,
      family_count: form.family_count ? Number(form.family_count) : null,
      quran_parts: form.quran_parts ? Number(form.quran_parts) : null,
      tajweed_level: form.tajweed_level === TAJWEED_NONE ? null : form.tajweed_level,
      residence: form.residence.trim() || null,
      nearest_mosque: form.nearest_mosque.trim() || null,
      guardian_name: form.guardian_name.trim() || null,
      guardian_phone: form.guardian_phone.trim() || null,
      phone: form.phone.trim() || null,
      guardian_email: form.guardian_email.trim() || null,
      enrollment_date: form.enrollment_date || null,
      status: form.status
    }
    if (editingId.value) {
      // الهوية والجنس للمدير الإداري وحده، والحلقة لمن يملك الإسناد — لا تُرسل لغيرهما (حارس القاعدة يرفضها)
      const payload = {
        ...details,
        ...(isAdmin.value ? identity : {}),
        ...(canAssign.value ? { halaqa_id: form.halaqa_id === HALQA_NONE ? null : form.halaqa_id } : {})
      }
      const { error } = await supabase.from('students').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      await createStudent(details)
    }
    toast.add({
      title: editingId.value ? 'تم تحديث بيانات الطالب.' : 'تمت إضافة الطالب — يدخل برقم هويته وكلمة المرور المبدئية.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    modalOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

// ── حذف ──
const deleteTarget = ref<StudentRow | null>(null)
const deleting = ref(false)
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const { error } = await supabase.from('students').delete().eq('id', deleteTarget.value.id)
    if (error) throw error
    toast.add({ title: 'تم حذف الطالب.', color: 'neutral', icon: 'i-lucide-trash-2' })
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
  <div class="students">
    <UiPageHeader
      title="الطلاب"
      subtitle="سجلّ الطلاب وبياناتهم وإسنادهم للحلقات — يدخل الطالب برقم هويته."
    >
      <template #actions>
        <UButton
          v-if="canCreate"
          label="إضافة طالب"
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
        v-model="statusF"
        :options="chipOptions"
      />
      <USelect
        v-model="halqaF"
        :items="halqaFilterItems"
        size="md"
        class="halqa-sel"
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
        icon="i-lucide-graduation-cap"
        title="لا طلاب بعد"
        :description="canCreate ? 'أضِف أول طالب واربطه بحلقته ليظهر هنا.' : 'لا طلاب في نطاقك حاليّاً.'"
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
        <template #student="{ row }">
          <div class="user-cell">
            <div class="av">
              <ProfileAvatar
                :name="row.full_name"
                :photo-url="photoUrlFor(studentPhotoPath(row))"
              />
            </div>
            <div>
              <div class="u-name">
                {{ row.full_name }}
              </div>
              <div
                v-if="row.national_id"
                class="u-sub"
                dir="ltr"
              >
                {{ row.national_id }}
              </div>
            </div>
          </div>
        </template>
        <template #halqa="{ row }">
          <span class="muted">{{ row.halaqa?.name || '—' }}</span>
        </template>
        <template #teacher="{ row }">
          <span class="muted">{{ row.halaqa?.teacher?.full_name || '—' }}</span>
        </template>
        <template #parts="{ row }">
          <span class="muted">{{ row.quran_parts != null ? `${row.quran_parts} جزء` : '—' }}</span>
        </template>
        <template #status="{ row }">
          <UBadge
            :label="STUDENT_STATUS[row.status]?.label"
            :color="STUDENT_STATUS[row.status]?.color"
            variant="soft"
          />
        </template>
        <template #actions="{ row }">
          <div class="actions">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-eye"
              :ui="{ base: 'rounded-[10px]' }"
              aria-label="عرض الملف"
              @click="navigateTo(`/students/${row.id}`)"
            />
            <UButton
              v-if="canManage"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-pencil"
              :ui="{ base: 'rounded-[10px]' }"
              aria-label="تعديل"
              @click="openEdit(row)"
            />
            <UButton
              v-if="canDelete"
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

    <!-- نافذة إضافة/تعديل -->
    <UModal
      v-model:open="modalOpen"
      :title="editingId ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'"
    >
      <template #body>
        <UForm
          :state="form"
          :validate="validate"
          class="form"
          @submit="save"
        >
          <UFormField
            label="اسم الطالب"
            name="full_name"
          >
            <UInput
              v-model="form.full_name"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <div class="row">
            <UFormField
              label="الجنس"
              name="gender"
              class="f"
            >
              <UiSelect
                v-model="form.gender"
                :items="genderItems"
                :disabled="!!editingId && !isAdmin"
                size="lg"
              />
            </UFormField>
            <UFormField
              label="الحلقة"
              name="halaqa_id"
              class="f"
            >
              <UiSelect
                v-model="form.halaqa_id"
                :items="halqaItems"
                :disabled="!canAssign"
                size="lg"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="رقم الهوية"
              name="national_id"
              class="f"
              :required="!editingId"
              :hint="editingId ? undefined : 'معرّف دخول الطالب'"
            >
              <UInput
                v-model="form.national_id"
                :disabled="!!editingId && !isAdmin"
                inputmode="numeric"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="تاريخ الميلاد"
              name="birth_date"
              class="f"
            >
              <UInput
                v-model="form.birth_date"
                type="date"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="اسم وليّ الأمر"
              name="guardian_name"
              class="f"
            >
              <UInput
                v-model="form.guardian_name"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="هاتف وليّ الأمر"
              name="guardian_phone"
              class="f"
            >
              <UInput
                v-model="form.guardian_phone"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="الأجزاء المحفوظة"
              name="quran_parts"
              class="f"
            >
              <UInput
                v-model="form.quran_parts"
                type="number"
                min="0"
                max="30"
                dir="ltr"
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
              <UiSelect
                v-model="form.status"
                :items="statusItems"
                size="lg"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="عدد الأفراد"
              name="family_count"
              class="f"
            >
              <UInput
                v-model="form.family_count"
                type="number"
                min="0"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="الأحكام (التجويد)"
              name="tajweed_level"
              class="f"
            >
              <UiSelect
                v-model="form.tajweed_level"
                :items="tajweedItems"
                size="lg"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="السكن (المنطقة/الحي)"
              name="residence"
              class="f"
            >
              <UInput
                v-model="form.residence"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="أقرب مسجد"
              name="nearest_mosque"
              class="f"
            >
              <UInput
                v-model="form.nearest_mosque"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="جوال الطالب"
              name="phone"
              class="f"
            >
              <UInput
                v-model="form.phone"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="تاريخ الالتحاق"
              name="enrollment_date"
              class="f"
            >
              <UInput
                v-model="form.enrollment_date"
                type="date"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <UFormField
            label="بريد وليّ الأمر (اختياري)"
            name="guardian_email"
          >
            <UInput
              v-model="form.guardian_email"
              type="email"
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
              @click="modalOpen = false"
            />
            <UButton
              type="submit"
              :label="editingId ? 'حفظ التغييرات' : 'إضافة الطالب'"
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
      title="حذف الطالب"
      :loading="deleting"
      @update:open="v => { if (!v) deleteTarget = null }"
      @confirm="confirmDelete"
    >
      هل أنت متأكّد من حذف الطالب «<strong>{{ deleteTarget?.full_name }}</strong>»؟ لا يمكن التراجع.
    </UiConfirmModal>
  </div>
</template>

<style scoped>
.students { max-width: 1280px; margin: 0 auto; }
.filters { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 20px; }
.halqa-sel { min-width: 180px; }
.muted { color: var(--ink-2); white-space: nowrap; }
.user-cell { display: flex; align-items: center; gap: 11px; }
.av { width: 40px; height: 40px; border-radius: 11px; background: var(--green-ink); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex: none; overflow: hidden; }
.u-name { font-weight: 600; color: var(--ink); }
.u-sub { font-size: 13px; color: var(--ink-3); }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }

.form { display: flex; flex-direction: column; gap: 14px; }
.row { display: flex; gap: 14px; flex-wrap: wrap; }
.row .f { flex: 1; min-width: 150px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }

@media (max-width: 640px) { .u-sub { display: none; } }
</style>
