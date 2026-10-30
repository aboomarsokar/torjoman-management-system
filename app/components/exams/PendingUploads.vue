<script setup lang="ts">
/**
 * قسمُ «على جهازك» في طابور الرصد: النتائجُ التي رصدها المختبِرُ بلا اتصالٍ وتنتظر الرفع — لكلّ طالبٍ اسمُه ودورتُه
 * ومجموعُه من 99 وحكمُه بدرجة النجاح المحفوظة (لا حكمَ إن لم تُحفظ). تُخرجها الشاشةُ من الطابور فلا يُرصد البندُ مرّتين.
 */
import { PENDING_UPLOAD_BADGE } from '~/composables/useVisitOffline'
import { EXAM_MAX_TOTAL } from '~/constants/exams'

defineProps<{
  items: { key: string, studentName: string, title: string, total: number, verdict: 'passed' | 'failed' | null }[]
}>()
</script>

<template>
  <section
    class="pend"
    :aria-label="PENDING_UPLOAD_BADGE"
  >
    <h2>{{ PENDING_UPLOAD_BADGE }}</h2>
    <ul>
      <li
        v-for="p in items"
        :key="p.key"
      >
        <div class="what">
          <b><bdi>{{ p.studentName }}</bdi></b>
          <span>{{ p.title }}</span>
        </div>
        <div class="res">
          <span
            class="total"
            dir="ltr"
          >{{ p.total }} / {{ EXAM_MAX_TOTAL }}</span>
          <span
            v-if="p.verdict"
            class="verdict"
            :class="{ ok: p.verdict === 'passed' }"
          >{{ p.verdict === 'passed' ? 'اجتاز' : 'لم يجتز' }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.pend { padding: 16px 18px; border-radius: 16px; border: 1px solid var(--line); background: var(--surface); }
.pend h2 { margin: 0 0 8px; font-size: 15.5px; font-weight: 700; color: var(--chip-warn-ink); }
.pend ul { list-style: none; margin: 0; padding: 0; }
.pend li { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; min-height: 44px; padding: 10px 0; }
.pend li + li { border-top: 1px solid var(--line); }
.what { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.what b { color: var(--ink); }
.what span { font-size: 13.5px; color: var(--ink-2); }
.res { display: flex; align-items: center; gap: 10px; }
.total { font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.verdict { display: inline-flex; align-items: center; height: 28px; padding: 0 12px; border-radius: 999px; background: var(--err-soft); color: var(--err); font-size: 13px; font-weight: 700; }
.verdict.ok { background: var(--green-soft); color: var(--green-ink); }
</style>
