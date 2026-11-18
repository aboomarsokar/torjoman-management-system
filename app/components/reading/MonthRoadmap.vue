<script setup lang="ts">
/**
 * خارطةُ طريق الشهر (طلب المستخدم 2026-11-10): مقرّرُ الشهر أسبوعاً أسبوعاً — صفحاتٌ من كتاب أو محاضرةٌ مرئية —
 * للطالب والمعلم والإدارة. متابعةٌ لا اختبار: الاختبارُ شهريٌّ في آخر المقرّر. الافتراضيُّ مقرّرُ الشهر الجاري
 * (`monthUnit`) والأسبوعُ الجاري مميَّز؛ و`browse` يضيف قائمةً لتصفّح خارطة أيّ شهرٍ آخر (للعاملين).
 * وفي العرض الواسع (≥900px) تصير الأسابيعُ أعمدةً متجاورة. وأسبوعُ المحاضرة مميَّزٌ بلونٍ وشارة، وفي الرأس
 * شريطُ «في هذا الشهر محاضرتان» (2026-11-18) كي لا تفوت الطالبَ بين أسابيع القراءة.
 */
import { formatDuration, monthUnit, roadmapWeeks, unitMonthLabel, unitScope, unitVideos, videosPhrase, weekHasVideo, weekOfMonth, type ReadingItem } from '~/utils/reading'
import { gazaToday } from '~/utils/reportWindow'

interface Props {
  /** قائمةُ الأشهر لتصفّح خارطةٍ غير الجارية. */
  browse?: boolean
}
const props = defineProps<Props>()

const { units } = useReadingUnits()
const today = gazaToday()
const current = computed(() => monthUnit(units.value ?? [], today))
const picked = ref<number | null>(null)
const unit = computed(() => (units.value ?? []).find(u => u.id === picked.value) ?? current.value)
const isCurrentMonth = computed(() => !!unit.value && unit.value.id === current.value?.id)
const thisWeek = weekOfMonth(today)
const weeks = computed(() => unit.value ? roadmapWeeks(unit.value) : [])

const monthItems = computed(() => (units.value ?? []).map(u => ({
  value: u.id,
  label: `${unitMonthLabel(u.opensOn) || u.title} — ${u.title}`
})))
const pickedModel = computed<number | undefined>({
  get: () => unit.value?.id,
  set: (v) => {
    picked.value = v ?? null
  }
})

const WEEK_NAMES = ['الأوّل', 'الثاني', 'الثالث', 'الرابع', 'الخامس']
/** «صفقات رابحة · ص 89–105». */
const pagesText = (i: ReadingItem) => `${i.book ?? '—'} · ص ${i.page_from}–${i.page_to}`
const videoWord = (i: ReadingItem) => i.kind === 'clip' ? 'مقطع' : 'محاضرة'
const videos = computed(() => unit.value ? videosPhrase(unitVideos(unit.value)) : '')
const weekState = (w: number) => !isCurrentMonth.value ? '' : w === thisWeek ? 'now' : w < thisWeek ? 'past' : ''
</script>

<template>
  <section
    v-if="unit && weeks.length"
    class="mr"
    aria-labelledby="mr-title"
  >
    <header class="mr-head">
      <div class="mr-id">
        <h3 id="mr-title">
          <span class="ico"><UIcon
            name="i-lucide-map"
            class="size-5"
          /></span>
          خارطةُ {{ isCurrentMonth ? 'الشهر' : unitMonthLabel(unit.opensOn) || 'المقرّر' }}
        </h3>
        <p class="mr-sub">
          <b>{{ unit.title }}</b><template v-if="unit.opensOn">
            · {{ unitMonthLabel(unit.opensOn) }}
          </template> · {{ unitScope(unit) }}
        </p>
        <p
          v-if="videos"
          class="mr-vids"
        >
          <UIcon
            name="i-lucide-circle-play"
            class="size-4"
          />
          في {{ isCurrentMonth ? 'هذا الشهر' : 'هذا المقرّر' }} {{ videos }} — في أسابيعها المميّزة أدناه
        </p>
      </div>
      <UiSelect
        v-if="props.browse && monthItems.length > 1"
        v-model="pickedModel"
        :items="monthItems"
        size="lg"
        class="mr-pick"
        aria-label="شهر الخارطة"
        :ui="{ base: 'rounded-[12px] min-h-11' }"
      />
    </header>

    <ol class="mr-weeks">
      <li
        v-for="w in weeks"
        :key="w.week"
        class="mr-week"
        :class="[weekState(w.week), { vid: weekHasVideo(w.items) }]"
      >
        <div class="mr-wk">
          <span class="mr-wk-n">الأسبوع {{ WEEK_NAMES[w.week - 1] }}</span>
          <span
            v-if="weekState(w.week) === 'now'"
            class="mr-now"
          >{{ weekHasVideo(w.items) ? 'هذا الأسبوع: محاضرة' : 'هذا الأسبوع' }}</span>
          <span
            v-else-if="weekHasVideo(w.items)"
            class="mr-vid-tag"
          ><UIcon
            name="i-lucide-circle-play"
            class="size-3.5"
          />أسبوعُ محاضرة</span>
        </div>
        <ul class="mr-items">
          <li
            v-for="it in w.items"
            :key="`${w.week}-${it.sort_order}`"
            class="mr-item"
          >
            <template v-if="it.kind === 'pages'">
              <UIcon
                name="i-lucide-book-open"
                class="size-4 mr-ic"
              />
              <span class="mr-txt">{{ pagesText(it) }}</span>
            </template>
            <template v-else-if="it.kind === 'meeting'">
              <UIcon
                name="i-lucide-users"
                class="size-4 mr-ic meet"
              />
              <span class="mr-txt"><span>{{ it.title ?? 'لقاء علمي' }}</span></span>
            </template>
            <template v-else>
              <UIcon
                name="i-lucide-circle-play"
                class="size-4 mr-ic vid"
              />
              <span class="mr-txt">
                <span>{{ videoWord(it) }} «{{ it.title }}»</span>
                <small>{{ it.speaker }}<template v-if="it.durationSeconds"> · <span class="num">{{ formatDuration(it.durationSeconds) }}</span></template></small>
              </span>
              <UButton
                v-if="it.url"
                :to="it.url"
                target="_blank"
                rel="noopener"
                label="شاهد"
                icon="i-lucide-play"
                color="primary"
                variant="soft"
                size="sm"
                class="mr-watch"
                :ui="{ base: 'rounded-[10px] min-h-9' }"
              />
              <span
                v-else
                class="mr-soon"
              >الرابطُ قريباً</span>
            </template>
          </li>
        </ul>
      </li>
    </ol>
    <p class="mr-note">
      خارطةٌ للمتابعة؛ والاختبارُ شهريٌّ في آخر المقرّر.
    </p>
  </section>
</template>

<style scoped>
.mr { container-type: inline-size; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 24px; box-shadow: var(--shadow); margin-top: 22px; }
.mr-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px 16px; flex-wrap: wrap; margin-bottom: 14px; }
.mr-id { min-width: 0; flex: 1 1 260px; }
h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 10px; }
.ico { width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--blue-soft); color: var(--blue-ink); }
.mr-sub { margin: 8px 0 0; font-size: 13.5px; color: var(--ink-2); line-height: 1.6; }
.mr-sub b { color: var(--ink); font-weight: 600; }
.mr-pick { width: 280px; max-width: 100%; }

.mr-weeks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.mr-week { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 6px 16px; padding: 12px 10px; border-top: 1px solid var(--line); border-radius: 12px; }
.mr-week:first-child { border-top: none; }
.mr-week.vid { background: var(--green-soft); border-top-color: transparent; }
.mr-week.vid + .mr-week { border-top-color: transparent; }
.mr-week.now { background: var(--blue-soft); border-top-color: transparent; }
.mr-week.now + .mr-week { border-top-color: transparent; }
.mr-week.past .mr-wk-n, .mr-week.past .mr-txt { color: var(--ink-3); }
.mr-wk { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.mr-wk-n { font-size: 14px; font-weight: 600; color: var(--ink); }
.mr-vids { display: inline-flex; align-items: center; gap: 6px; margin: 10px 0 0; padding: 5px 12px; border-radius: 999px; background: var(--green-soft); color: var(--green-ink); font-size: 13.5px; font-weight: 600; }
.mr-vid-tag { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 9px; border-radius: 999px; background: var(--surface); color: var(--green-ink); border: 1px solid color-mix(in srgb, var(--green) 45%, transparent); font-size: 12px; font-weight: 600; }
.mr-now { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 999px; background: var(--blue); color: var(--surface); font-size: 12px; font-weight: 600; }
.mr-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.mr-item { display: flex; align-items: center; gap: 8px; min-height: 28px; }
.mr-ic { flex: none; color: var(--ink-3); }
.mr-ic.vid { color: var(--blue-ink); }
.mr-ic.meet { color: var(--navy); }
.mr-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 14.5px; color: var(--ink); line-height: 1.5; }
.mr-txt small { font-size: 12.5px; color: var(--ink-2); }
.num { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }
.mr-watch { flex: none; }
.mr-soon { flex: none; font-size: 12.5px; color: var(--ink-3); }
.mr-note { margin: 12px 0 0; font-size: 12.5px; color: var(--ink-3); }

/* بعرض الصفحة: الأسابيعُ أعمدةٌ متجاورة كخطٍّ زمنيّ للشهر (2026-11-11) */
@container (min-width: 900px) {
  .mr-weeks { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 12px; }
  .mr-week { grid-template-columns: minmax(0, 1fr); align-content: start; gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: 14px; }
  .mr-week:first-child { border-top: 1px solid var(--line); }
  .mr-week.vid { border-color: color-mix(in srgb, var(--green) 55%, var(--line)); }
  .mr-week.now { border-color: var(--blue); }
  .mr-week.now + .mr-week { border-top-color: var(--line); }
  .mr-wk { flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
  .mr-week.now .mr-wk { border-bottom-color: color-mix(in srgb, var(--blue) 30%, transparent); }
  .mr-items { gap: 12px; }
  .mr-item { align-items: flex-start; flex-wrap: wrap; }
  .mr-ic { margin-top: 3px; }
  .mr-watch, .mr-soon { margin-inline-start: 24px; }
}
@media (max-width: 640px) { .mr { padding: 18px; } }
@container (max-width: 520px) {
  .mr-week { grid-template-columns: minmax(0, 1fr); }
  .mr-wk { flex-direction: row; align-items: center; gap: 8px; }
  .mr-pick { width: 100%; }
}
</style>
