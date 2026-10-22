<script setup lang="ts">
/**
 * لوحة المختبِر (طلب المستخدم 2026-10-22 — كان يُحوَّل إلى الاختبارات مباشرةً): ما المطلوب منه الآن (الاختباراتُ
 * المنتظرة رصدَه، ورحلاتُ الشهر)، وأرقامُ رصده هذا الشهر، وحلقاتُه بما ينتظر في كلٍّ. البياناتُ من `useExaminerDashboard`.
 */
import type { StatItem } from '~/components/ui/StatStrip.vue'
import type { TeacherAction } from '~/utils/teacherDashboard'
import { EXAM_MAX_TOTAL } from '~/constants/exams'

const { dash, pending } = useExaminerDashboard()
const d = computed(() => dash.value)

const actions = computed<TeacherAction[]>(() => {
  const v = d.value
  if (!v) return []
  const out: TeacherAction[] = []
  out.push(v.queue.count
    ? {
        key: 'grade', tone: v.queue.oldestDays >= 7 ? 'urgent' : 'todo', icon: 'i-lucide-clipboard-pen',
        title: v.queue.count === 1 ? 'اختبارٌ بانتظار رصدك' : `${v.queue.count} اختبارات بانتظار رصدك`,
        detail: v.queue.oldestDays ? `أقدمُها رُشّح منذ ${v.queue.oldestDays} ${v.queue.oldestDays === 1 ? 'يوم' : 'أيام'}` : 'رُشّحت اليوم',
        to: '/exams', cta: 'ارصد الآن'
      }
    : { key: 'grade', tone: 'done', icon: 'i-lucide-clipboard-check', title: 'لا اختبار بانتظار رصدك', to: '/exams' })
  out.push(v.trips.count
    ? { key: 'trips', tone: 'done', icon: 'i-lucide-bus', title: `${v.trips.count} ${v.trips.count === 1 ? 'رحلة' : 'رحلات'} مسجّلة هذا الشهر`, detail: v.trips.unpaid ? `غيرُ المسدَّد ${v.trips.unpaid}` : 'سُدّدت كلّها', to: '/transport' }
    : { key: 'trips', tone: 'todo', icon: 'i-lucide-bus', title: 'لم تسجّل رحلات مواصلات هذا الشهر', detail: 'سجّل رحلاتك ليُصرف بدلُها.', to: '/transport', cta: 'سجّل رحلة' })
  const order = { urgent: 0, todo: 1, done: 2 } as const
  return out.sort((a, b) => order[a.tone] - order[b.tone])
})

const stats = computed<StatItem[]>(() => {
  const v = d.value
  if (!v) return []
  return [
    { key: 'pending', icon: 'i-lucide-hourglass', tone: v.queue.count ? 'err' : 'neutral', value: v.queue.count, label: 'بانتظار الرصد' },
    { key: 'graded', icon: 'i-lucide-clipboard-check', value: v.month.graded, label: 'رُصد هذا الشهر' },
    { key: 'passed', icon: 'i-lucide-award', tone: 'green', value: v.month.passed, label: 'مجتازاً', ...(v.month.passPct !== null ? { sub: `${v.month.passPct}٪ من المحسوم` } : {}) },
    { key: 'avg', icon: 'i-lucide-gauge', value: v.month.avg === null ? '—' : String(v.month.avg), label: `متوسّط العلامة من ${EXAM_MAX_TOTAL}` }
  ]
})
</script>

<template>
  <div class="xh">
    <template v-if="pending && !d">
      <UiSkeletonBand :actions="0" />
      <UiSkeletonLines :fields="4" />
    </template>

    <template v-else-if="d">
      <div class="card head">
        <span class="h-ico"><UIcon
          name="i-lucide-award"
          class="size-6"
        /></span>
        <div class="h-info">
          <h2>{{ d.halqat.length ? `${d.halqat.length} ${d.halqat.length === 1 ? 'حلقة' : 'حلقات'} تختبر طلابها` : 'لا حلقات مسندةٌ إليك' }}</h2>
          <p>الاختبارُ والرصدُ من «الاختبارات»، والخطةُ من «خطة الاختبارات».</p>
        </div>
      </div>

      <DashboardTeacherActions :actions="actions" />

      <UiStatStrip
        :items="stats"
        label="أرقام رصدك"
      />

      <section
        v-if="d.byHalaqa.length"
        class="card sec"
      >
        <h3>حلقاتي</h3>
        <ul class="rows">
          <li
            v-for="h in d.byHalaqa"
            :key="h.id"
          >
            <NuxtLink
              :to="`/exams/students?h=${h.id}`"
              class="row"
            >
              <span class="row-main">
                <span class="row-title">{{ h.name }}</span>
                <span class="row-sub">المعلّم: {{ h.teacher }}</span>
              </span>
              <UBadge
                v-if="h.pending"
                :label="`${h.pending} بانتظار الرصد`"
                color="warning"
                variant="soft"
              />
              <span class="row-graded">رُصد هذا الشهر <b>{{ h.graded }}</b></span>
              <UIcon
                name="i-lucide-chevron-left"
                class="size-5 row-go"
              />
            </NuxtLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.xh { display: flex; flex-direction: column; gap: 18px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 20px 22px; }
.head { display: flex; align-items: center; gap: 14px; }
.h-ico { width: 48px; height: 48px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--blue-soft); color: var(--blue-ink); }
.h-info { min-width: 0; }
.h-info h2 { margin: 0; font-size: 19px; font-weight: 700; color: var(--ink); line-height: 1.4; }
.h-info p { margin: 4px 0 0; font-size: 14px; color: var(--ink-2); }
.sec h3 { margin: 0 0 8px; font-size: 17px; font-weight: 700; color: var(--ink); }
.rows { list-style: none; margin: 0; padding: 0; }
.rows li + li { border-top: 1px solid var(--line); }
.row { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 10px 4px; color: inherit; text-decoration: none; border-radius: 12px; }
.row:hover { background: var(--surface-2); }
.row:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.row-title { font-size: 15.5px; font-weight: 600; color: var(--ink); }
.row-sub { font-size: 13px; color: var(--ink-3); }
.row-graded { font-size: 13px; color: var(--ink-2); white-space: nowrap; }
.row-graded b { color: var(--ink); font-variant-numeric: tabular-nums; }
.row-go { color: var(--ink-3); }
@media (max-width: 560px) {
  .card { padding: 16px; }
  .row { flex-wrap: wrap; }
}
</style>
