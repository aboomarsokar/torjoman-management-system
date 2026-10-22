<script setup lang="ts">
/**
 * تقسيمةُ الأجزاء: جزءُ البرنامج ← بدايتُه ونهايتُه بصيغة «<اسم السورة> <آية>»، بترتيب الحفظ (30 ثم … 1).
 * على الجوال (تحت 720px) بطاقاتٌ عبر UiDataTable. وللمدير الإداري زرُّ «تعديل» لكلّ جزء (`edit`).
 */
import type { Position, ProgramJuz } from '~/utils/quran/position'

const props = defineProps<{
  juz: ProgramJuz[]
  surahName: (n: number) => string
  /** المدير الإداري وحده يعدّل التقسيمة (قرار 2026-10-22). */
  canEdit?: boolean
}>()
const emit = defineEmits<{ edit: [ProgramJuz] }>()

type Row = { number: number, start: string, end: string }

const pos = (p: Position) => `${props.surahName(p.surah)} ${p.ayah}`

/** الأجزاءُ الأكبرُ رقماً أولاً كما في جدول المستخدم (30 ← 1). */
const rows = computed<Row[]>(() => [...props.juz]
  .sort((a, b) => b.number - a.number)
  .map(j => ({ number: j.number, start: pos(j.start), end: pos(j.end) })))

const columns = computed(() => [
  { key: 'number', label: 'رقم الجزء' },
  { key: 'start', label: 'بداية الجزء' },
  { key: 'end', label: 'نهاية الجزء' },
  ...(props.canEdit ? [{ key: 'actions', label: '', align: 'end' as const }] : [])
])
function onEdit(n: number) {
  const j = props.juz.find(x => x.number === n)
  if (j) emit('edit', j)
}
</script>

<template>
  <UiDataTable
    :columns="columns"
    :rows="rows"
    row-key="number"
  >
    <template #number="{ row }">
      <span class="num">{{ row.number }}</span>
    </template>
    <template #actions="{ row }">
      <UButton
        label="تعديل"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-pencil"
        :ui="{ base: 'rounded-[10px]' }"
        @click="onEdit(row.number)"
      />
    </template>
    <template #card="{ row }">
      <UiCardRow
        :title="`الجزء ${row.number}`"
        :fields="[
          { label: 'بدايته', value: row.start },
          { label: 'نهايته', value: row.end }
        ]"
      >
        <template
          v-if="canEdit"
          #actions
        >
          <UButton
            label="تعديل"
            color="neutral"
            variant="outline"
            icon="i-lucide-pencil"
            block
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="onEdit(row.number)"
          />
        </template>
      </UiCardRow>
    </template>
  </UiDataTable>
</template>

<style scoped>
.num { font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
