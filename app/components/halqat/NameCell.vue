<script setup lang="ts">
/**
 * خانة اسم الحلقة: أيقونةٌ بلون القسم، والاسم رابطاً إلى تفاصيلها، وتحته الجنس والفئة والوقت اليومي.
 * مشتركة بين جدول الحلقات وبطاقاتها على الجوال.
 */
import type { Database } from '~/types/database.types'
import { SHOW_HALAQA_CLASSIFICATION } from '~/constants/halqat'

type Gender = Database['public']['Enums']['gender_type']
type Classification = Database['public']['Enums']['halaqa_classification']

const props = defineProps<{
  id: string
  name: string
  gender: Gender | null
  classification: Classification | null
  dailyTime: string | null
}>()

const GENDER_LABEL: Record<Gender, string> = { male: 'بنين', female: 'بنات' }
const CLASS_LABEL: Record<Classification, string> = { a: 'الفئة أ', b: 'الفئة ب' }
// التصنيفُ ملغًى حاليّاً (constants/halqat.ts)
const time = computed(() => (props.dailyTime ? props.dailyTime.slice(0, 5) : null))
</script>

<template>
  <NuxtLink
    :to="`/halqat/${id}`"
    class="h-cell"
  >
    <span
      class="hicon"
      :class="gender ?? ''"
    >
      <UIcon
        name="i-lucide-book-open"
        class="size-[18px]"
      />
    </span>
    <span class="h-text">
      <span class="h-name">{{ name }}</span>
      <span class="h-sub">
        <span
          v-if="gender"
          class="g-tag"
          :class="gender"
        >{{ GENDER_LABEL[gender] }}</span>
        <span v-if="SHOW_HALAQA_CLASSIFICATION && classification">{{ CLASS_LABEL[classification] }}</span>
        <!-- الفاصل على الغلاف (يمين النص)، والوقت معزولٌ داخله — كان الفاصل يقع يساره لاتجاه الأرقام -->
        <span v-if="time"><bdi class="num">{{ time }}</bdi></span>
      </span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.h-cell { display: flex; align-items: center; gap: 12px; min-width: 0; color: inherit; border-radius: 10px; }
.h-cell:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
.h-cell:hover .h-name { color: var(--blue); }
.hicon { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; flex: none; background: var(--surface-3); color: var(--ink-2); }
.hicon.male { background: color-mix(in oklab, var(--blue) 14%, transparent); color: var(--blue); }
.hicon.female { background: color-mix(in oklab, var(--green) 16%, transparent); color: color-mix(in oklab, var(--green) 70%, var(--ink)); }
.h-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.h-name { font-weight: 600; color: var(--ink); line-height: 1.3; transition: color .15s; }
.h-sub { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; font-size: 12.5px; color: var(--ink-3); }
.h-sub > * + *::before { content: '·'; margin-inline-end: 10px; color: var(--line-2); }
.g-tag.male { color: var(--blue); }
.g-tag.female { color: color-mix(in oklab, var(--green) 70%, var(--ink)); }
.num { font-variant-numeric: tabular-nums; }
</style>
