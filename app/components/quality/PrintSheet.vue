<script setup lang="ts">
/**
 * ورقةُ سجلّ تقييم المعلم المطبوعة (تنزيلُه PDF — قرار المستخدم 2026-10-21: لكلّ من يرى السجلّ، بعد إقفاله).
 * تُنقل إلى body ولا تظهر على الشاشة؛ متى صار `active` تُطبع (`usePrintSheet`) باسم ملفٍّ مقترح
 * «تقييم المعلم — الاسم — 09-2026». جسمُها ورقةُ الشاشة نفسُها (`QualitySheet`) بعد ربط رموزها بألوان الورق
 * الثابتة (`--paper-*`) فلا يطبع الوضعُ الليليّ نصّاً فاتحاً على ورقٍ أبيض؛ وتحتها الملاحظاتُ وحالُ الاطّلاع.
 */
import type { QualityHalaqa, QualityRow } from '~/utils/qualityRecord'
import { parseNumbers } from '~/utils/qualityRecord'

const props = defineProps<{ active: boolean, halaqa: QualityHalaqa | null, record: QualityRow | null, criteria: string[], year: number, month: number }>()
const emit = defineEmits<{ done: [] }>()
const { print } = usePrintSheet()

const numbers = computed(() => parseNumbers(props.record?.numbers))
const period = computed(() => `${String(props.month).padStart(2, '0')}-${props.year}`)
const day = (iso: string | null | undefined) => iso ? gazaDayOf(iso).split('-').reverse().join('-') : ''
const printedOn = day(new Date().toISOString())
// محارفُ تمنعها أنظمةُ الملفّات في اسم الملفّ
const fileTitle = computed(() => `تقييم المعلم — ${(props.halaqa?.teacher?.full_name ?? 'معلم').replace(/[\\/:*?"<>|]+/g, ' ')} — ${period.value}`)

watch(() => props.active, async (on) => {
  if (!on || !import.meta.client) return
  await nextTick()
  print(fileTitle.value, () => emit('done'))
})
</script>

<template>
  <Teleport to="body">
    <article
      v-if="active && numbers"
      class="print-sheet"
      dir="rtl"
      lang="ar"
    >
      <header class="pq-head">
        <div>
          <h1>سجلّ تقييم الجودة</h1>
          <p>أداء المعلم خلال الشهر · بنود الخصم في الدليل المرفق</p>
        </div>
        <img
          src="/brand/turjuman-full.svg"
          alt="ترجمان"
          class="pq-logo"
        >
      </header>
      <dl class="pq-meta">
        <div><dt>اسم المعلم</dt><dd>{{ halaqa?.teacher?.full_name ?? '—' }}</dd></div>
        <div><dt>الحلقة</dt><dd>{{ halaqa?.name ?? '—' }}</dd></div>
        <div><dt>الشهر</dt><dd>{{ period }}</dd></div>
        <div><dt>المشرف</dt><dd>{{ halaqa?.supervisor?.full_name ?? '—' }}</dd></div>
      </dl>

      <QualitySheet
        :numbers="numbers"
        :criteria="criteria"
        :meetings="record?.meetings_score ?? 0"
      />

      <div class="pq-notes">
        <section>
          <h2>ملاحظات المشرف</h2>
          <p>{{ record?.supervisor_notes || '—' }}</p>
        </section>
        <section>
          <h2>ملاحظات الإدارة</h2>
          <p>{{ record?.admin_notes || '—' }}</p>
        </section>
      </div>

      <footer class="pq-foot">
        <span>{{ record?.teacher_ack_at ? `اطّلع المعلم وأقرّ في ${day(record.teacher_ack_at)}` : 'لم يطّلع المعلم بعد' }}</span>
        <span>طُبع من منصّة ترجمان في {{ printedOn }}</span>
      </footer>
    </article>
  </Teleport>
</template>

<style scoped>
.print-sheet { display: none; }

@media print {
  .print-sheet {
    display: block; background: var(--paper); color: var(--paper-ink);
    font-family: 'Lama Sans', 'IBM Plex Sans Arabic', sans-serif; font-size: 10.5pt;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    /* رموزُ الشاشة التي تقرؤها QualitySheet ← ألوانُ الورق الثابتة */
    --surface: var(--paper); --surface-2: var(--paper-soft); --surface-3: var(--paper-soft);
    --ink: var(--paper-ink); --ink-2: var(--paper-ink-2); --ink-3: var(--paper-ink-3);
    --line: var(--paper-line); --line-2: var(--paper-line);
    --navy: var(--paper-accent); --on-primary: var(--paper);
    --green-ink: #1F7A57; --err: #A63D33; --err-soft: #FBEAE7;
  }
  .pq-head { display: flex; align-items: center; justify-content: space-between; gap: 10mm; padding: 4mm 5mm; background: var(--paper-accent); color: var(--paper); border-radius: 2mm 2mm 0 0; }
  .pq-head h1 { margin: 0; font-size: 18pt; font-weight: 700; }
  .pq-head p { margin: 1mm 0 0; font-size: 9.5pt; opacity: .9; }
  .pq-logo { height: 13mm; width: auto; background: var(--paper); border-radius: 1.5mm; padding: 1mm 2mm; }
  .pq-meta { display: grid; grid-template-columns: repeat(4, 1fr); margin: 0 0 4mm; border: .75pt solid var(--paper-line); border-top: 0; }
  .pq-meta > div { padding: 2mm 3mm; }
  .pq-meta > div + div { border-inline-start: .75pt solid var(--paper-line); }
  .pq-meta dt { font-size: 8.5pt; color: var(--paper-ink-3); }
  .pq-meta dd { margin: 0; font-size: 10.5pt; font-weight: 600; }
  :deep(.qs) { gap: 3mm; }
  :deep(.qs-sec), :deep(.qs-sum), :deep(.qs-final) { break-inside: avoid; }
  :deep(.qs-scroll) { overflow: visible; }
  .pq-notes { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 4mm; break-inside: avoid; }
  .pq-notes section { border: .75pt solid var(--paper-line); border-radius: 2mm; min-height: 22mm; }
  .pq-notes h2 { margin: 0; padding: 1.5mm 3mm; background: var(--paper-accent); color: var(--paper); font-size: 10pt; font-weight: 700; }
  .pq-notes p { margin: 0; padding: 2mm 3mm; font-size: 10pt; line-height: 1.7; white-space: pre-wrap; }
  .pq-foot { display: flex; justify-content: space-between; gap: 6mm; margin-top: 5mm; padding-top: 2mm; border-top: .5pt solid var(--paper-line); font-size: 8.5pt; color: var(--paper-ink-3); }
}
</style>
