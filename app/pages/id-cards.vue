<script setup lang="ts">
/**
 * متابعةُ صور الهويات (طلب المستخدم 2026-10-31) — للمدير الإداريّ (الكادرُ كلُّه) والمديرة الإدارية (عاملاتُ قسم البنات):
 * عدّادُ من رفع، وفلترٌ بالحالة والبحث، وفتحُ صورةٍ، وتنزيلُ صورةٍ أو المحدَّدين أو كلِّ المرفوع في ملفٍّ مضغوطٍ بأسمائهم،
 * وتذكيرُ من لم يرفع برسالة إدارة.
 */
import type { StaffIdRow } from '~/composables/useIdCards'
import type { SegmentTab } from '~/components/ui/SegmentTabs.vue'
import { remindableIds } from '~/composables/useIdCards'
import { roleLabel, type Role } from '~/constants/roles'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'صور الهويات — ترجمان' })

const { isAdmin, isWomenAdmin } = usePermissions()
const canView = computed(() => isAdmin.value || isWomenAdmin.value)
const api = useIdCards()
const { rows, loading, busy } = api
watch(canView, (v) => {
  if (v) void api.load(!isAdmin.value)
}, { immediate: true })

type Filter = 'all' | 'done' | 'missing'
const filter = ref<Filter>('all')
const query = ref('')
const done = computed(() => rows.value.filter(r => r.card).length)
const tabs = computed<SegmentTab<Filter>[]>(() => [
  { key: 'all', label: 'الكل', icon: 'i-lucide-list', count: rows.value.length || undefined },
  { key: 'done', label: 'رُفعت', icon: 'i-lucide-badge-check', count: done.value || undefined },
  { key: 'missing', label: 'لم تُرفع', icon: 'i-lucide-circle-dashed', count: (rows.value.length - done.value) || undefined }
])
const shown = computed(() => {
  const q = query.value.trim()
  return rows.value.filter(r => (filter.value === 'all' || (filter.value === 'done') === !!r.card)
    && (!q || r.full_name.includes(q) || (r.employee_number ?? '').includes(q)))
})
const selected = ref<string[]>([])
const selectedRows = computed(() => rows.value.filter(r => selected.value.includes(r.id) && r.card))
const allShownSelected = computed(() => shown.value.some(r => r.card) && shown.value.filter(r => r.card).every(r => selected.value.includes(r.id)))
function toggleAll() {
  const ids = shown.value.filter(r => r.card).map(r => r.id)
  selected.value = allShownSelected.value ? selected.value.filter(id => !ids.includes(id)) : [...new Set([...selected.value, ...ids])]
}
const toRemind = computed(() => remindableIds(rows.value))
const when = (iso: string) => new Date(iso).toLocaleDateString('ar-EG-u-nu-latn', { day: '2-digit', month: '2-digit', year: 'numeric' })
const columns = [
  { key: 'pick', label: '' },
  { key: 'who', label: 'العامل' },
  { key: 'state', label: 'صورة الهوية' },
  { key: 'actions', label: '', align: 'end' as const }
]
</script>

<template>
  <main class="idp">
    <UiPageHeader
      title="صور الهويات"
      :subtitle="isAdmin ? 'صورُ هويات الكادر — يرفعها كلٌّ من حسابه' : 'صورُ هويات عاملات قسم البنات'"
    />
    <UiEmptyState
      v-if="!canView"
      icon="i-lucide-lock"
      title="هذه الصفحة للمدير الإداري والمديرة الإدارية."
    />
    <template v-else>
      <div class="idp-bar">
        <p class="idp-count">
          رفع <b>{{ done }}</b> من <b>{{ rows.length }}</b>
        </p>
        <UButton
          :label="selectedRows.length ? `نزّل المحدَّدين (${selectedRows.length})` : `نزّل الكلّ (${done})`"
          icon="i-lucide-download"
          color="primary"
          :disabled="!done"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="api.download(selectedRows.length ? selectedRows : rows)"
        />
        <UButton
          v-if="toRemind.length"
          :label="`ذكّر من لم يرفع (${toRemind.length})`"
          icon="i-lucide-bell-ring"
          color="neutral"
          variant="outline"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="api.remind(toRemind)"
        />
      </div>
      <div class="idp-tools">
        <UiSegmentTabs
          v-model="filter"
          :tabs="tabs"
          label="حالة صورة الهوية"
        />
        <UiSearchField
          v-model="query"
          placeholder="ابحث بالاسم أو الرقم الوظيفي"
          class="idp-search"
        />
        <UCheckbox
          :model-value="allShownSelected"
          label="حدّد كلّ المرفوع"
          @update:model-value="toggleAll"
        />
      </div>
      <UiSkeletonCard
        v-if="loading && !rows.length"
        :lines="5"
      />
      <UiEmptyState
        v-else-if="!shown.length"
        icon="i-lucide-id-card"
        title="لا أحد في هذا التصنيف"
      />
      <UiDataTable
        v-else
        :columns="columns"
        :rows="shown"
        row-key="id"
      >
        <template #pick="{ row }">
          <UCheckbox
            v-if="row.card"
            :model-value="selected.includes(row.id)"
            :aria-label="`حدّد ${row.full_name}`"
            @update:model-value="(v: boolean | 'indeterminate') => (selected = v === true ? [...selected, row.id] : selected.filter(x => x !== row.id))"
          />
        </template>
        <template #who="{ row }">
          <div class="who">
            <b>{{ row.full_name }}</b>
            <span>{{ roleLabel(row.role as Role, row.gender) }}<template v-if="row.employee_number"> · <bdi dir="ltr">{{ row.employee_number }}</bdi></template></span>
          </div>
        </template>
        <template #state="{ row }">
          <UBadge
            v-if="row.card"
            :label="`رُفعت · ${when(row.card.uploaded_at)}`"
            color="success"
            variant="soft"
          />
          <UBadge
            v-else
            label="لم تُرفع"
            color="warning"
            variant="soft"
          />
        </template>
        <template #actions="{ row }">
          <div
            v-if="row.card"
            class="acts"
          >
            <UButton
              label="اعرض"
              icon="i-lucide-eye"
              color="neutral"
              variant="soft"
              :ui="{ base: 'rounded-[11px] min-h-10' }"
              @click="api.view(row)"
            />
            <UButton
              icon="i-lucide-download"
              color="neutral"
              variant="ghost"
              :aria-label="`نزّل هوية ${row.full_name}`"
              title="نزّل"
              :ui="{ base: 'rounded-[11px] min-h-10 min-w-10 justify-center' }"
              @click="api.download([row as StaffIdRow])"
            />
          </div>
        </template>
        <template #card="{ row }">
          <UiCardRow
            :title="row.full_name"
            :subtitle="roleLabel(row.role as Role, row.gender) + (row.employee_number ? ` · ${row.employee_number}` : '')"
            :fields="[{ label: 'صورة الهوية', value: row.card ? `رُفعت · ${when(row.card.uploaded_at)}` : 'لم تُرفع' }]"
          >
            <template
              v-if="row.card"
              #actions
            >
              <div class="acts acts-block">
                <UCheckbox
                  :model-value="selected.includes(row.id)"
                  label="حدّد"
                  @update:model-value="(v: boolean | 'indeterminate') => (selected = v === true ? [...selected, row.id] : selected.filter(x => x !== row.id))"
                />
                <UButton
                  label="اعرض"
                  icon="i-lucide-eye"
                  color="neutral"
                  variant="soft"
                  :ui="{ base: 'rounded-[12px] min-h-11' }"
                  @click="api.view(row)"
                />
                <UButton
                  label="نزّل"
                  icon="i-lucide-download"
                  color="neutral"
                  variant="soft"
                  :ui="{ base: 'rounded-[12px] min-h-11' }"
                  @click="api.download([row as StaffIdRow])"
                />
              </div>
            </template>
          </UiCardRow>
        </template>
      </UiDataTable>
    </template>
  </main>
</template>

<style scoped>
.idp { display: flex; flex-direction: column; gap: 16px; }
.idp-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.idp-count { margin: 0; margin-inline-end: auto; color: var(--ink-2); font-size: 15px; }
.idp-count b { color: var(--ink); font-size: 18px; font-variant-numeric: tabular-nums; }
.idp-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.idp-search { flex: 1 1 240px; min-width: 0; }
.who { display: flex; flex-direction: column; line-height: 1.45; }
.who b { color: var(--ink); font-weight: 600; }
.who span { font-size: 13px; color: var(--ink-3); }
.acts { display: flex; gap: 6px; justify-content: flex-end; align-items: center; }
.acts-block { width: 100%; justify-content: flex-start; flex-wrap: wrap; }
</style>
