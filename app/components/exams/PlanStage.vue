<script setup lang="ts">
/**
 * مرحلةٌ واحدة من خطة الاختبارات: شارةُ المرحلة ثم جدولُ دوراتها الخمس
 * (الدورات · عدد الأجزاء · تفصيل الأجزاء · وصف السور · حدودُها من التقسيمة)، والدورةُ الخامسة الشاملة مُبرزة.
 * على الجوال (تحت 720px) تصير الصفوفُ بطاقاتٍ عبر UiDataTable. زرُّ «تعديل» لمن يملك الصلاحية.
 */
import type { ProgramJuz } from '~/utils/quran/position'
import { CYCLE_LABELS, STAGE_LABELS, cycleSpanLabel, partsCount } from '~/utils/exams/cycles'
import type { ExamCycle } from '~/utils/exams/cycles'

const props = defineProps<{
  stage: number
  cycles: ExamCycle[]
  juz: ProgramJuz[]
  surahName: (n: number) => string
  canEdit: boolean
}>()
defineEmits<{ edit: [cycle: ExamCycle] }>()

/** الدورةُ الخامسة تجمع الدوراتِ الأربع قبلها فتُبرَز. */
const LAST_CYCLE = 5

type Row = {
  id: number
  cycle: ExamCycle
  name: string
  count: number
  detail: string
  surahs: string
  span: string
}

const rows = computed<Row[]>(() => props.cycles.map(c => ({
  id: c.id,
  cycle: c,
  name: CYCLE_LABELS[c.cycle_number] ?? `الدورة ${c.cycle_number}`,
  count: partsCount(c),
  detail: `${c.parts_from} – ${c.parts_to}`,
  surahs: c.surahs_label,
  span: cycleSpanLabel(c, props.juz, props.surahName)
})))

const columns = computed(() => {
  const base = [
    { key: 'name', label: 'الدورات' },
    { key: 'count', label: 'عدد الأجزاء' },
    { key: 'detail', label: 'تفصيل الأجزاء' },
    { key: 'surahs', label: 'وصف السور' },
    { key: 'span', label: 'حدودُها من التقسيمة' }
  ]
  return props.canEdit ? [...base, { key: 'actions', label: '', align: 'end' as const }] : base
})

const rowClass = (r: Row) => (r.cycle.cycle_number === LAST_CYCLE ? 'cycle-all' : undefined)
</script>

<template>
  <section class="stage">
    <div class="stage-head">
      <h3 class="stage-pill">
        {{ STAGE_LABELS[stage] ?? `المرحلة ${stage}` }}
      </h3>
      <span
        class="stage-line"
        aria-hidden="true"
      />
    </div>
    <UiDataTable
      :columns="columns"
      :rows="rows"
      row-key="id"
      :row-class="rowClass"
      class="plan-table"
    >
      <template #name="{ row }">
        <span class="strong">{{ row.name }}</span>
      </template>
      <template #count="{ row }">
        <span class="num">{{ row.count }}</span>
      </template>
      <template #detail="{ row }">
        <span
          class="num"
          dir="ltr"
        >{{ row.detail }}</span>
      </template>
      <template #span="{ row }">
        {{ row.span || '—' }}
      </template>
      <template #actions="{ row }">
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-pencil"
          label="تعديل"
          class="edit-btn"
          :ui="{ base: 'rounded-[10px]' }"
          :aria-label="`تعديل ${row.name} من ${STAGE_LABELS[stage]}`"
          @click="$emit('edit', row.cycle)"
        />
      </template>
      <template #card="{ row }">
        <UiCardRow
          :title="row.name"
          :subtitle="`الأجزاء \u2066${row.detail}\u2069`"
          :fields="[
            { label: 'عدد الأجزاء', value: row.count },
            { label: 'وصف السور', value: row.surahs },
            { label: 'حدودُها', value: row.span }
          ]"
          :class="{ 'card-all': row.cycle.cycle_number === LAST_CYCLE }"
        >
          <template
            v-if="row.cycle.cycle_number === LAST_CYCLE"
            #badge
          >
            <span class="all-tag">شاملة</span>
          </template>
          <template
            v-if="canEdit"
            #actions
          >
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-pencil"
              label="تعديل"
              :ui="{ base: 'rounded-[10px]' }"
              @click="$emit('edit', row.cycle)"
            />
          </template>
        </UiCardRow>
      </template>
    </UiDataTable>
  </section>
</template>

<style scoped>
.stage { margin-bottom: 28px; }
.stage-head { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
.stage-pill { margin: 0; padding: 8px 22px; border-radius: 999px; background: var(--navy); color: var(--on-primary); font-size: 16px; font-weight: 700; }
.stage-line { flex: 1; height: 1px; background: var(--line-2); }
.strong { font-weight: 600; color: var(--ink); white-space: nowrap; }
.num { font-weight: 700; font-variant-numeric: tabular-nums; }
.edit-btn { min-height: 36px; }
/* الصفُّ الخامس: خلفيةٌ بلون الهوية ونصٌّ فاتح — الصنفُ يصل من UiDataTable فيُنسَّق بـ:deep */
.plan-table :deep(tr.cycle-all) { background: var(--navy); color: var(--on-primary); }
.plan-table :deep(tr.cycle-all td) { color: var(--on-primary); }
.plan-table :deep(tr.cycle-all .strong) { color: var(--on-primary); }
.plan-table :deep(tr.cycle-all .edit-btn) { background: transparent; color: var(--on-primary); box-shadow: inset 0 0 0 1px var(--side-ink); }
.all-tag { padding: 3px 10px; border-radius: 999px; background: var(--navy); color: var(--on-primary); font-size: 12px; font-weight: 600; }
.card-all { border-inline-start: 4px solid var(--navy); }
</style>
