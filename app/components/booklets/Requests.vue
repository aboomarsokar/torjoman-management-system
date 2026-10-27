<script setup lang="ts">
/**
 * طلباتُ الملازم في أرشيف الملازم (المدير الإداري — طلب المستخدم 2026-10-25): المفتوحةُ أوّلاً بشارة «جديد»،
 * والمعلّمُ وحلقتُه والملزمةُ وعددُ النسخ والملاحظةُ والتاريخ. «تمّ التسليم» يفتح مربّعَ تأكيدٍ بتاريخ التسليم (اليومُ افتراضاً)،
 * فيُسجَّل التسليمُ في الأرشيف ويُغلَق الطلبُ ويُشعَر المعلّم (طلب المستخدم 2026-10-25). مشرفُ المشروع يقرأ.
 * تبويبان يفصلان «بانتظار التسليم» عن «تمّ التسليم»، وزرُّ «تسليم» أخضرُ ممتلئ (طلب المستخدم 2026-10-27).
 */
import { BOOKLETS } from '~/constants/booklets'
import type { BookletRequest } from '~/composables/useBookletRequests'
import { deliveryDate } from '~/utils/booklets'
import { gazaToday } from '~/utils/reportWindow'
import { PROJECT_START_DATE } from '~/constants/project'

const props = defineProps<{ rows: BookletRequest[], canClose: boolean, busy: boolean }>()
const emit = defineEmits<{ deliver: [id: string, deliveredOn: string] }>()

type View = 'open' | 'done'
const view = ref<View>('open')
const openRows = computed(() => props.rows.filter(r => r.status === 'open'))
const doneRows = computed(() => props.rows.filter(r => r.status !== 'open'))
const shown = computed(() => (view.value === 'open' ? openRows.value : doneRows.value))
const viewTabs = computed(() => [
  { key: 'open' as const, label: 'بانتظار التسليم', icon: 'i-lucide-hourglass', count: openRows.value.length },
  { key: 'done' as const, label: 'تمّ التسليم', icon: 'i-lucide-package-check', count: doneRows.value.length }
])

const label = (n: number) => BOOKLETS.find(b => b.no === n)?.label ?? `الملزمة ${n}`

/** الطلبُ الذي ينتظر تأكيدَ «تمّ التسليم». */
const toClose = ref<BookletRequest | null>(null)
const deliveredOn = ref('')
const today = gazaToday()
watch(toClose, (r) => {
  if (r) deliveredOn.value = today
})
function confirmClose() {
  if (toClose.value && deliveredOn.value) emit('deliver', toClose.value.id, deliveredOn.value)
  toClose.value = null
}
const columns = [
  { key: 'num', label: '#' },
  { key: 'who', label: 'المعلّم والحلقة' },
  { key: 'booklet', label: 'الطلب' },
  { key: 'date', label: 'التاريخ', class: 'col-date' },
  { key: 'state', label: 'الحالة' },
  { key: 'actions', label: '', align: 'end' as const }
]
</script>

<template>
  <UiEmptyState
    v-if="!rows.length"
    icon="i-lucide-inbox"
    title="لا طلباتِ ملازم بعد"
    description="يطلب المعلّمون الملازمَ من لوحاتهم، فتظهر طلباتُهم هنا ويصلك إشعار."
  />
  <div
    v-else
    class="req-view"
  >
    <UiSegmentTabs
      v-model="view"
      :tabs="viewTabs"
      label="حالة طلبات الملازم"
    />
  </div>
  <UiEmptyState
    v-if="rows.length && !shown.length"
    :icon="view === 'open' ? 'i-lucide-circle-check-big' : 'i-lucide-inbox'"
    :title="view === 'open' ? 'لا طلباتٍ بانتظار التسليم' : 'لا طلباتٍ مسلَّمة بعد'"
    :description="view === 'open' ? 'سُلِّمت الطلباتُ كلُّها — ما يُسلَّم يظهر في «تمّ التسليم».' : 'ما تسلّمه يظهر هنا بتاريخه.'"
  />
  <UiDataTable
    v-else-if="shown.length"
    :columns="columns"
    :rows="shown"
    row-key="id"
    :row-class="(r: BookletRequest) => r.status === 'open' ? 'is-new' : undefined"
  >
    <template #num="{ index }">
      <span class="seq-n">{{ index + 1 }}</span>
    </template>
    <template #who="{ row }">
      <div class="who">
        <b>{{ row.halaqa?.teacher?.full_name ?? '—' }}</b>
        <span>{{ row.halaqa?.name ?? '—' }}</span>
      </div>
    </template>
    <template #booklet="{ row }">
      <div class="req">
        <span class="chip">{{ label(row.booklet) }} <b>× {{ row.copies }}</b></span>
        <span
          v-if="row.note"
          class="note"
        >{{ row.note }}</span>
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
        v-if="row.status === 'open'"
        label="جديد"
        color="warning"
        variant="solid"
        class="new-badge"
      />
      <UBadge
        v-else
        label="تمّ التسليم"
        color="success"
        variant="soft"
      />
    </template>
    <template #actions="{ row }">
      <UButton
        v-if="canClose && row.status === 'open'"
        label="تسليم"
        icon="i-lucide-package-check"
        color="success"
        variant="solid"
        size="md"
        :loading="busy"
        :ui="{ base: 'rounded-[11px] min-h-10 px-4 font-semibold shadow-sm' }"
        @click="toClose = row"
      />
    </template>
    <template #card="{ row, index }">
      <UiCardRow
        :title="row.halaqa?.teacher?.full_name ?? '—'"
        :subtitle="row.halaqa?.name ?? ''"
        :fields="[
          { label: 'الطلب', value: `${label(row.booklet)} × ${row.copies}` },
          ...(row.note ? [{ label: 'ملاحظة', value: row.note }] : []),
          { label: 'التاريخ', value: deliveryDate(row.created_at) }
        ]"
      >
        <template #lead>
          <span class="seq-n">{{ index + 1 }}</span>
        </template>
        <template #badge>
          <UBadge
            :label="row.status === 'open' ? 'جديد' : 'تمّ التسليم'"
            :color="row.status === 'open' ? 'warning' : 'success'"
            :variant="row.status === 'open' ? 'solid' : 'soft'"
          />
        </template>
        <template
          v-if="canClose && row.status === 'open'"
          #actions
        >
          <UButton
            label="تسليم"
            icon="i-lucide-package-check"
            color="success"
            variant="solid"
            block
            :loading="busy"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="toClose = row"
          />
        </template>
      </UiCardRow>
    </template>
  </UiDataTable>

  <UModal
    :open="!!toClose"
    title="تأكيدُ التسليم"
    @update:open="(v: boolean) => { if (!v) toClose = null }"
  >
    <template #body>
      <div class="dl">
        <p>
          هل سلّمتَ <b>{{ toClose?.halaqa?.teacher?.full_name ?? 'المعلّم' }}</b> ({{ toClose?.halaqa?.name }})
          <b>{{ toClose ? label(toClose.booklet) : '' }} × {{ toClose?.copies }}</b>؟
        </p>
        <UFormField label="تاريخ التسليم">
          <UInput
            v-model="deliveredOn"
            type="date"
            :min="PROJECT_START_DATE"
            :max="today"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <p class="dl-hint">
          يُسجَّل التسليمُ في الأرشيف، ويُغلَق الطلب، ويصل المعلّمَ إشعارٌ بالتسليم وتاريخه.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="toClose = null"
        />
        <UButton
          label="نعم، تمّ التسليم"
          icon="i-lucide-check"
          color="primary"
          :loading="busy"
          :disabled="!deliveredOn || deliveredOn > today"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="confirmClose"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.req-view { margin-bottom: 14px; }
.seq-n { color: var(--ink-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.dl { display: flex; flex-direction: column; gap: 14px; }
.dl p { margin: 0; color: var(--ink); line-height: 1.8; }
.dl .dl-hint { color: var(--ink-3); font-size: 13.5px; }
.who { display: flex; flex-direction: column; line-height: 1.45; min-width: 180px; }
.who b { color: var(--ink); font-weight: 600; white-space: nowrap; }
.who span { font-size: 13px; color: var(--ink-3); white-space: nowrap; }
.req { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.chip { padding: 3px 10px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 13px; white-space: nowrap; }
.chip b { color: var(--blue-ink); font-variant-numeric: tabular-nums; }
.note { font-size: 13px; color: var(--ink-2); }
.date { color: var(--ink-2); font-size: 14px; white-space: nowrap; font-variant-numeric: tabular-nums; }
/* الطلبُ الجديدُ يُرى من بعيد: خلفيةٌ خفيفةٌ من لون الشارة */
:deep(tr.is-new) { background: color-mix(in srgb, var(--ui-warning) 7%, transparent); }
@container dt (max-width: 899px) {
  :deep(.col-date) { display: none; }
}
</style>
