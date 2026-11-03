<script setup lang="ts">
/**
 * ورقةُ التقرير الشهريّ المطبوعة إلى PDF (طلب المستخدم 2026-11-02): تُنقل إلى body ولا تظهر على الشاشة؛ متى صار
 * `active` تُطبع (`usePrintSheet`) باسم ملفٍّ مقترح «التقرير الشهري — <الحلقة أو كل الحلقات> — MM-YYYY». ألوانُها ثابتةٌ
 * للورق (`--paper-*`) فلا يطبع الوضعُ الليليّ نصّاً فاتحاً. الجسمُ في الفتحة: `MonthlyReportPrintOverview` أو `…PrintDetail`.
 */
interface Props {
  active: boolean
  /** «كل الحلقات» أو اسمُ الحلقة. */
  subject: string
  /** اسمُ المعلم لتقرير الحلقة. */
  teacher?: string | null
  year: number
  month: number
}
const props = defineProps<Props>()
const emit = defineEmits<{ done: [] }>()
const { print } = usePrintSheet()

const period = computed(() => `${String(props.month).padStart(2, '0')}-${props.year}`)
const printedOn = gazaToday().split('-').reverse().join('-')
// محارفُ تمنعها أنظمةُ الملفّات في اسم الملفّ
const fileTitle = computed(() => `التقرير الشهري — ${props.subject.replace(/[\\/:*?"<>|]+/g, ' ')} — ${period.value}`)

watch(() => props.active, async (on) => {
  if (!on || !import.meta.client) return
  await nextTick()
  print(fileTitle.value, () => emit('done'))
})
</script>

<template>
  <Teleport to="body">
    <article
      v-if="active"
      class="print-sheet mrp"
      dir="rtl"
      lang="ar"
    >
      <header class="mrp-head">
        <div>
          <h1>التقرير الشهري — {{ subject }}</h1>
          <p>
            شهر {{ period }}<template v-if="teacher">
              · {{ teacher }}
            </template>
          </p>
        </div>
        <img
          src="/brand/turjuman-full.svg"
          alt="ترجمان"
          class="mrp-logo"
        >
      </header>
      <slot />
      <footer class="mrp-foot">
        <span>منصة ترجمان القرآنية</span>
        <span>طُبع في {{ printedOn }}</span>
      </footer>
    </article>
  </Teleport>
</template>

<style scoped>
.print-sheet { display: none; }

@media print {
  @page { size: A4 landscape; margin: 10mm; }
  .print-sheet {
    display: block; background: var(--paper); color: var(--paper-ink);
    font-family: 'Lama Sans', 'IBM Plex Sans Arabic', sans-serif; font-size: 9.5pt;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .mrp-head { display: flex; align-items: center; justify-content: space-between; gap: 10mm; padding: 4mm 5mm; margin-bottom: 4mm; background: var(--paper-accent); color: var(--paper); border-radius: 2mm; }
  .mrp-head h1 { margin: 0; font-size: 16pt; font-weight: 700; }
  .mrp-head p { margin: 1mm 0 0; font-size: 9.5pt; opacity: .9; }
  .mrp-logo { height: 12mm; width: auto; background: var(--paper); border-radius: 1.5mm; padding: 1mm 2mm; }
  .mrp :deep(.pr-table) { width: 100%; border-collapse: collapse; }
  .mrp :deep(.pr-table th) { background: var(--paper-soft); color: var(--paper-ink-2); font-weight: 600; text-align: start; padding: 1.6mm 2mm; border: .5pt solid var(--paper-line); }
  .mrp :deep(.pr-table td) { padding: 1.4mm 2mm; border: .5pt solid var(--paper-line); vertical-align: top; }
  .mrp :deep(.pr-table tr) { break-inside: avoid; }
  .mrp :deep(.pr-name) { font-weight: 600; }
  .mrp :deep(small) { display: block; font-size: 8pt; color: var(--paper-ink-3); }
  .mrp :deep(.ok) { color: var(--paper-ok-ink); }
  .mrp :deep(.warn) { color: var(--paper-warn-ink); }
  .mrp :deep(.bad) { color: var(--paper-bad-ink); }
  .mrp :deep(.pr-legend) { margin: 3mm 0 0; font-size: 8.5pt; color: var(--paper-ink-3); line-height: 1.6; }
  .mrp :deep(.pr-cells) { display: grid; grid-template-columns: repeat(6, 1fr); margin: 0 0 3mm; border: .75pt solid var(--paper-line); border-radius: 2mm; }
  .mrp :deep(.pr-cells > div) { padding: 2mm 3mm; }
  .mrp :deep(.pr-cells > div + div) { border-inline-start: .75pt solid var(--paper-line); }
  .mrp :deep(.pr-cells dt) { font-size: 8pt; color: var(--paper-ink-3); }
  .mrp :deep(.pr-cells dd) { margin: 0; font-size: 12pt; font-weight: 700; }
  .mrp :deep(.pr-sup) { margin: 0 0 3mm; padding: 2mm 3mm; border: .75pt solid var(--paper-line); border-radius: 2mm; break-inside: avoid; }
  .mrp :deep(.pr-sup h2) { margin: 0 0 1mm; font-size: 11pt; }
  .mrp :deep(.pr-sup p) { margin: 1mm 0; line-height: 1.6; }
  .mrp :deep(.pr-note) { padding: 1.5mm 2.5mm; background: var(--paper-soft); border-radius: 1.5mm; white-space: pre-line; }
  .mrp-foot { display: flex; justify-content: space-between; gap: 6mm; margin-top: 4mm; padding-top: 2mm; border-top: .5pt solid var(--paper-line); font-size: 8pt; color: var(--paper-ink-3); }
}
</style>
