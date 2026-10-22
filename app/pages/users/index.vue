<script setup lang="ts">
/**
 * إدارة المستخدمين (§4.12) — للمدير الإداري (ومشرف المشروع والمدير الفني اطّلاعاً بلا كتابة؛ والفنيُّ منها «ادخل بحسابه»).
 * قائمة العاملين + تصفية بالدور + إنشاء حساب برقمٍ وظيفيّ مولَّد (عبر مسار خادمي) + تفعيل/تعطيل.
 * الطلاب لا يظهرون هنا (حساباتهم تُنشأ من شاشة الطلاب).
 */
import type { Database } from '~/types/database.types'
import { staffCredentials, type AccountCredentials } from '~/composables/useAccountAdmin'
import { MANAGER_ROLES, roleLabel, STAFF_ROLES, type Role } from '~/constants/roles'
import { displayPhotoPath } from '~/constants/profilePhoto'
import { userStats } from '~/utils/pageStats'

definePageMeta({ layout: 'dashboard' })

type Gender = Database['public']['Enums']['gender_type']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type UserRow = ProfileRow & { assigner: { full_name: string } | null }

const supabase = useSupabaseClient<Database>()
const { role: myRole } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()
const { isAdmin, isReadOnly, isTechnical, isWomenAdmin: fem } = usePermissions()
// والمديرةُ الإدارية اطّلاعاً على عاملات قسمها، ومنها «ادخلي بحسابها» (طلب المستخدم 2026-10-22)
const canView = computed(() => isAdmin.value || isReadOnly.value || isTechnical.value || fem.value)
useSeoMeta({ title: () => fem.value ? 'عاملات القسم — ترجمان' : 'إدارة المستخدمين — ترجمان' })

const ROLE_COLOR: Record<Role, 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'neutral' | 'error'> = {
  project_supervisor: 'neutral',
  admin_manager: 'primary',
  technical_manager: 'primary',
  women_admin: 'secondary',
  field_supervisor: 'info',
  examiner: 'warning',
  teacher: 'success',
  student: 'neutral'
}
// المدير الفني لا يرى حساباتِ الإدارة هنا: مشرفَ المشروع والمديرَين (ولا نفسَه ولا زملاءه) والمديرةَ الإدارية (طلب المستخدم 2026-10-22)
const HIDDEN_FROM_TECHNICAL: readonly Role[] = ['project_supervisor', 'admin_manager', 'technical_manager', 'women_admin']
// والمديرةُ ما تحتها وحده: المشرفاتُ والمختبِراتُ والمعلّمات — والإناثُ بالجنس صراحةً، فملفّاتُ العاملين كلُّها ظاهرةٌ لها
const UNDER_WOMEN_ADMIN: readonly Role[] = ['field_supervisor', 'examiner', 'teacher']
const visibleRoles = computed(() => fem.value
  ? STAFF_ROLES.filter(r => UNDER_WOMEN_ADMIN.includes(r))
  : isTechnical.value ? STAFF_ROLES.filter(r => !HIDDEN_FROM_TECHNICAL.includes(r)) : STAFF_ROLES)
const { data: users, refresh, pending } = useLazyAsyncData<UserRow[]>(
  'users-list',
  async () => {
    let q = supabase
      .from('profiles')
      .select('*, assigner:assigned_by(full_name)')
      .in('role', visibleRoles.value)
    if (fem.value) q = q.eq('gender', 'female')
    const { data, error } = await q
      .order('created_at', { ascending: false })
      .returns<UserRow[]>()
    if (error) {
      console.error('[users] فشل الجلب:', error.message)
      return []
    }
    return data ?? []
  },
  { server: false, default: () => [], watch: [visibleRoles] }
)

const filter = ref<Role | 'all'>('all')
function countFor(key: Role | 'all') {
  const list = users.value ?? []
  return key === 'all' ? list.length : list.filter(u => u.role === key).length
}
// قائمةٌ منسدلة بعدد كلّ دور (كانت ثمانيةَ أزرارٍ تأخذ ثلاثة أسطر على الجوال — طلب المستخدم 2026-10-20)
const roleFilterItems = computed(() => ([
  { value: 'all' as const, label: 'كل الأدوار' },
  ...visibleRoles.value.map(r => ({ value: r, label: roleLabel(r, fem.value ? 'female' : null) }))
]).map(c => ({ value: c.value, label: `${c.label} (${countFor(c.value)})` })))
// البحث بالاسم أو الرقم الوظيفي (يقبل الأرقام العربية) — فوق تصفية الدور
const query = ref('')
const filteredUsers = computed(() => (users.value ?? []).filter(u =>
  (filter.value === 'all' || u.role === filter.value)
  && matchesSearch(query.value, u.full_name, u.employee_number)
))
const { page, pageCount, total, pageSize, paged, resetPage } = usePagination(filteredUsers, 12)
/** الرقمُ المتسلسل عبر الصفحات لا داخلَ الصفحة وحدها (طلب المستخدم 2026-10-22). */
const seq = (index: number) => (page.value - 1) * pageSize + index + 1
watch([filter, query], resetPage)
const columns = [
  { key: 'num', label: '#' },
  { key: 'user', label: 'المستخدم' },
  { key: 'employee_number', label: 'الرقم الوظيفي' },
  { key: 'role', label: 'الدور' },
  { key: 'assigner', label: 'عيّنه' },
  { key: 'status', label: 'الحالة' },
  { key: 'actions', label: 'إجراءات', align: 'end' as const }
]
// الصور الشخصية: توقيعٌ دفعةً واحدة لصفحة القائمة الظاهرة، والمخبأ يمنع التكرار
const { prime: primePhotos, urlFor: photoUrlFor } = useProfilePhotoUrls()
watch(paged, rows => void primePhotos(rows.map(displayPhotoPath)), { immediate: true })

// ── إنشاء مستخدم ──
const modalOpen = ref(false)
const creating = ref(false)
// الجنس بلا قيمة افتراضية: يحدّد المسمّى والقسم (حلقات البنات لا تقبل إلا أنثى) — فلا يُنسى فيصير «ذكراً»
const form = reactive({ full_name: '', role: 'teacher' as Role, phone: '', gender: '' as Gender | '' })
const { createStaff, resetPassword } = useAccountAdmin()
// المدير الإداري والفني شخصٌ واحد نشط لكلٍّ منهما: يظهر الدور معطّلاً ما دام له شاغل (والخادم يرفض أيضاً)
const occupiedRoles = computed(() => new Set((users.value ?? [])
  .filter(u => u.status === 'active' && MANAGER_ROLES.includes(u.role))
  .map(u => u.role)))
// المسمّى بجنس الحساب المختار؛ والمديرة الإدارية تُميَّز بقسمها كي لا تلتبس بالمدير الإداري الأنثى
const roleItems = computed(() => STAFF_ROLES.map((r) => {
  const label = r === 'women_admin' ? `${roleLabel(r, form.gender || null)} — قسم البنات` : roleLabel(r, form.gender || null)
  const occupied = occupiedRoles.value.has(r)
  return { label: occupied ? `${label} — له شاغلٌ نشط` : label, value: r, disabled: occupied }
}))
const genderItems = [{ label: 'ذكر', value: 'male' }, { label: 'أنثى', value: 'female' }]
// دور المديرة الإدارية نسائيّ حصراً (قسم البنات)
watch(() => form.role, (r) => {
  if (r === 'women_admin') form.gender = 'female'
})
function openCreate() {
  Object.assign(form, { full_name: '', role: 'teacher', phone: '', gender: '' })
  modalOpen.value = true
}
function validate(s: typeof form) {
  const errors: { name: string, message: string }[] = []
  if (!s.full_name.trim()) errors.push({ name: 'full_name', message: 'الاسم الكامل مطلوب.' })
  if (!s.gender) errors.push({ name: 'gender', message: 'اختر الجنس.' })
  return errors
}

// بعد الإنشاء أو إعادة التعيين: الرقم الوظيفي والكلمة المؤقّتة (مرّةً واحدة، قابلان للنسخ)
const credentials = ref<AccountCredentials | null>(null)

async function submitCreate() {
  creating.value = true
  try {
    const body = { full_name: form.full_name.trim(), role: form.role, gender: form.gender as Gender, phone: form.phone.trim() || undefined }
    const created = await createStaff(body)
    credentials.value = staffCredentials(body.full_name, created.employee_number, created.temp_password, 'created')
    modalOpen.value = false
    await refresh()
  } catch (err) {
    handle(err, 'تعذّر إنشاء الحساب.')
  } finally {
    creating.value = false
  }
}

// ── تفعيل/تعطيل ──
const togglingId = ref<string | null>(null)
async function toggleStatus(u: UserRow) {
  const next = u.status === 'disabled' ? 'active' : 'disabled'
  togglingId.value = u.id
  try {
    const { error } = await supabase.from('profiles').update({ status: next }).eq('id', u.id)
    if (error) throw error
    toast.add({ title: next === 'active' ? 'تم تفعيل الحساب.' : 'تم تعطيل الحساب.', color: next === 'active' ? 'success' : 'neutral', icon: next === 'active' ? 'i-lucide-circle-check' : 'i-lucide-ban' })
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    togglingId.value = null
  }
}

// ── إعادة تعيين كلمة المرور (طارئة، للمدير) ──
const resetTarget = ref<UserRow | null>(null)
const resetting = ref(false)
async function confirmReset() {
  const target = resetTarget.value
  if (!target) return
  resetting.value = true
  try {
    const password = await resetPassword(target.id)
    credentials.value = staffCredentials(target.full_name, target.employee_number ?? '—', password, 'reset')
    resetTarget.value = null
  } catch (err) {
    handle(err, 'تعذّرت إعادة التعيين.')
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div class="users">
    <!-- المنع للدور المحسوم غير المدير فقط (لا يُحجب المحتوى أثناء تحميل الدور:
         سكيلتون بيانات الصفحة يظهر مباشرةً بدل انتظار جلب الملف الشخصي) -->
    <UiEmptyState
      v-if="myRole && !canView"
      icon="i-lucide-lock"
      title="هذه الصفحة للمدير الإداري فقط."
    />

    <template v-else>
      <UiPageHeader
        :title="fem ? 'عاملات القسم' : 'إدارة المستخدمين'"
        :subtitle="pending ? 'الحسابات يُنشئها المدير الإداري وحده.' : `${(users || []).length} ${fem ? ((users || []).length >= 3 && (users || []).length <= 10 ? 'عاملات في قسمك' : 'عاملةً في قسمك') : 'مستخدم في المنظومة'} — الحسابات يُنشئها المدير الإداري وحده.`"
      >
        <template
          v-if="isAdmin"
          #actions
        >
          <UButton
            label="إنشاء مستخدم"
            color="primary"
            size="lg"
            icon="i-lucide-plus"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="openCreate"
          />
        </template>
      </UiPageHeader>

      <div class="toolbar">
        <UiSearchField
          v-model="query"
          placeholder="ابحث بالاسم أو الرقم الوظيفي"
          :shown="filteredUsers.length"
          :total="(users ?? []).length"
          class="search"
        />
        <UiSelect
          v-model="filter"
          :items="roleFilterItems"
          size="xl"
          class="filter-sel"
          aria-label="الدور"
          :ui="{ base: 'rounded-[12px] min-h-12' }"
        />
      </div>

      <ClientOnly>
        <UiStatStrip
          v-if="!pending && (users ?? []).length"
          :items="userStats(users ?? [], fem)"
          label="أرقام الحسابات"
        />
        <UiSkeletonTable
          v-if="pending"
          :columns="columns"
        />
        <UiEmptyState
          v-else-if="filteredUsers.length === 0"
          icon="i-lucide-users"
          title="لا مستخدمون في هذا التصنيف"
          description="جرّب تصنيفاً آخر، أو أنشئ مستخدماً جديداً."
        />
        <UiDataTable
          v-else
          :columns="columns"
          :rows="paged"
          row-key="id"
        >
          <template #num="{ index }">
            <span class="muted">{{ seq(index) }}</span>
          </template>
          <template #user="{ row }">
            <div class="user-cell">
              <div class="av">
                <ProfileAvatar
                  :name="row.full_name"
                  :photo-url="photoUrlFor(displayPhotoPath(row))"
                />
              </div>
              <div class="u-name">
                {{ row.full_name }}
              </div>
            </div>
          </template>
          <template #employee_number="{ row }">
            <span
              class="emp-no"
              dir="ltr"
            >{{ row.employee_number || '—' }}</span>
          </template>
          <template #role="{ row }">
            <UBadge
              :label="roleLabel(row.role, row.gender)"
              :color="ROLE_COLOR[row.role]"
              variant="soft"
            />
          </template>
          <template #assigner="{ row }">
            <span class="muted">{{ row.assigner?.full_name || '—' }}</span>
          </template>
          <template #status="{ row }">
            <UBadge
              :label="WORKER_STATUS[row.status]?.label"
              :color="WORKER_STATUS[row.status]?.color"
              variant="soft"
            />
          </template>
          <template #actions="{ row }">
            <div class="actions">
              <UButton
                :to="`/profile/${row.id}`"
                label="عرض البيانات"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-id-card"
                :ui="{ base: 'rounded-[10px]' }"
              />
              <ImpersonationStartButton
                :profile-id="row.id"
                :name="row.full_name"
                :role="row.role"
                :status="row.status"
                :gender="row.gender"
                size="sm"
              />
              <UButton
                v-if="isAdmin"
                label="إعادة تعيين الكلمة"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-key-round"
                :ui="{ base: 'rounded-[10px]' }"
                @click="resetTarget = row"
              />
              <UButton
                v-if="isAdmin"
                :label="row.status === 'disabled' ? 'تفعيل' : 'تعطيل'"
                :color="row.status === 'disabled' ? 'success' : 'neutral'"
                variant="outline"
                size="sm"
                :icon="row.status === 'disabled' ? 'i-lucide-power' : 'i-lucide-ban'"
                :loading="togglingId === row.id"
                :ui="{ base: 'rounded-[10px]' }"
                @click="toggleStatus(row)"
              />
            </div>
          </template>
          <template #card="{ row, index }">
            <UiCardRow
              :title="row.full_name"
              :subtitle="row.employee_number"
              subtitle-dir="ltr"
              :to="`/profile/${row.id}`"
              :fields="[{ label: 'عيّنه', value: row.assigner?.full_name, muted: true }]"
            >
              <template #lead>
                <span class="lead"><span class="seq">{{ seq(index) }}</span><span class="av">
                  <ProfileAvatar
                    :name="row.full_name"
                    :photo-url="photoUrlFor(displayPhotoPath(row))"
                  />
                </span></span>
              </template>
              <template #badge>
                <UBadge
                  :label="roleLabel(row.role, row.gender)"
                  :color="ROLE_COLOR[row.role]"
                  variant="soft"
                />
                <UBadge
                  v-if="row.status !== 'active'"
                  :label="WORKER_STATUS[row.status]?.label"
                  :color="WORKER_STATUS[row.status]?.color"
                  variant="soft"
                />
              </template>
              <template
                v-if="isAdmin || isTechnical"
                #actions
              >
                <ImpersonationStartButton
                  :profile-id="row.id"
                  :name="row.full_name"
                  :role="row.role"
                  :status="row.status"
                  :gender="row.gender"
                />
                <UButton
                  v-if="isAdmin"
                  label="إعادة تعيين الكلمة"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-key-round"
                  :ui="{ base: 'rounded-[11px]' }"
                  @click="resetTarget = row"
                />
                <UButton
                  v-if="isAdmin"
                  :label="row.status === 'disabled' ? 'تفعيل' : 'تعطيل'"
                  :color="row.status === 'disabled' ? 'success' : 'neutral'"
                  variant="outline"
                  :icon="row.status === 'disabled' ? 'i-lucide-power' : 'i-lucide-ban'"
                  :loading="togglingId === row.id"
                  :ui="{ base: 'rounded-[11px]' }"
                  @click="toggleStatus(row)"
                />
              </template>
            </UiCardRow>
          </template>
        </UiDataTable>
        <UiPaginator
          v-if="filteredUsers.length"
          :page="page"
          :page-count="pageCount"
          :total="total"
          :page-size="pageSize"
          @update:page="page = $event"
        />
      </ClientOnly>
    </template>

    <!-- نافذة الإنشاء -->
    <UModal
      v-model:open="modalOpen"
      title="إنشاء مستخدم جديد"
    >
      <template #body>
        <UForm
          :state="form"
          :validate="validate"
          class="form"
          @submit="submitCreate"
        >
          <UFormField
            label="الاسم الكامل"
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
              label="الدور"
              name="role"
              class="flex-1"
            >
              <USelect
                v-model="form.role"
                :items="roleItems"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="الهاتف (اختياري)"
              name="phone"
              class="flex-1"
            >
              <UInput
                v-model="form.phone"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <UFormField
            label="الجنس"
            name="gender"
            required
            hint="يحدّد المسمّى (معلم/معلمة…) والقسم"
          >
            <USelect
              v-model="form.gender"
              :items="genderItems"
              :disabled="form.role === 'women_admin'"
              placeholder="ذكر أم أنثى؟"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <p class="form-note">
            <UIcon
              name="i-lucide-info"
              class="size-4"
            />
            يُولَّد الرقم الوظيفي وكلمة مرورٍ مؤقّتة بعد الإنشاء — تظهران مرّةً واحدة، ويغيّر العامل الكلمة عند أول دخول.
          </p>
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
              label="إنشاء الحساب"
              color="primary"
              size="lg"
              :loading="creating"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
            />
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- الرقم الوظيفي والكلمة المؤقّتة بعد الإنشاء أو إعادة التعيين -->
    <AccountCredentialsModal
      :credentials="credentials"
      @close="credentials = null"
    />

    <!-- تأكيد إعادة تعيين كلمة المرور -->
    <UiConfirmModal
      :open="!!resetTarget"
      title="إعادة تعيين كلمة المرور"
      :message="`ستُولَّد لـ«${resetTarget?.full_name}» كلمة مرورٍ مؤقّتة جديدة تظهر لك مرّةً واحدة، وتبطل كلمته الحالية، ويُطلب منه تغييرها عند الدخول.`"
      confirm-label="إعادة التعيين"
      confirm-color="primary"
      confirm-icon="i-lucide-key-round"
      :loading="resetting"
      @confirm="confirmReset"
      @update:open="(v) => { if (!v) resetTarget = null }"
    />
  </div>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; container: toolbar / inline-size; }
.search { width: 300px; max-width: 100%; }
.filter-sel { width: 220px; }
/* متى ضاق الشريطُ عن البحث والقائمة في سطر: كلٌّ منهما سطرٌ كامل (بعرض الشريط لا الشاشة) */
@container toolbar (max-width: 539px) {
  .search, .filter-sel { width: 100%; }
}
.muted { color: var(--ink-2); white-space: nowrap; }
.user-cell { display: flex; align-items: center; gap: 11px; }
.lead { display: inline-flex; align-items: center; gap: 10px; }
.seq { min-width: 26px; height: 26px; padding: 0 6px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
.av { width: 40px; height: 40px; border-radius: 11px; background: var(--navy); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex: none; overflow: hidden; }
.u-name { font-weight: 600; color: var(--ink); }
.emp-no { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--ink-2); letter-spacing: .04em; }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }

.form { display: flex; flex-direction: column; gap: 16px; }
.row { display: flex; gap: 14px; flex-wrap: wrap; }
.row > * { flex: 1; min-width: 160px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
.form-note { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; color: var(--ink-3); }
</style>
