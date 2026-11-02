<script setup lang="ts">
/**
 * قسمُ الإشراف في التقرير الشهريّ: زياراتُ الشهر وعلاماتُها، وسجلُّ الجودة إن وُجد، وكلمةُ المشرف مع الاعتماد،
 * والأكثرُ غياباً بلا عذر لمتابعتهم.
 */
import type { HalaqaVisits } from '~/utils/monthVisits'
import type { QualityRow } from '~/utils/monthlyReport'

interface Props {
  visits: HalaqaVisits | undefined
  quality: QualityRow | null
  approvalNote: string | null
  frequent: { id: string, name: string, unexcused: number, held: number }[]
}
defineProps<Props>()
</script>

<template>
  <section class="msp card">
    <h2>الإشراف والمتابعة</h2>
    <FollowUpVisitsLine :visits="visits" />
    <p
      v-if="quality?.final !== null && quality?.final !== undefined"
      class="msp-q"
    >
      سجلّ الجودة: النهائي <b>{{ quality.final }}</b> · الجودة {{ quality.quality ?? '—' }} · الإنجاز {{ quality.achievement ?? '—' }}
      <span v-if="!quality.locked_at"> (لم يُقفل بعد)</span>
    </p>
    <p
      v-if="approvalNote"
      class="msp-note"
    >
      <strong>كلمة المشرف:</strong> {{ approvalNote }}
    </p>
    <div v-if="frequent.length">
      <h3>الأكثر غياباً بلا عذر</h3>
      <ul class="msp-abs">
        <li
          v-for="f in frequent"
          :key="f.id"
        >
          {{ f.name }} · غاب {{ f.unexcused }} من {{ f.held }}
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.msp { display: flex; flex-direction: column; gap: 12px; }
.msp h2 { margin: 0; font-size: 17px; color: var(--ink); }
.msp h3 { margin: 0 0 6px; font-size: 15px; color: var(--ink); }
.msp-q { margin: 0; color: var(--ink-2); }
.msp-note { margin: 0; padding: 12px 14px; border-radius: var(--r-control); background: var(--chip-info-bg); color: var(--chip-info-ink); white-space: pre-line; line-height: 1.7; }
.msp-abs { margin: 0; padding-inline-start: 18px; color: var(--ink-2); display: grid; gap: 4px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 20px; }
</style>
