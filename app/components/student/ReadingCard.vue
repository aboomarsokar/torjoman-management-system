<script setup lang="ts">
/**
 * بطاقةُ «مقرّر القراءة» في لوحة الطالب (له ولملفّه عند العاملين): المقرّرُ المستحقّ وكتبُه وصفحاتُه، والمجتازُ
 * من المقرّرات، والتقدّمُ الزمنيّ (مقرّرٌ لكلّ شهر)، وللطالب زرُّ «التقدّم للاختبار» (أو «أكمل الاختبار» لمحاولةٍ
 * مفتوحة، أو تاريخُ الإعادة بعد الرسوب). البياناتُ من `useReadingPlan`.
 */
import { formatDay } from '~/utils/reportWindow'
import { unitScope } from '~/utils/reading'
import { isolateLtr } from '~/utils/transport'

interface Props {
  studentId: string
  enrollmentDate: string | null
  /** الطالبُ نفسه (يرى زرّ الاختبار). */
  self: boolean
  /** العنوان — «مقرّرك الحالي» في صفحة البرامج المصاحبة نفسها. */
  heading?: string
}

const props = withDefaults(defineProps<Props>(), { heading: 'البرامج المصاحبة' })
const { journey, settings } = useReadingPlan(() => ({ studentId: props.studentId, enrollmentDate: props.enrollmentDate }))
const { busy, download } = useReadingAdmin()

const lastResult = computed(() => {
  const due = journey.value.due
  const st = due ? journey.value.stations.find(s => s.unit.id === due.id) : null
  return st && st.attempts ? st.best : null
})

const PACE = {
  ahead: { label: 'متقدّم', cls: 'ok' },
  onTrack: { label: 'في المسار', cls: 'info' },
  behind: { label: 'متأخّر', cls: 'err' }
} as const
</script>

<template>
  <section
    class="rc"
    aria-labelledby="rc-title"
  >
    <div class="rc-head">
      <span class="rc-ico"><UIcon
        name="i-lucide-book-open-text"
        class="size-5"
      /></span>
      <h3 id="rc-title">
        {{ heading }}
      </h3>
      <span
        v-if="journey.pace"
        class="tag"
        :class="PACE[journey.pace].cls"
      >{{ PACE[journey.pace].label }}</span>
      <span class="rc-count">اجتاز {{ journey.passedCount }} من {{ journey.total }}</span>
    </div>

    <p
      v-if="!journey.total"
      class="muted"
    >
      لم تُضبط مقرّرات البرامج المصاحبة بعد.
    </p>

    <template v-else-if="journey.due">
      <div class="rc-unit">
        {{ journey.due.title }}
      </div>
      <div class="rc-scope">
        {{ unitScope(journey.due) }}
      </div>
      <div
        v-if="lastResult !== null"
        class="rc-last"
      >
        آخرُ محاولة: {{ lastResult }}٪ — النجاح من {{ settings.reading_pass_mark }}٪
      </div>

      <div
        v-if="journey.due.pdfPath"
        class="rc-btns"
      >
        <UButton
          label="تنزيل المقرّر (PDF)"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          size="lg"
          :loading="busy"
          :ui="{ base: 'min-h-11 rounded-xl font-semibold justify-center' }"
          @click="download(journey.due)"
        />
      </div>

      <div
        v-if="self"
        class="rc-action"
      >
        <UButton
          v-if="journey.canStart"
          to="/reading-test"
          :label="journey.open ? 'أكمل الاختبار' : 'التقدّم للاختبار'"
          icon="i-lucide-clipboard-pen"
          color="primary"
          size="lg"
          :ui="{ base: 'min-h-11 rounded-xl font-semibold justify-center' }"
        />
        <p
          v-else-if="journey.retryOn"
          class="rc-wait"
        >
          <UIcon
            name="i-lucide-clock"
            class="size-4"
          />
          تستطيع إعادة الاختبار ابتداءً من {{ isolateLtr(formatDay(journey.retryOn)) }}
        </p>
        <p class="rc-hint">
          {{ settings.reading_test_questions }} سؤالاً في {{ settings.reading_test_minutes }} دقيقة، والإعادةُ بعد {{ settings.reading_retry_days }} أيام من الرسوب.
        </p>
      </div>
      <p
        v-else-if="journey.retryOn"
        class="rc-wait"
      >
        رسب في آخر محاولة — يعيد ابتداءً من {{ isolateLtr(formatDay(journey.retryOn)) }}
      </p>
    </template>

    <p
      v-else
      class="rc-done"
    >
      أتمّ مقرّرات البرامج المصاحبة كلّها 🎉
    </p>
  </section>
</template>

<style scoped>
.rc { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 20px 22px; display: flex; flex-direction: column; gap: 6px; }
.rc-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.rc-ico { width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--blue-soft); color: var(--blue-ink); }
h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--ink); }
.rc-count { margin-inline-start: auto; font-size: 13.5px; color: var(--ink-2); font-weight: 600; }
.tag { display: inline-flex; align-items: center; min-height: 24px; padding: 2px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
.tag.ok { background: var(--green-soft); color: var(--green-ink); }
.tag.info { background: var(--blue-soft); color: var(--blue-ink); }
.tag.err { background: var(--err-soft); color: var(--err); }
.rc-unit { font-size: 19px; font-weight: 800; color: var(--ink); }
.rc-scope { font-size: 14.5px; color: var(--ink-2); line-height: 1.7; }
.rc-last { font-size: 13.5px; color: var(--ink-3); }
.rc-btns { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
.rc-action { margin-top: 10px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.rc-wait { margin: 0; display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 600; color: var(--err); }
.rc-hint { margin: 0; font-size: 13px; color: var(--ink-3); }
.rc-done { margin: 0; font-size: 15px; font-weight: 700; color: var(--green-ink); }
.muted { margin: 0; font-size: 14px; color: var(--ink-3); }

@media (max-width: 560px) {
  .rc { padding: 16px; }
  .rc-action { align-items: stretch; }
  .rc-btns > * { flex: 1 1 100%; }
}
</style>
