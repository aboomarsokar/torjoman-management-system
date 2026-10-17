<script setup lang="ts">
/**
 * إدارة المستخدمين (§4.12) — للمدير فقط.
 * قائمة العاملين + تصفية بالدور + إنشاء حساب (عبر مسار خادمي) + تفعيل/تعطيل.
 */
import type { Database } from '~/types/database.types'
import { DEFAULT_PASSWORD } from '~/constants/auth'
import { ROLE_LABEL, type Role } from '~/constants/roles'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'إدارة المستخدمين — ترجمان' })

type Gender = Database['public']['Enums']['gender_type']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type UserRow = ProfileRow & { assigner: { full_name: string } | null }

const supabase = useSupabaseClient<Database>()
const { role: myRole } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()
const isManager = computed(() => myRole.value === 'manager')

const ROLE_COLOR: Record<Role, 'primary' | 'secondary' | 'info' | 'success' | 'warning'> = {
  manager: 'primary', quality: 'secondary', supervisor: 'info', teacher: 'success', examiner: 'warning'
}
const { data: users, refresh, pending } = useLazyAsyncData<UserRow[]>(
  'users-list',
  async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, assigner:assigned_by(full_name)')
      .order('created_at', { ascending: false })
      .returns<UserRow[]>()
    if (error) {
      console.error('[users] فشل الجلب:', error.message)
      return []
    }
    return data ?? []
  },
  { server: false, default: () => [] }
)

const filter = ref<Role | 'all'>('all')
function countFor(key: Role | 'all') {
  const list = users.value ?? []
  return key === 'all' ? list.length : list.filter(u => u.role === key).length
}
const chipOptions = computed(() => ([
  { value: 'all' as const, label: 'الكل' },
  { value: 'manager' as const, label: 'المديرون' },
  { value: 'quality' as const, label: 'الجودة' },
  { value: 'supervisor' as const, label: 'المشرفون' },
  { value: 'teacher' as const, label: 'المعلمون' },
  { value: 'examiner' as const, label: 'المختبِرون' }
]).map(c => ({ ...c, count: countFor(c.value) })))
const filteredUsers = computed(() => {
  const list = users.value ?? []
  return filter.value === 'all' ? list : list.filter(u => u.role === filter.value)
})
const { page, pageCount, total, pageSize, paged, resetPage } = usePagination(filteredUsers, 12)
watch(filter, resetPage)
const columns = [
  { key: 'num', label: '#' },
  { key: 'user', label: 'المستخدم' },
  { key: 'role', label: 'الدور' },
  { key: 'assigner', label: 'عيّنه' },
  { key: 'status', label: 'الحالة' },
  { key: 'actions', label: 'إجراءات', align: 'end' as const }
]
function initialOf(name: string) {
  return name.trim().charAt(0) || '؟'
}

// ── إنشاء مستخدم ──
const modalOpen = ref(false)
const creating = ref(false)
const form = reactive({ full_name: '', email: '', password: DEFAULT_PASSWORD, role: 'teacher' as Role, phone: '', gender: 'male' as Gender })
const roleItems = [
  { label: 'معلم', value: 'teacher' },
  { label: 'مشرف ميداني', value: 'supervisor' },
  { label: 'مشرف جودة', value: 'quality' },
  { label: 'مختبِر', value: 'examiner' },
  { label: 'مدير', value: 'manager' }
]
const genderItems = [{ label: 'ذكر', value: 'male' }, { label: 'أنثى', value: 'female' }]
function openCreate() {
  Object.assign(form, { full_name: '', email: '', password: DEFAULT_PASSWORD, role: 'teacher', phone: '', gender: 'male' })
  modalOpen.value = true
}
function validate(s: typeof form) {
  const errors: { name: string, message: string }[] = []
  if (!s.full_name.trim()) errors.push({ name: 'full_name', message: 'الاسم الكامل مطلوب.' })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) errors.push({ name: 'email', message: 'بريد إلكتروني غير صحيح.' })
  if (s.password.length < 8) errors.push({ name: 'password', message: 'كلمة المرور 8 أحرف على الأقل.' })
  return errors
}
async function submitCreate() {
  creating.value = true
  try {
    const created = await $fetch('/api/users', { method: 'POST', body: { ...form } })
    toast.add({ title: `تم إنشاء حساب «${created.full_name}».`, color: 'success', icon: 'i-lucide-circle-check' })
    modalOpen.value = false
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string }, statusMessage?: string })?.data?.statusMessage
      || (err as { statusMessage?: string })?.statusMessage
    toast.add({ title: msg || 'تعذّر إنشاء الحساب.', color: 'error', icon: 'i-lucide-circle-alert' })
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
  if (!resetTarget.value) return
  resetting.value = true
  try {
    await $fetch('/api/users/reset-password', { method: 'POST', body: { user_id: resetTarget.value.id, password: DEFAULT_PASSWORD } })
    toast.add({ title: `أُعيدت كلمة مرور «${resetTarget.value.full_name}» إلى الافتراضية.`, color: 'success', icon: 'i-lucide-key-round' })
    resetTarget.value = null
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({ title: msg || 'تعذّرت إعادة التعيين.', color: 'error', icon: 'i-lucide-circle-alert' })
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
      v-if="myRole && !isManager"
      icon="i-lucide-lock"
      title="هذه الصفحة للمدير فقط."
    />

    <template v-else>
      <UiPageHeader
        title="إدارة المستخدمين"
        :subtitle="`${(users || []).length} مستخدم في المنظومة — الحسابات تُنشأ من قِبل الإدارة فقط.`"
      >
        <template #actions>
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

      <UiFilterChips
        v-model="filter"
        :options="chipOptions"
        class="mb-4"
      />

      <ClientOnly>
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
            <span class="muted">{{ index + 1 }}</span>
          </template>
          <template #user="{ row }">
            <div class="user-cell">
              <div class="av">
                {{ initialOf(row.full_name) }}
              </div>
              <div>
                <div class="u-name">
                  {{ row.full_name }}
                </div>
                <div
                  class="u-email"
                  dir="ltr"
                >
                  {{ row.email }}
                </div>
              </div>
            </div>
          </template>
          <template #role="{ row }">
            <UBadge
              :label="ROLE_LABEL[row.role]"
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
              <UButton
                label="إعادة تعيين الكلمة"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-key-round"
                :ui="{ base: 'rounded-[10px]' }"
                @click="resetTarget = row"
              />
              <UButton
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
          <UFormField
            label="البريد الإلكتروني"
            name="email"
          >
            <UInput
              v-model="form.email"
              type="email"
              dir="ltr"
              icon="i-lucide-mail"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField
            label="كلمة المرور المبدئية"
            name="password"
            hint="افتراضية موحّدة — أبلغها للعامل ليغيّرها لاحقاً"
          >
            <UInput
              v-model="form.password"
              type="text"
              dir="ltr"
              icon="i-lucide-key-round"
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
            v-if="form.role === 'examiner'"
            label="الجنس"
            name="gender"
            hint="يُقترح المختبِر تلقائياً لحلقات جنسه"
          >
            <USelect
              v-model="form.gender"
              :items="genderItems"
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

    <!-- تأكيد إعادة تعيين كلمة المرور -->
    <UiConfirmModal
      :open="!!resetTarget"
      title="إعادة تعيين كلمة المرور"
      :message="`ستُعاد كلمة مرور «${resetTarget?.full_name}» إلى الافتراضية (${DEFAULT_PASSWORD})، ويُطلب منه تغييرها عند الدخول.`"
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
.users { max-width: 1280px; margin: 0 auto; }
.mb-4 { margin-bottom: 16px; }
.muted { color: var(--ink-2); white-space: nowrap; }
.user-cell { display: flex; align-items: center; gap: 11px; }
.av { width: 40px; height: 40px; border-radius: 11px; background: var(--navy); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex: none; }
.u-name { font-weight: 600; color: var(--ink); }
.u-email { font-size: 13px; color: var(--ink-3); }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }

.form { display: flex; flex-direction: column; gap: 16px; }
.row { display: flex; gap: 14px; flex-wrap: wrap; }
.row > * { flex: 1; min-width: 160px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }

@media (max-width: 620px) { .u-email { display: none; } }
</style>
