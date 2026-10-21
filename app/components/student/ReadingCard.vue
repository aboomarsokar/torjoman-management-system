<script setup lang="ts">
/**
 * بطاقةُ البرامج المصاحبة في لوحة الطالب (له ولملفّه عند العاملين) — المقرّرُ المستحقّ:
 * · غلافُه زرُّ التنزيل نفسُه (طلب المستخدم)، بجانبه اسمُه وكتبُه وصفحاتُه ومسارُ المقرّرات (المجتاز/الحالي/القادم).
 * · الفعلُ الرئيسيّ للطالب «التقدّم للاختبار» (أو «أكمل الاختبار» لمحاولةٍ مفتوحة، أو تاريخُ الإعادة بعد الرسوب).
 * · التقدّمُ الزمنيّ (مقرّرٌ لكلّ شهر) شارةٌ في الرأس. البياناتُ من `useReadingPlan`.
 * التخطيطُ بحجم البطاقة لا الشاشة (container query): الغلافُ بجانب التفاصيل، والأفعالُ تحتها في الضيّق.
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
const { journey, settings, coverUrls } = useReadingPlan(() => ({ studentId: props.studentId, enrollmentDate: props.enrollmentDate }))
const { busy, download } = useReadingAdmin()

const lastResult = computed(() => {
  const due = journey.value.due
  const st = due ? journey.value.stations.find(s => s.unit.id === due.id) : null
  return st && st.attempts ? st.best : null
})
const cover = computed(() => {
  const due = journey.value.due
  return due?.pdfPath ? coverUrls.value[due.id] ?? null : null
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
    </div>

    <p
      v-if="!journey.total"
      class="muted"
    >
      لم تُضبط مقرّرات البرامج المصاحبة بعد.
    </p>

    <div
      v-else-if="journey.due"
      class="rc-body"
      :class="{ 'no-cover': !cover }"
    >
      <!-- الغلافُ زرُّ التنزيل -->
      <button
        v-if="cover"
        type="button"
        class="cover"
        :disabled="busy"
        :aria-label="`تنزيل ${journey.due.title} (PDF)`"
        @click="download(journey.due)"
      >
        <img
          :src="cover"
          alt=""
          class="cover-img"
          width="612"
          height="792"
          loading="lazy"
        >
        <span class="cover-tag">
          <UIcon
            :name="busy ? 'i-lucide-loader-circle' : 'i-lucide-download'"
            class="size-4"
            :class="{ 'animate-spin': busy }"
          />
          تنزيل PDF
        </span>
      </button>

      <div class="rc-info">
        <p class="rc-unit">
          {{ journey.due.title }}
        </p>
        <p class="rc-scope">
          {{ unitScope(journey.due) }}
        </p>
        <ol
          class="steps"
          :aria-label="`اجتاز ${journey.passedCount} من ${journey.total} مقرّرات`"
        >
          <li
            v-for="s in journey.stations"
            :key="s.unit.id"
            :class="s.status"
            :title="s.unit.title"
          />
        </ol>
        <p class="steps-label">
          المقرّر {{ journey.due.sort_order }} من {{ journey.total }} · اجتاز {{ journey.passedCount }}
        </p>
        <p
          v-if="lastResult !== null"
          class="rc-last"
        >
          آخرُ محاولة {{ lastResult }}٪ · النجاح {{ settings.reading_pass_mark }}٪
        </p>
      </div>

      <div class="rc-actions">
        <template v-if="self">
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
        </template>
        <p
          v-else-if="journey.retryOn"
          class="rc-wait"
        >
          رسب في آخر محاولة — يعيد ابتداءً من {{ isolateLtr(formatDay(journey.retryOn)) }}
        </p>
        <!-- بلا غلافٍ: زرُّ تنزيلٍ عاديّ -->
        <UButton
          v-if="journey.due.pdfPath && !cover"
          label="تنزيل المقرّر (PDF)"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          size="lg"
          :loading="busy"
          :ui="{ base: 'min-h-11 rounded-xl font-semibold justify-center' }"
          @click="download(journey.due)"
        />
        <p
          v-if="self"
          class="rc-hint"
        >
          {{ settings.reading_test_questions }} سؤالاً في {{ settings.reading_test_minutes }} دقيقة، والإعادةُ بعد {{ settings.reading_retry_days }} أيام من الرسوب.
        </p>
      </div>
    </div>

    <p
      v-else
      class="rc-done"
    >
      <UIcon
        name="i-lucide-party-popper"
        class="size-5"
      />
      أتمّ مقرّرات البرامج المصاحبة كلّها
    </p>
  </section>
</template>

<style scoped>
.rc { container-type: inline-size; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 20px 22px; }
.rc-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.rc-ico { width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--blue-soft); color: var(--blue-ink); }
h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--ink); }
.tag { margin-inline-start: auto; display: inline-flex; align-items: center; min-height: 26px; padding: 2px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
.tag.ok { background: var(--green-soft); color: var(--green-ink); }
.tag.info { background: var(--blue-soft); color: var(--blue-ink); }
.tag.err { background: var(--err-soft); color: var(--err); }

/* الغلافُ بجانب التفاصيل، والأفعالُ تحت التفاصيل */
.rc-body { display: grid; grid-template-columns: minmax(110px, 168px) minmax(0, 1fr); grid-template-areas: 'cover info' 'cover actions'; gap: 16px 20px; align-items: start; }
.rc-body.no-cover { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'info' 'actions'; }

.cover { grid-area: cover; position: relative; display: block; width: 100%; aspect-ratio: 612 / 792; padding: 0; border: none; border-radius: 12px; overflow: hidden; background: var(--surface-2); box-shadow: var(--shadow); cursor: pointer; transition: transform .25s cubic-bezier(.16, 1, .3, 1), box-shadow .25s cubic-bezier(.16, 1, .3, 1); }
.cover:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
.cover:active { transform: translateY(-1px); }
.cover:focus-visible { outline: 3px solid var(--blue); outline-offset: 3px; }
.cover:disabled { cursor: progress; }
.cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-tag { position: absolute; inset-inline: 8px; bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; border-radius: 9px; background: var(--primary); color: var(--on-primary); font-size: 13px; font-weight: 700; box-shadow: var(--shadow-lg); }

.rc-info { grid-area: info; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.rc-unit { margin: 0; font-size: 21px; font-weight: 800; line-height: 1.35; color: var(--ink); }
.rc-scope { margin: 0; font-size: 15px; color: var(--ink-2); line-height: 1.7; }
.steps { list-style: none; margin: 12px 0 0; padding: 0; display: flex; gap: 4px; max-width: 280px; }
.steps li { flex: 1; height: 6px; border-radius: 999px; background: var(--surface-3); }
.steps li.passed { background: var(--green); }
.steps li.due { background: var(--blue); }
.steps-label { margin: 6px 0 0; font-size: 13px; font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.rc-last { margin: 2px 0 0; font-size: 13px; color: var(--ink-3); }

.rc-actions { grid-area: actions; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.rc-wait { margin: 0; display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 600; color: var(--err); line-height: 1.6; }
.rc-hint { margin: 0; font-size: 13px; color: var(--ink-3); line-height: 1.6; }
.rc-done { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: var(--green-ink); }
.muted { margin: 0; font-size: 14px; color: var(--ink-3); }

/* بطاقةٌ ضيّقة (الجوال): الغلافُ صغيرٌ بجانب الاسم، والأفعالُ بعرض البطاقة تحتهما */
@container (max-width: 440px) {
  .rc-body { grid-template-columns: 104px minmax(0, 1fr); grid-template-areas: 'cover info' 'actions actions'; gap: 14px; }
  .rc-unit { font-size: 18px; }
  .rc-scope { font-size: 14px; }
  .cover-tag { inset-inline: 5px; bottom: 5px; min-height: 30px; font-size: 12px; }
  .rc-actions { align-items: stretch; }
}
@media (max-width: 560px) { .rc { padding: 16px; } }
</style>
