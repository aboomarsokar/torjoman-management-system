<script setup lang="ts">
/**
 * إحصائياتُ المدير الإداري ومشرف المشروع مفصولةً بين البنين والبنات (طلب المستخدم 2026-10-22): بطاقةٌ لكلّ فئة،
 * فيها القسمان متجاوران بعدديهما، وشريطُ نسبتهما (بياناتٌ لا زخرفة)، والمجموعُ في رأسها — فتُقارَن الفئةُ بنظرة.
 * كان العرضُ قسمين متتاليين، فيبعد الرقمُ عن نظيره. و`avg`: متوسّطٌ لا عدد — في الرأس المتوسّطُ العامّ بدل المجموع
 * (`total`)، وبلا شريط نسبة (المتوسّطان لا يُجمعان)، و«—» حين لا قيمة. `suffix` لاحقةٌ كـ«٪».
 */
export interface SplitItem {
  key: string
  icon: string
  /** اسمُ الفئة جامعاً («الطلاب والطالبات»). */
  label: string
  male: number | null
  female: number | null
  /** تسميتا القسمين داخل البطاقة («الطلاب» / «الطالبات»). */
  maleLabel: string
  femaleLabel: string
  /** متوسّطٌ لا عدد (انظر أعلاه). */
  avg?: boolean
  /** ما في الرأس للمتوسّط: المتوسّطُ العامّ. */
  total?: number | null
  suffix?: string
}

defineProps<{ items: SplitItem[] }>()

const pct = (part: number, total: number) => total ? Math.round((100 * part) / total) : 50
const sum = (it: SplitItem) => (it.male ?? 0) + (it.female ?? 0)
const show = (n: number | null | undefined, suffix = '') => n == null ? '—' : `${n}${suffix}`
const head = (it: SplitItem) => it.avg ? show(it.total, it.suffix) : String(sum(it))
</script>

<template>
  <ul
    class="gs"
    aria-label="الإحصائيات بين البنين والبنات"
  >
    <li
      v-for="it in items"
      :key="it.key"
      class="gs-card"
    >
      <div class="gs-head">
        <span class="gs-ico"><UIcon
          :name="it.icon"
          class="size-5"
        /></span>
        <span class="gs-label">{{ it.label }}</span>
        <span
          class="gs-total"
          :aria-label="`${it.avg ? 'المتوسّط العامّ' : 'المجموع'} ${head(it)}`"
        >{{ head(it) }}</span>
      </div>

      <div class="gs-split">
        <div class="gs-side m">
          <b>{{ show(it.male, it.suffix) }}</b>
          <span>{{ it.maleLabel }}</span>
        </div>
        <div class="gs-side f">
          <b>{{ show(it.female, it.suffix) }}</b>
          <span>{{ it.femaleLabel }}</span>
        </div>
      </div>

      <!-- لا عددَ في الفئة: شريطٌ رماديٌّ واحد — كان نصفين متساويين يوحيان بالتساوي -->
      <div
        v-if="!it.avg && sum(it) === 0"
        class="gs-bar empty"
        role="img"
        aria-label="لا أحد"
      >
        <i />
      </div>
      <div
        v-else-if="!it.avg"
        class="gs-bar"
        role="img"
        :aria-label="`${it.maleLabel} ${it.male}، ${it.femaleLabel} ${it.female}`"
      >
        <i
          class="m"
          :style="{ width: `${pct(it.male ?? 0, sum(it))}%` }"
        />
        <i
          class="f"
          :style="{ width: `${pct(it.female ?? 0, sum(it))}%` }"
        />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.gs { list-style: none; margin: 0 0 24px; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }
/* بطاقتان في السطر على الجوال (كبطاقات الأرقام الأخرى) */
@media (max-width: 620px) {
  .gs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .gs-card { padding: 12px; gap: 10px; }
  .gs-ico { width: 30px; height: 30px; border-radius: 9px; }
  .gs-label { font-size: 13px; }
  .gs-total { min-width: 26px; height: 24px; font-size: 12.5px; padding: 0 8px; }
  .gs-side b { font-size: 21px; }
  .gs-side + .gs-side { padding-inline-start: 10px; }
}
.gs-card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
.gs-head { display: flex; align-items: center; gap: 10px; }
.gs-ico { width: 36px; height: 36px; flex: none; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; background: var(--blue-soft); color: var(--blue-ink); }
.gs-label { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 600; color: var(--ink); }
.gs-total { min-width: 30px; height: 28px; padding: 0 10px; border-radius: 999px; background: var(--navy); color: #fff; font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }

.gs-split { display: grid; grid-template-columns: 1fr 1fr; }
.gs-side { display: flex; flex-direction: column; gap: 2px; padding-inline: 4px; }
.gs-side + .gs-side { border-inline-start: 1px solid var(--line); padding-inline-start: 14px; }
.gs-side b { font-size: 26px; line-height: 1.1; font-weight: 700; font-variant-numeric: tabular-nums; }
.gs-side span { font-size: 12.5px; color: var(--ink-2); }
.gs-side.m b { color: var(--navy); }
.gs-side.f b { color: var(--green-ink); }

.gs-bar { display: flex; gap: 3px; height: 8px; }
.gs-bar i { display: block; height: 100%; border-radius: 999px; min-width: 6px; }
.gs-bar i.m { background: var(--navy); }
.gs-bar i.f { background: var(--green); }
.gs-bar.empty i { width: 100%; background: var(--surface-2); }
</style>
