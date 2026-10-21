<script setup lang="ts">
/**
 * ورقةُ المحضر المطبوعة (تنزيلُه PDF عبر «حفظ بتنسيق PDF» في نافذة الطباعة — قرار المستخدم 2026-10-21).
 * تُنقل إلى body ولا تظهر على الشاشة؛ متى وصلها `minute` تُطبع: عنوانُ المستند يصير اسمَ الملفّ المقترح
 * (`minutePdfTitle`)، وصنفُ `printing-sheet` على html يُخفي التطبيقَ وقتَ الطباعة (main.css)،
 * وبعدها يعود كلُّ شيء وتُرسَل `done`. ألوانُها من رموز `--paper-*` فلا يبدّلها الوضعُ الليليّ.
 */
import { roleLabel } from '~/constants/roles'
import type { MinuteRow, MinuteStaff } from '~/utils/minutes'
import { MINUTE_SECTIONS, minuteDate, minuteItems, minutePdfTitle } from '~/utils/minutes'

const props = defineProps<{ minute: MinuteRow | null, staff: MinuteStaff[] }>()
const emit = defineEmits<{ done: [] }>()

const PRINTING_CLASS = 'printing-sheet'

const attendees = computed(() => {
  const byId = new Map(props.staff.map(s => [s.id, s]))
  return (props.minute?.attendee_ids ?? []).map(id => byId.get(id)).filter(s => !!s)
})
const sections = computed(() => MINUTE_SECTIONS
  .map(s => ({ ...s, items: minuteItems(props.minute?.[s.key]) }))
  .filter(s => s.items.length))
const printedOn = minuteDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Gaza' }))

let restoreTitle: string | null = null
function cleanup() {
  window.removeEventListener('afterprint', cleanup)
  document.documentElement.classList.remove(PRINTING_CLASS)
  if (restoreTitle !== null) document.title = restoreTitle
  restoreTitle = null
  emit('done')
}

watch(() => props.minute, async (m) => {
  if (!m || !import.meta.client) return
  // تُرسم الورقةُ أوّلاً ثم تُطبع
  await nextTick()
  restoreTitle = document.title
  document.title = minutePdfTitle(m)
  document.documentElement.classList.add(PRINTING_CLASS)
  window.addEventListener('afterprint', cleanup)
  window.print()
})

onBeforeUnmount(() => {
  if (restoreTitle !== null) cleanup()
})
</script>

<template>
  <Teleport to="body">
    <article
      v-if="minute"
      class="print-sheet"
      dir="rtl"
      lang="ar"
    >
      <header class="ps-head">
        <img
          src="/brand/turjuman-full.svg"
          alt="ترجمان"
          class="ps-logo"
        >
        <div class="ps-kind">
          <span>محضر اجتماع</span>
          <span
            v-if="minute.status === 'draft'"
            class="ps-draft"
          >مسودّة — غير معتمَد</span>
        </div>
      </header>

      <h1 class="ps-title">
        {{ minute.title }}
      </h1>

      <dl class="ps-meta">
        <div>
          <dt>التاريخ</dt>
          <dd>{{ minuteDate(minute.meeting_date) }}</dd>
        </div>
        <div>
          <dt>الحاضرون</dt>
          <dd>{{ minute.attendee_ids.length }}</dd>
        </div>
        <div>
          <dt>الحالة</dt>
          <dd>{{ minute.status === 'final' ? 'معتمَد' : 'مسودّة' }}</dd>
        </div>
      </dl>

      <section
        v-if="attendees.length"
        class="ps-sec"
      >
        <h2 class="ps-h">
          الحاضرون
        </h2>
        <ul class="ps-att">
          <li
            v-for="a in attendees"
            :key="a.id"
          >
            <span class="ps-att-name">{{ a.full_name }}</span>
            <span class="ps-att-role">{{ roleLabel(a.role, a.gender) }}</span>
          </li>
        </ul>
      </section>

      <section
        v-for="s in sections"
        :key="s.key"
        class="ps-sec"
      >
        <h2 class="ps-h">
          {{ s.label }}
        </h2>
        <ol class="ps-list">
          <li
            v-for="(it, i) in s.items"
            :key="i"
          >
            {{ it }}
          </li>
        </ol>
      </section>

      <footer class="ps-foot">
        طُبع من منصّة ترجمان في {{ printedOn }}
      </footer>
    </article>
  </Teleport>
</template>

<style scoped>
.print-sheet { display: none; }

@page { size: A4; margin: 16mm 15mm 18mm; }

@media print {
  .print-sheet {
    display: block; color: var(--paper-ink); background: var(--paper);
    font-family: 'Lama Sans', 'IBM Plex Sans Arabic', sans-serif; font-size: 11pt; line-height: 1.75;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  .ps-head { display: flex; align-items: center; justify-content: space-between; gap: 12mm; padding-bottom: 5mm; border-bottom: 1.5pt solid var(--paper-accent); }
  .ps-logo { height: 15mm; width: auto; }
  .ps-kind { display: flex; flex-direction: column; align-items: flex-end; gap: 1.5mm; font-size: 10pt; font-weight: 600; color: var(--paper-ink-2); }
  .ps-draft { padding: .6mm 3mm; border-radius: 99pt; background: var(--paper-warn-bg); color: var(--paper-warn-ink); font-size: 9pt; }

  .ps-title { margin: 7mm 0 4mm; font-size: 19pt; font-weight: 600; line-height: 1.35; color: var(--paper-accent); text-wrap: balance; }

  .ps-meta { display: flex; gap: 0; margin: 0 0 7mm; border: .75pt solid var(--paper-line); border-radius: 3mm; overflow: hidden; }
  .ps-meta > div { flex: 1; padding: 2.5mm 4mm; }
  .ps-meta > div + div { border-inline-start: .75pt solid var(--paper-line); }
  .ps-meta dt { font-size: 8.5pt; color: var(--paper-ink-3); }
  .ps-meta dd { margin: 0; font-size: 11pt; font-weight: 600; font-variant-numeric: tabular-nums; }

  .ps-sec { margin-bottom: 6mm; }
  .ps-h { margin: 0 0 2.5mm; padding-bottom: 1.5mm; font-size: 12.5pt; font-weight: 600; color: var(--paper-accent); border-bottom: .75pt solid var(--paper-line); break-after: avoid; }

  .ps-att { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 8mm; margin: 0; padding: 0; list-style: none; }
  .ps-att li { display: flex; align-items: baseline; justify-content: space-between; gap: 3mm; padding: 1mm 0; border-bottom: .5pt dotted var(--paper-line); }
  .ps-att-name { font-weight: 500; }
  .ps-att-role { font-size: 9pt; color: var(--paper-ink-3); }

  /* البنودُ مرقّمة برقمٍ في دائرة، والسطرُ الطويل ينكسر تحت نصّه */
  .ps-list { counter-reset: item; margin: 0; padding: 0; list-style: none; }
  .ps-list li { counter-increment: item; position: relative; padding-block: 1.2mm; padding-inline: 9mm 0; break-inside: avoid; }
  .ps-list li::before {
    content: counter(item); position: absolute; inset-inline-start: 0; top: 1.9mm;
    width: 5.6mm; height: 5.6mm; border-radius: 50%; background: var(--paper-soft); color: var(--paper-accent);
    font-size: 8.5pt; font-weight: 600; line-height: 5.6mm; text-align: center; font-variant-numeric: tabular-nums;
  }

  .ps-foot { margin-top: 10mm; padding-top: 2.5mm; border-top: .5pt solid var(--paper-line); font-size: 8.5pt; color: var(--paper-ink-3); text-align: center; }
}
</style>
