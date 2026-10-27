<script setup lang="ts">
/**
 * «الرسائل المجدولة» (طلب المستخدم 2026-10-27): قائمةُ التذكيرات بمواعيدها وقنواتها ومستلميها، وإضافتُها وتعديلُها
 * وإيقافُها وحذفُها. المديرُ الإداريّ للقسمين وبالقناتين، والمديرُ الفنيّ للبنين والمديرةُ الإدارية للبنات داخل المنصّة،
 * ومشرفُ المشروع يقرأ. تُرسَل في موعدها خلال خمس دقائق.
 */
import { SCHEDULE_ROLES, describeSchedule, type ScheduleDraft, type ScheduledRow } from '~/composables/useScheduledMessages'
import { formatTime12 } from '~/utils/time'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الرسائل المجدولة — ترجمان' })

const { role, isAdmin, isTechnical, isWomenAdmin } = usePermissions()
const canView = computed(() => ['admin_manager', 'technical_manager', 'women_admin', 'project_supervisor'].includes(role.value ?? ''))
const canEdit = computed(() => isAdmin.value || isTechnical.value || isWomenAdmin.value)
const fixedSection = computed(() => (isTechnical.value ? 'male' : isWomenAdmin.value ? 'female' : null))
const { rows, pending, busy, save, setActive, remove } = useScheduledMessages()

const roleLabel = (k: string) => SCHEDULE_ROLES.find(r => r.key === k)?.label ?? k
const sectionLabel = (s: string) => (s === 'male' ? 'البنين' : s === 'female' ? 'البنات' : 'القسمان')
const nextLabel = (r: ScheduledRow) => {
  if (!r.next_run_at) return r.runs ? 'أُرسلت' : '—'
  const d = new Date(r.next_run_at)
  const day = new Intl.DateTimeFormat('ar-u-nu-latn', { timeZone: 'Asia/Gaza', weekday: 'long', day: 'numeric', month: 'numeric' }).format(d)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Gaza', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${day} · ${formatTime12(time)}`
}

const formOpen = ref(false)
const editingId = ref<string | null>(null)
const initial = ref<ScheduleDraft | null>(null)
function openCreate() {
  editingId.value = null
  initial.value = null
  formOpen.value = true
}
function openEdit(r: ScheduledRow) {
  editingId.value = r.id
  const runAt = r.run_at ? new Date(r.run_at) : null
  const parts = runAt
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Gaza', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(runAt).reduce<Record<string, string>>((a, p) => ({ ...a, [p.type]: p.value }), {})
    : null
  initial.value = {
    title: r.title, body: r.body ?? '', roles: [...r.roles], section: r.section as ScheduleDraft['section'],
    in_app: r.in_app, sms: r.sms, recurrence: r.recurrence as ScheduleDraft['recurrence'],
    run_date: parts ? `${parts.year}-${parts.month}-${parts.day}` : '',
    run_time: parts ? `${parts.hour}:${parts.minute}` : (r.time_of_day ?? '08:00').slice(0, 5),
    weekday: r.weekday ?? 6, month_day: r.month_day ?? 1
  }
  formOpen.value = true
}
async function onSave(d: ScheduleDraft) {
  if (await save(d, editingId.value ?? undefined)) formOpen.value = false
}
const toDelete = ref<ScheduledRow | null>(null)
async function confirmDelete() {
  if (toDelete.value && await remove(toDelete.value.id)) toDelete.value = null
}
</script>

<template>
  <div class="sch">
    <UiPageHeader
      title="الرسائل المجدولة"
      subtitle="تذكيراتٌ تُرسَل وحدها في موعدها — مرّةً أو كلَّ أسبوع أو كلَّ شهر."
    >
      <template
        v-if="canEdit"
        #actions
      >
        <UButton
          label="رسالةٌ مجدولة"
          icon="i-lucide-calendar-plus"
          color="primary"
          size="lg"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="openCreate"
        />
      </template>
    </UiPageHeader>
    <ClientOnly>
      <UiEmptyState
        v-if="role && !canView"
        icon="i-lucide-lock"
        title="هذه الصفحة للإدارة."
      />
      <UiSkeletonRow
        v-else-if="pending && !rows.length"
        :action="false"
      />
      <UiEmptyState
        v-else-if="!rows.length"
        icon="i-lucide-calendar-clock"
        title="لا رسائلَ مجدولة بعد"
        description="جدوِل تذكيراً باجتماعٍ ثابت أو بموعد التقرير الشهري، فيصل الكادرَ وحده في موعده."
      />
      <ul
        v-else
        class="list"
      >
        <li
          v-for="r in rows"
          :key="r.id"
          :class="{ off: !r.active }"
        >
          <div class="top">
            <b>{{ r.title }}</b>
            <UBadge
              :label="r.active ? 'فعّالة' : (r.runs ? 'انتهت' : 'موقوفة')"
              :color="r.active ? 'success' : 'neutral'"
              variant="soft"
            />
          </div>
          <p
            v-if="r.body"
            class="body"
          >
            {{ r.body }}
          </p>
          <div class="meta">
            <span><UIcon
              name="i-lucide-repeat"
              class="size-4"
            />{{ describeSchedule(r) }}</span>
            <span><UIcon
              name="i-lucide-clock"
              class="size-4"
            />القادمة: {{ nextLabel(r) }}</span>
            <span><UIcon
              name="i-lucide-users"
              class="size-4"
            />{{ r.roles.map(roleLabel).join('، ') }} · {{ sectionLabel(r.section) }}</span>
            <span><UIcon
              name="i-lucide-send"
              class="size-4"
            />{{ [r.in_app && 'المنصّة', r.sms && 'SMS'].filter(Boolean).join(' + ') }}<template v-if="r.runs"> · أُرسلت {{ r.runs }} مرّة</template></span>
          </div>
          <div
            v-if="canEdit"
            class="acts"
          >
            <UButton
              label="تعديل"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              size="sm"
              :ui="{ base: 'rounded-[10px] min-h-9' }"
              @click="openEdit(r)"
            />
            <UButton
              v-if="r.recurrence !== 'once' || !r.runs"
              :label="r.active ? 'إيقاف' : 'استئناف'"
              :icon="r.active ? 'i-lucide-pause' : 'i-lucide-play'"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="busy"
              :ui="{ base: 'rounded-[10px] min-h-9' }"
              @click="setActive(r.id, !r.active)"
            />
            <UButton
              label="حذف"
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="sm"
              :ui="{ base: 'rounded-[10px] min-h-9' }"
              @click="toDelete = r"
            />
          </div>
        </li>
      </ul>
    </ClientOnly>

    <ScheduledFormModal
      v-model:open="formOpen"
      :busy="busy"
      :initial="initial"
      :editing="!!editingId"
      :can-sms="canEdit"
      :fixed-section="fixedSection"
      @save="onSave"
    />
    <UModal
      :open="!!toDelete"
      title="حذفُ الرسالة المجدولة"
      @update:open="(v: boolean) => { if (!v) toDelete = null }"
    >
      <template #body>
        <p class="del">
          تُحذف «{{ toDelete?.title }}» ولا تُرسَل بعد الآن. ما أُرسل منها يبقى في رسائل الإدارة وسجلّ الرسائل.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="toDelete = null"
          />
          <UButton
            label="احذف"
            icon="i-lucide-trash-2"
            color="error"
            :loading="busy"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="confirmDelete"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.sch { display: flex; flex-direction: column; gap: 16px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.list li { padding: 14px 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
.list li.off { opacity: .7; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.top b { color: var(--ink); font-size: 16px; font-weight: 600; }
.body { margin: 0; color: var(--ink-2); white-space: pre-wrap; line-height: 1.7; font-size: 14px; }
.meta { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 13px; color: var(--ink-3); }
.meta span { display: inline-flex; align-items: center; gap: 6px; }
.acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.del { margin: 0; line-height: 1.8; color: var(--ink); }
</style>
