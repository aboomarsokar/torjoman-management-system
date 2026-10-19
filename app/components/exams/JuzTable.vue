<script setup lang="ts">
/**
 * تقسيمةُ الأجزاء: جزءُ البرنامج ← بدايتُه ونهايتُه بصيغة «<اسم السورة> <آية>»، بترتيب الحفظ (30 ثم … 1).
 * على الجوال (تحت 720px) بطاقاتٌ عبر UiDataTable.
 */
import type { Position, ProgramJuz } from '~/utils/quran/position'

const props = defineProps<{
  juz: ProgramJuz[]
  surahName: (n: number) => string
}>()

type Row = { number: number, start: string, end: string }

const pos = (p: Position) => `${props.surahName(p.surah)} ${p.ayah}`

/** الأجزاءُ الأكبرُ رقماً أولاً كما في جدول المستخدم (30 ← 1). */
const rows = computed<Row[]>(() => [...props.juz]
  .sort((a, b) => b.number - a.number)
  .map(j => ({ number: j.number, start: pos(j.start), end: pos(j.end) })))

const columns = [
  { key: 'number', label: 'رقم الجزء' },
  { key: 'start', label: 'بداية الجزء' },
  { key: 'end', label: 'نهاية الجزء' }
]
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
    <template #card="{ row }">
      <UiCardRow
        :title="`الجزء ${row.number}`"
        :fields="[
          { label: 'بدايته', value: row.start },
          { label: 'نهايته', value: row.end }
        ]"
      />
    </template>
  </UiDataTable>
</template>

<style scoped>
.num { font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
