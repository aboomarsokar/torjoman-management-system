<script setup lang="ts">
/**
 * قائمةُ طلبات إضافة الطلاب (طلب المستخدم 2026-10-27): تبويبان «بانتظار الإدارة» و«المُغلقة»، وفي كلّ سطرٍ الطالبُ وهويتُه
 * والحلقةُ ومعلّمُها والتاريخ. المديرُ الإداريّ (`canDecide`) يضيف الطالبَ (يُنشأ حسابُه وتُعرض كلمتُه مرّةً) أو يرفض بسبب.
 * المعلّمُ يرى طلباتِ حلقته وسببَ الرفض، والمديرةُ الإدارية طلباتِ البنات اطّلاعاً.
 */
import { STUDENT_REQUEST_STATUS } from '~/constants/studentRequests'
import type { StudentRequest } from '~/composables/useStudentRequests'
import { deliveryDate } from '~/utils/booklets'

const props = defineProps<{ rows: StudentRequest[], canDecide: boolean, busy: boolean, showTeacher: boolean, canChat?: boolean }>()
const emit = defineEmits<{ approve: [row: StudentRequest], reject: [row: StudentRequest], chat: [row: StudentRequest] }>()

type View = 'open' | 'closed'
const view = ref<View>('open')
const openRows = computed(() => props.rows.filter(r => r.status === 'open'))
const closedRows = computed(() => props.rows.filter(r => r.status !== 'open'))
const shown = computed(() => (view.value === 'open' ? openRows.value : closedRows.value))
const viewTabs = computed(() => [
  { key: 'open' as const, label: 'بانتظار الإدارة', icon: 'i-lucide-hourglass', count: openRows.value.length },
  { key: 'closed' as const, label: 'المُغلقة', icon: 'i-lucide-archive', count: closedRows.value.length }
])

const columns = computed(() => [
  { key: 'num', label: '#' },
  { key: 'student', label: 'الطالب' },
  ...(props.showTeacher ? [{ key: 'who', label: 'المعلّم والحلقة' }] : []),
  { key: 'date', label: 'التاريخ', class: 'col-date' },
  { key: 'state', label: 'الحالة' },
  { key: 'actions', label: '', align: 'end' as const }
])
const details = (r: StudentRequest) => [r.birth_date && `ميلاد ${r.birth_date}`, r.guardian_phone, r.tajweed_level, r.residence, r.nearest_mosque]
  .filter(Boolean).join(' · ')
</script>

<template>
  <div class="sr-view">
    <UiSegmentTabs
      v-model="view"
      :tabs="viewTabs"
      label="حالة طلبات إضافة الطلاب"
    />
  </div>
  <UiEmptyState
    v-if="!shown.length"
    :icon="view === 'open' ? 'i-lucide-circle-check-big' : 'i-lucide-inbox'"
    :title="view === 'open' ? 'لا طلباتٍ بانتظار الإدارة' : 'لا طلباتٍ مُغلقة بعد'"
    :description="view === 'open'
      ? (showTeacher ? 'ما يُرسله المعلّمون يظهر هنا ويصل إشعارُه.' : 'ما ترسله يظهر هنا حتى تبتّ فيه الإدارة.')
      : 'ما أُضيف أو رُفض يظهر هنا.'"
  />
  <UiDataTable
    v-else
    :columns="columns"
    :rows="shown"
    row-key="id"
    :row-class="(r: StudentRequest) => r.status === 'open' ? 'is-new' : undefined"
  >
    <template #num="{ index }">
      <span class="seq-n">{{ index + 1 }}</span>
    </template>
    <template #student="{ row }">
      <div class="stu">
        <b>{{ row.full_name }}</b>
        <span><bdi dir="ltr">{{ row.national_id }}</bdi><template v-if="details(row)"> · {{ details(row) }}</template></span>
        <span
          v-if="row.note"
          class="note"
        >{{ row.note }}</span>
        <span
          v-if="row.status === 'rejected' && row.reject_note"
          class="why"
        >سبب الرفض: {{ row.reject_note }}</span>
      </div>
    </template>
    <template #who="{ row }">
      <div class="stu">
        <b>{{ row.halaqa?.teacher?.full_name ?? '—' }}</b>
        <span>{{ row.halaqa?.name ?? '—' }}</span>
      </div>
    </template>
    <template #date="{ row }">
      <bdi
        dir="ltr"
        class="date"
      >{{ deliveryDate(row.created_at) }}</bdi>
    </template>
    <template #state="{ row }">
      <UBadge
        :label="STUDENT_REQUEST_STATUS[row.status].label"
        :color="STUDENT_REQUEST_STATUS[row.status].color"
        :variant="row.status === 'open' ? 'solid' : 'soft'"
      />
    </template>
    <template #actions="{ row }">
      <div
        v-if="canChat || (canDecide && row.status === 'open')"
        class="acts"
      >
        <UTooltip
          v-if="canChat"
          text="محادثة المعلّم"
        >
          <UButton
            icon="i-lucide-message-circle"
            color="secondary"
            variant="soft"
            :aria-label="`محادثة ${row.halaqa?.teacher?.full_name ?? 'المعلّم'}`"
            :ui="{ base: 'rounded-[11px] min-h-10 min-w-10 justify-center' }"
            @click="emit('chat', row)"
          />
        </UTooltip>
        <template v-if="canDecide && row.status === 'open'">
          <UButton
            label="إضافة"
            icon="i-lucide-user-plus"
            color="success"
            variant="solid"
            :loading="busy"
            :ui="{ base: 'rounded-[11px] min-h-10 px-4 font-semibold shadow-sm' }"
            @click="emit('approve', row)"
          />
          <UButton
            label="رفض"
            icon="i-lucide-x"
            color="neutral"
            variant="outline"
            :disabled="busy"
            :ui="{ base: 'rounded-[11px] min-h-10' }"
            @click="emit('reject', row)"
          />
        </template>
      </div>
    </template>
    <template #card="{ row, index }">
      <UiCardRow
        :title="row.full_name"
        :subtitle="showTeacher ? `${row.halaqa?.teacher?.full_name ?? '—'} · ${row.halaqa?.name ?? ''}` : row.national_id"
        :fields="[
          ...(showTeacher ? [{ label: 'الهوية', value: row.national_id }] : []),
          ...(details(row) ? [{ label: 'البيانات', value: details(row) }] : []),
          ...(row.note ? [{ label: 'ملاحظة', value: row.note }] : []),
          ...(row.status === 'rejected' && row.reject_note ? [{ label: 'سبب الرفض', value: row.reject_note }] : []),
          { label: 'التاريخ', value: deliveryDate(row.created_at) }
        ]"
      >
        <template #lead>
          <span class="seq-n">{{ index + 1 }}</span>
        </template>
        <template #badge>
          <UBadge
            :label="STUDENT_REQUEST_STATUS[row.status].label"
            :color="STUDENT_REQUEST_STATUS[row.status].color"
            :variant="row.status === 'open' ? 'solid' : 'soft'"
          />
        </template>
        <template
          v-if="canChat || (canDecide && row.status === 'open')"
          #actions
        >
          <div class="acts acts-card">
            <UButton
              v-if="canChat"
              label="محادثة"
              icon="i-lucide-message-circle"
              color="secondary"
              variant="soft"
              block
              :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
              @click="emit('chat', row)"
            />
            <UButton
              v-if="canDecide && row.status === 'open'"
              label="إضافة"
              icon="i-lucide-user-plus"
              color="success"
              block
              :loading="busy"
              :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
              @click="emit('approve', row)"
            />
            <UButton
              v-if="canDecide && row.status === 'open'"
              label="رفض"
              icon="i-lucide-x"
              color="neutral"
              variant="outline"
              block
              :disabled="busy"
              :ui="{ base: 'rounded-[12px] min-h-11' }"
              @click="emit('reject', row)"
            />
          </div>
        </template>
      </UiCardRow>
    </template>
  </UiDataTable>
</template>

<style scoped>
.sr-view { margin-bottom: 14px; }
.seq-n { color: var(--ink-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.stu { display: flex; flex-direction: column; line-height: 1.5; gap: 2px; min-width: 200px; }
.stu b { color: var(--ink); font-weight: 600; }
.stu span { font-size: 13px; color: var(--ink-3); }
.stu .note { color: var(--ink-2); }
.stu .why { color: var(--ui-error); }
.date { color: var(--ink-2); font-size: 14px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.acts { display: flex; gap: 8px; justify-content: flex-end; }
.acts-card { width: 100%; }
:deep(tr.is-new) { background: color-mix(in srgb, var(--ui-warning) 7%, transparent); }
@container dt (max-width: 899px) {
  :deep(.col-date) { display: none; }
}
</style>
