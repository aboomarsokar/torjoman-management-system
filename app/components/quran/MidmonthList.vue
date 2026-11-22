<script setup lang="ts">
/**
 * قائمةُ الحلقات المسلِّمة لرصد المنتصف (طلب المستخدم 2026-11-21): الأضعفُ متوسّطاً أوّلاً، ولكلّ حلقةٍ تاريخُ التسليم
 * وعددُ الطلاب ومتوسّطُ صفحات الحفظ وشاراتُ المتأخّرين؛ وتنفتح لتُظهر أسماءَهم ومن لم يحفظ ومن لم يُرصد،
 * ومن اختُبر قبل التسليم فخُفّض حدُّه (`tested` — 2026-11-22).
 */
import type { MidRow } from '~/utils/quran/midmonth'
import { formatDay } from '~/utils/reportWindow'

/** «3 أجزاء» · «10 أجزاء». */
const partsCount = (n: number) => `${n} أجزاء`

defineProps<{ rows: MidRow[], threshold: number }>()
</script>

<template>
  <ul class="ml">
    <li
      v-for="r in rows"
      :key="r.id"
    >
      <details>
        <summary>
          <span class="ml-main">
            <b>{{ r.name }}</b>
            <small>{{ r.teacher ?? '—' }} · سُلّم <bdi dir="ltr">{{ formatDay(r.submittedAt) }}</bdi> · {{ r.students }} طالباً</small>
          </span>
          <span class="ml-avg">
            <b class="num">{{ r.avgPages }}</b>
            <small>متوسّط الصفحات</small>
          </span>
          <span class="ml-tags">
            <UBadge
              v-if="r.late.length"
              :label="`متأخّر ${r.late.length}`"
              color="warning"
              variant="soft"
            />
            <UBadge
              v-if="r.none.length"
              :label="`لم يحفظ ${r.none.length}`"
              color="error"
              variant="soft"
            />
            <UBadge
              v-if="r.unrecorded.length"
              :label="`لم يُرصد ${r.unrecorded.length}`"
              color="neutral"
              variant="soft"
            />
            <UBadge
              v-if="!r.late.length && !r.none.length && !r.unrecorded.length"
              label="على المسار"
              color="success"
              variant="soft"
            />
          </span>
        </summary>
        <div class="ml-body">
          <p v-if="r.late.length">
            <b>دون حدّه (نصفُ الهدف {{ threshold }} صفحة، أقلّ لمن اختُبر):</b> {{ r.late.join('، ') }}
          </p>
          <p v-if="r.none.length">
            <b>لم يحفظ جديداً:</b> {{ r.none.join('، ') }}
          </p>
          <p v-if="r.unrecorded.length">
            <b>لم يُرصد في المنتصف:</b> {{ r.unrecorded.join('، ') }}
          </p>
          <p v-if="r.tested.length">
            <b>اختُبر قبل التسليم فخُفّض حدُّه:</b> {{ r.tested.map(t => `${t.name} (${partsCount(t.parts)})`).join('، ') }}
          </p>
          <p v-if="!r.late.length && !r.none.length && !r.unrecorded.length">
            كلُّ الطلاب بلغوا حدَّهم في المنتصف أو تجاوزوه.
          </p>
        </div>
      </details>
    </li>
  </ul>
</template>

<style scoped>
.ml { list-style: none; margin: 0; padding: 0; }
.ml li { border-top: 1px solid var(--line); }
.ml li:first-child { border-top: none; }
summary { display: flex; align-items: center; gap: 10px 16px; flex-wrap: wrap; padding: 14px 4px; cursor: pointer; list-style: none; min-height: 44px; }
summary::-webkit-details-marker { display: none; }
.ml-main { flex: 1 1 220px; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ml-main b { font-size: 15.5px; color: var(--ink); }
.ml-main small, .ml-avg small { font-size: 13px; color: var(--ink-2); }
.ml-avg { display: flex; flex-direction: column; align-items: center; min-width: 84px; }
.ml-avg b { font-size: 18px; color: var(--ink); }
.num { font-variant-numeric: tabular-nums; }
.ml-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.ml-body { padding: 0 4px 14px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 1.8; color: var(--ink-2); }
.ml-body p { margin: 0; }
.ml-body b { color: var(--ink); }
</style>
