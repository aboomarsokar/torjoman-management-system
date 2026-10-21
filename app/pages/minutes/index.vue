<script setup lang="ts">
/**
 * محاضر الاجتماعات الإدارية (§4.19) — المدير الإداري (إنشاء/اطّلاع/تعديل/حذف)،
 * ومشرف المشروع للاطّلاع فقط.
 * الحاضرون يُختارون من الطاقم الإداري والإشرافي — لا معلّمين/مختبِرين/طلاب.
 * النافذتان في `components/minutes/` (الإدخال والقراءة)، والمنطقُ النقيّ في `utils/minutes.ts`.
 * المرفقات خارج نطاق هذه المرحلة.
 */
import type { Database } from '~/types/database.types'
import type { Role } from '~/constants/roles'
import type { MinuteForm, MinuteRow, MinuteStaff, MinuteStatus } from '~/utils/minutes'
import { minuteDate, minutePayload } from '~/utils/minutes'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'محاضر الاجتماعات — ترجمان' })

/** أدوار المؤهّلين لحضور الاجتماعات الإدارية. */
const ATTENDEE_ROLES: Role[] = ['project_supervisor', 'admin_manager', 'technical_manager', 'women_admin', 'field_supervisor']

const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()
// role: ما دام فارغاً لا قفل ولا محتوى (كان القفل يومض للمدير عند التحميل الكامل)
const { role, isAdmin, isReadOnly } = usePermissions()
const canView = computed(() => isAdmin.value || isReadOnly.value)

// جلب غير حاجز (useLazyAsyncData): الاستعلامان مستقلّان ويعملان بالتوازي تلقائياً
const { data: minutes, refresh, pending } = useLazyAsyncData<MinuteRow[]>('minutes-list', async () => {
  const { data } = await supabase
    .from('meeting_minutes')
    .select('id, title, meeting_date, agenda, decisions, deferred_items, tasks, attendee_ids, status')
    .order('meeting_date', { ascending: false })
    .returns<MinuteRow[]>()
  return data ?? []
}, { server: false, default: () => [] })

const { data: staff } = useLazyAsyncData<MinuteStaff[]>('minutes-staff', async () => {
  if (!canView.value) return []
  const { data } = await supabase
    .from('profiles').select('id, full_name, role, gender')
    .in('role', ATTENDEE_ROLES).eq('status', 'active').order('full_name')
  return data ?? []
}, { server: false, default: () => [], watch: [canView] })

// ── قراءة وتنزيل PDF (طباعةُ ورقةٍ واحدة — MinutesPrintSheet) ──
const reading = ref<MinuteRow | null>(null)
const printing = ref<MinuteRow | null>(null)

// ── إنشاء/تعديل ──
const today = new Date().toISOString().slice(0, 10)
const modalOpen = ref(false)
const editing = ref<MinuteRow | null>(null)
const saving = ref<MinuteStatus | null>(null)

function openCreate() {
  editing.value = null
  modalOpen.value = true
}
function openEdit(m: MinuteRow) {
  reading.value = null
  editing.value = m
  modalOpen.value = true
}

async function save(form: MinuteForm, status: MinuteStatus) {
  saving.value = status
  const isEdit = !!editing.value
  try {
    const payload = minutePayload(form, status)
    if (editing.value) {
      const { error } = await supabase.from('meeting_minutes').update(payload).eq('id', editing.value.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('meeting_minutes').insert({ ...payload, created_by: profile.value?.id ?? null })
      if (error) throw error
    }
    toast.add({
      title: status === 'final' ? (isEdit ? 'حُفظ المحضر المعتمَد.' : 'اعتُمد المحضر.') : 'حُفظ المحضر مسودّةً.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    modalOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    saving.value = null
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
      v-if="role && !canView"
      icon="i-lucide-lock"
      title="هذه الصفحة للمدير الإداري فقط."
    />

    <ClientOnly v-else-if="canView">
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
                :label="m.status === 'final' ? 'معتمَد' : 'مسودّة'"
                :color="m.status === 'final' ? 'success' : 'neutral'"
                variant="soft"
                size="sm"
              />
            </div>
            <div class="mrow-meta">
              <span><UIcon
                name="i-lucide-calendar"
                class="size-[13px]"
              />{{ minuteDate(m.meeting_date) }}</span>
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
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-file-down"
              aria-label="تنزيل PDF"
              title="تنزيل PDF"
              :ui="{ base: 'rounded-[10px]' }"
              @click="printing = m"
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

    <MinutesFormModal
      v-model:open="modalOpen"
      :editing="editing"
      :staff="staff ?? []"
      :saving="saving"
      :today="today"
      @save="save"
    />

    <MinutesReader
      :minute="reading"
      :staff="staff ?? []"
      :can-edit="isAdmin"
      @close="reading = null"
      @edit="openEdit"
      @pdf="(m) => printing = m"
    />

    <MinutesPrintSheet
      :minute="printing"
      :staff="staff ?? []"
      @done="printing = null"
    />

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

@media (max-width: 560px) { .mrow-actions { width: 100%; } }
</style>
