<script setup lang="ts">
/**
 * طاقم الحلقة مكدَّساً (المعلم ثم المشرف ثم المختبِر، والطلاب اختياراً) — لعمود «الطاقم»
 * في الحاوية المتوسطة ولبطاقات الجوال. الخانة الشاغرة تُكتب بلونٍ أخفت لتُلحظ.
 */
const props = defineProps<{
  teacher: string | null
  supervisor: string | null
  examiner: string | null
  students?: number
}>()

const rows = computed(() => [
  { label: 'المعلّم', value: props.teacher ?? '—', empty: !props.teacher },
  { label: 'المشرف', value: props.supervisor ?? 'بلا مشرف', empty: !props.supervisor },
  { label: 'المختبِر', value: props.examiner ?? 'بلا مختبِر', empty: !props.examiner },
  ...(props.students === undefined ? [] : [{ label: 'الطلاب', value: String(props.students), empty: props.students === 0 }])
])
</script>

<template>
  <dl class="staff">
    <template
      v-for="r in rows"
      :key="r.label"
    >
      <dt>{{ r.label }}</dt>
      <dd :class="{ empty: r.empty }">
        {{ r.value }}
      </dd>
    </template>
  </dl>
</template>

<style scoped>
.staff { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 14px; align-items: baseline; }
dt { font-size: 12px; color: var(--ink-3); white-space: nowrap; }
dd { margin: 0; color: var(--ink); min-width: 0; overflow-wrap: anywhere; }
dd.empty { color: var(--ink-3); }
</style>
