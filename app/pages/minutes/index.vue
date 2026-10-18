<script setup lang="ts">
/**
 * محاضر الاجتماعات الإدارية (§4.19) — المدير الإداري (إنشاء/اطّلاع/تعديل/حذف)،
 * ومشرف المشروع للاطّلاع فقط.
 * الحاضرون يُختارون من الطاقم الإداري والإشرافي — لا معلّمين/مختبِرين/طلاب.
 * المرفقات خارج نطاق هذه المرحلة.
 */
import type { Database } from '~/types/database.types'
import { roleLabel, type Role } from '~/constants/roles'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'محاضر الاجتماعات — ترجمان' })

/** أدوار المؤهّلين لحضور الاجتماعات الإدارية. */
const ATTENDEE_ROLES: Role[] = ['project_supervisor', 'admin_manager', 'technical_manager', 'women_admin', 'field_supervisor']

const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()
const { isAdmin, isReadOnly } = usePermissions()
const canView = computed(() => isAdmin.value || isReadOnly.value)

type MinuteRow = {
  id: string
  title: string
  meeting_date: string
  agenda: string | null
  decisions: string | null
  tasks: string | null
  attendee_ids: string[]
  status: 'draft' | 'final'
}
type Staff = { id: string, full_name: string, role: Role, gender: Database['public']['Enums']['gender_type'] | null }

// جلب غير حاجز (useLazyAsyncData): الاستعلامان مستقلّان ويعملان بالتوازي تلقائياً
const { data: minutes, refresh, pending } = useLazyAsyncData<MinuteRow[]>('minutes-list', async () => {
  const { data } = await supabase
    .from('meeting_minutes')
    .select('id, title, meeting_date, agenda, decisions, tasks, attendee_ids, status')
    .order('meeting_date', { ascending: false })
    .returns<MinuteRow[]>()
  return data ?? []
}, { server: false, default: () => [] })

const { data: staff } = useLazyAsyncData<Staff[]>('minutes-staff', async () => {
  if (!canView.value) return []
  const { data } = await supabase
    .from('profiles').select('id, full_name, role, gender')
    .in('role', ATTENDEE_ROLES).eq('status', 'active').order('full_name')
  return data ?? []
}, { server: false, default: () => [], watch: [canView] })
const staffMap = computed(() => Object.fromEntries((staff.value ?? []).map(s => [s.id, s])))
const attendeeNames = (ids: string[]) => ids.map(id => staffMap.value[id]?.full_name).filter(Boolean)

// ── إنشاء/تعديل ──
const today = new Date().toISOString().slice(0, 10)
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const form = reactive({ title: '', meeting_date: today, attendees: [] as string[], agenda: '', decisions: '', tasks: '', status: 'draft' as 'draft' | 'final' })

function openCreate() {
  editingId.value = null
  Object.assign(form, { title: '', meeting_date: today, attendees: [], agenda: '', decisions: '', tasks: '', status: 'draft' })
  modalOpen.value = true
}
function openEdit(m: MinuteRow) {
  editingId.value = m.id
  Object.assign(form, {
    title: m.title, meeting_date: m.meeting_date, attendees: [...m.attendee_ids],
    agenda: m.agenda ?? '', decisions: m.decisions ?? '', tasks: m.tasks ?? '', status: m.status
  })
  modalOpen.value = true
}
function toggleAttendee(id: string) {
  const i = form.attendees.indexOf(id)
  if (i === -1) form.attendees.push(id)
  else form.attendees.splice(i, 1)
}

async function save() {
  if (!form.title.trim()) {
    toast.add({ title: 'اكتب عنوان المحضر.', color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  saving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      meeting_date: form.meeting_date,
      attendee_ids: form.attendees,
      agenda: form.agenda.trim() || null,
      decisions: form.decisions.trim() || null,
      tasks: form.tasks.trim() || null,
      status: form.status
    }
    if (editingId.value) {
      const { error } = await supabase.from('meeting_minutes').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('meeting_minutes').insert({ ...payload, created_by: profile.value?.id ?? null })
      if (error) throw error
    }
    toast.add({ title: editingId.value ? 'حُفظ المحضر.' : 'أُنشئ المحضر.', color: 'success', icon: 'i-lucide-circle-check' })
    modalOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

// ── حذف ──
const deleteTarget = ref<MinuteRow | null>(null)
const deleting = ref(false)
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const { error } = await supabase.from('meeting_minutes').delete().eq('id', deleteTarget.value.id)
    if (error) throw error
    toast.add({ title: 'حُذف المحضر.', color: 'success', icon: 'i-lucide-trash-2' })
    deleteTarget.value = null
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    deleting.value = false
  }
}

// ── قراءة ──
const reading = ref<MinuteRow | null>(null)

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })
</script>

<template>
  <div class="minutes">
    <UiPageHeader
      title="محاضر الاجتماعات"
      subtitle="توثيق الاجتماعات الإدارية: جدول الأعمال والقرارات والمهام والحاضرون."
    >
      <template
        v-if="isAdmin"
        #actions
      >
        <UButton
          label="محضر جديد"
          color="primary"
          size="lg"
          icon="i-lucide-plus"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="openCreate"
        />
      </template>
    </UiPageHeader>

    <UiEmptyState
      v-if="!canView"
      icon="i-lucide-lock"
      title="هذه الصفحة للمدير الإداري فقط."
    />

    <ClientOnly v-else>
      <div
        v-if="pending"
        class="list"
      >
        <UiSkeletonRow
          v-for="i in 4"
          :key="i"
          :action="false"
        />
      </div>
      <UiEmptyState
        v-else-if="!minutes || !minutes.length"
        icon="i-lucide-notebook-pen"
        title="لا محاضر بعد"
        description="أنشئ أول محضر لاجتماع إداري."
      />

      <div
        v-else
        class="list"
      >
        <article
          v-for="m in minutes"
          :key="m.id"
          class="card mrow"
        >
          <div
            class="mrow-main"
            @click="reading = m"
          >
            <div class="mrow-head">
              <h3>{{ m.title }}</h3>
              <UBadge
                :label="m.status === 'final' ? 'نهائي' : 'مسودّة'"
                :color="m.status === 'final' ? 'success' : 'neutral'"
                variant="soft"
                size="sm"
              />
            </div>
            <div class="mrow-meta">
              <span><UIcon
                name="i-lucide-calendar"
                class="size-[13px]"
              />{{ fmtDate(m.meeting_date) }}</span>
              <span><UIcon
                name="i-lucide-users"
                class="size-[13px]"
              />{{ m.attendee_ids.length }} حاضر</span>
            </div>
          </div>
          <div class="mrow-actions">
            <UButton
              label="قراءة"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-book-open"
              :ui="{ base: 'rounded-[10px]' }"
              @click="reading = m"
            />
            <UButton
              v-if="isAdmin"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-pencil"
              aria-label="تعديل"
              :ui="{ base: 'rounded-[10px]' }"
              @click="openEdit(m)"
            />
            <UButton
              v-if="isAdmin"
              color="error"
              variant="outline"
              size="sm"
              icon="i-lucide-trash-2"
              aria-label="حذف"
              :ui="{ base: 'rounded-[10px]' }"
              @click="deleteTarget = m"
            />
          </div>
        </article>
      </div>
    </ClientOnly>

    <!-- نافذة إنشاء/تعديل -->
    <UModal
      v-model:open="modalOpen"
      :title="editingId ? 'تعديل المحضر' : 'محضر جديد'"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <div class="form">
          <div class="row">
            <UFormField
              label="العنوان / الموضوع"
              class="f2"
              required
            >
              <UInput
                v-model="form.title"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="التاريخ"
              class="f1"
            >
              <UInput
                v-model="form.meeting_date"
                type="date"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>

          <UFormField :label="`الحاضرون (${form.attendees.length})`">
            <div class="attendees">
              <button
                v-for="s in staff"
                :key="s.id"
                type="button"
                class="att-chip"
                :class="{ on: form.attendees.includes(s.id) }"
                @click="toggleAttendee(s.id)"
              >
                <UIcon
                  :name="form.attendees.includes(s.id) ? 'i-lucide-check' : 'i-lucide-plus'"
                  class="size-[14px]"
                />
                {{ s.full_name }}
                <span class="att-role">{{ roleLabel(s.role, s.gender) }}</span>
              </button>
              <span
                v-if="!staff || !staff.length"
                class="att-empty"
              >لا عاملين مؤهّلين.</span>
            </div>
          </UFormField>

          <UFormField label="جدول الأعمال / البنود">
            <UTextarea
              v-model="form.agenda"
              :rows="3"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField label="القرارات المتّخذة">
            <UTextarea
              v-model="form.decisions"
              :rows="3"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField label="المهام والمسؤوليات">
            <UTextarea
              v-model="form.tasks"
              :rows="2"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <USwitch
            :model-value="form.status === 'final'"
            label="اعتماد كنهائي (غير مسودّة)"
            @update:model-value="(v) => form.status = v ? 'final' : 'draft'"
          />
        </div>
      </template>
      <template #footer>
        <div class="modal-foot">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            @click="modalOpen = false"
          />
          <UButton
            :label="editingId ? 'حفظ' : 'إنشاء'"
            color="primary"
            icon="i-lucide-check"
            :loading="saving"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="save"
          />
        </div>
      </template>
    </UModal>

    <!-- نافذة القراءة -->
    <UModal
      :open="!!reading"
      :title="reading?.title"
      :ui="{ content: 'max-w-2xl' }"
      @update:open="(v) => { if (!v) reading = null }"
    >
      <template #body>
        <div
          v-if="reading"
          class="reader"
        >
          <div class="mrow-meta">
            <span><UIcon
              name="i-lucide-calendar"
              class="size-[13px]"
            />{{ fmtDate(reading.meeting_date) }}</span>
            <UBadge
              :label="reading.status === 'final' ? 'نهائي' : 'مسودّة'"
              :color="reading.status === 'final' ? 'success' : 'neutral'"
              variant="soft"
              size="sm"
            />
          </div>

          <div
            v-if="attendeeNames(reading.attendee_ids).length"
            class="read-sec"
          >
            <div class="read-label">
              الحاضرون
            </div>
            <div class="att-names">
              <UBadge
                v-for="nm in attendeeNames(reading.attendee_ids)"
                :key="nm"
                :label="nm"
                color="neutral"
                variant="soft"
                size="sm"
              />
            </div>
          </div>
          <div
            v-if="reading.agenda"
            class="read-sec"
          >
            <div class="read-label">
              جدول الأعمال
            </div>
            <p>{{ reading.agenda }}</p>
          </div>
          <div
            v-if="reading.decisions"
            class="read-sec"
          >
            <div class="read-label">
              القرارات
            </div>
            <p>{{ reading.decisions }}</p>
          </div>
          <div
            v-if="reading.tasks"
            class="read-sec"
          >
            <div class="read-label">
              المهام والمسؤوليات
            </div>
            <p>{{ reading.tasks }}</p>
          </div>
        </div>
      </template>
    </UModal>

    <!-- تأكيد الحذف -->
    <UiConfirmModal
      :open="!!deleteTarget"
      title="حذف المحضر"
      :message="`سيُحذف «${deleteTarget?.title}» نهائيّاً.`"
      confirm-label="حذف"
      :loading="deleting"
      @confirm="confirmDelete"
      @update:open="(v) => { if (!v) deleteTarget = null }"
    />
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }

.list { display: flex; flex-direction: column; gap: 14px; }
.mrow { padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.mrow-main { flex: 1; min-width: 0; cursor: pointer; }
.mrow-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mrow-head h3 { margin: 0; font-size: 16.5px; font-weight: 700; color: var(--ink); }
.mrow-meta { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px; }
.mrow-meta span { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--ink-3); }
.mrow-actions { display: flex; gap: 6px; flex: none; }

.form { display: flex; flex-direction: column; gap: 16px; }
.row { display: flex; gap: 14px; }
.f1 { flex: 1; }
.f2 { flex: 2; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; }

.attendees { display: flex; flex-wrap: wrap; gap: 8px; }
.att-chip { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink-2); font-size: 13.5px; font-weight: 500; cursor: pointer; transition: all .15s; }
.att-chip:hover { border-color: var(--blue); }
.att-chip.on { background: var(--blue-soft); border-color: var(--blue); color: var(--blue-ink); font-weight: 600; }
.att-role { font-size: 11.5px; color: var(--ink-3); }
.att-chip.on .att-role { color: var(--blue-ink); opacity: .8; }
.att-empty { font-size: 13px; color: var(--ink-3); }

.reader { display: flex; flex-direction: column; gap: 16px; }
.read-sec p { margin: 6px 0 0; font-size: 14.5px; color: var(--ink); line-height: 1.9; white-space: pre-wrap; }
.read-label { font-size: 12.5px; font-weight: 700; color: var(--ink-3); }
.att-names { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }

@media (max-width: 560px) { .row { flex-direction: column; } .mrow-actions { width: 100%; } }
</style>
