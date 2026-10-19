<script setup lang="ts">
/**
 * لوحة التكريم (§4.17د/§4.24) — أعلى الطلاب عبر كل الحلقات من التقارير المعتمدة،
 * مرتّبين بدرجة الطالب (60/20/20). تظهر للمراجِعين (مدير/جودة).
 */
import type { Database } from '~/types/database.types'
import { computeStudentGrade, gradeLabel } from '~/composables/useGrades'

const supabase = useSupabaseClient<Database>()
const { settings, loadSettings } = useGrades()

type Row = {
  memorization_pages: number | null
  review_pages: number | null
  absence_unexcused: number
  student: { full_name: string, halaqa: { name: string } | null } | null
  report: { status: string } | null
}

const { data: top, pending } = useLazyAsyncData('honors-board', async () => {
  await loadSettings()
  const { data } = await supabase
    .from('monthly_report_students')
    .select('memorization_pages, review_pages, absence_unexcused, student:student_id(full_name, halaqa:halaqa_id(name)), report:report_id(status)')
    .returns<Row[]>()
  const ranked = (data ?? [])
    .filter(r => r.report?.status === 'approved' && r.student)
    .map((r) => {
      const g = computeStudentGrade({
        memoPages: r.memorization_pages ?? 0,
        reviewPages: r.review_pages ?? 0,
        absenceUnexcused: r.absence_unexcused ?? 0
      }, settings.value)
      return { name: r.student!.full_name, halqa: r.student!.halaqa?.name ?? '—', total: g.total }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
  return ranked
}, { server: false, default: () => [] })

const medals = ['🥇', '🥈', '🥉']
</script>

<template>
  <ClientOnly>
    <div
      v-if="!pending && top && top.length"
      class="card honors"
    >
      <h3>
        <UIcon
          name="i-lucide-trophy"
          class="size-5"
        />
        لوحة التكريم
      </h3>
      <ol class="list">
        <li
          v-for="(s, i) in top"
          :key="i"
          class="row"
          :class="{ podium: i < 3 }"
        >
          <span class="rank">{{ medals[i] || (i + 1) }}</span>
          <div class="who">
            <span class="name">{{ s.name }}</span>
            <span class="halqa">{{ s.halqa }}</span>
          </div>
          <div class="score">
            <span class="num">{{ s.total }}</span>
            <span class="lbl">{{ gradeLabel(s.total) }}</span>
          </div>
        </li>
      </ol>
    </div>
  </ClientOnly>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 20px 22px; margin-bottom: 18px; }
.honors h3 { margin: 0 0 14px; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 9px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 14px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); }
.row.podium { background: var(--green-soft); }
.rank { width: 28px; text-align: center; font-size: 17px; font-weight: 700; color: var(--ink-2); flex: none; }
.who { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.name { font-weight: 600; color: var(--ink); }
.halqa { font-size: 12.5px; color: var(--ink-3); }
.score { display: flex; align-items: baseline; gap: 8px; flex: none; }
.score .num { font-size: 20px; font-weight: 700; color: var(--green-ink); font-variant-numeric: tabular-nums; }
.score .lbl { font-size: 12.5px; color: var(--ink-3); }
</style>
