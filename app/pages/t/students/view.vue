<script setup lang="ts">
/**
 * ملفُّ الطالب للمعلّم بلا إنترنت (`/t/students/view?id=…` — البند 14، 2026-10-27): الشريطُ العلويّ كملفّه المتّصل،
 * و«هذا الشهر» (حضورُه من نسخة الحضور، وإنجازُه للشهرين من نسخة الإنجاز — وفيهما ما ينتظر الرفع)، ثمّ «بياناته»
 * كاملةً. «رحلته» (الاختبارات والمقرّرات وتاريخُ الشهور) والتعديلُ في الملفّ المتّصل `/students/[id]`.
 */
import type { OutboxEntry } from '~/utils/attendanceOutbox'
import { ATTENDANCE_QUEUE, QURAN_QUEUE } from '~/utils/offlineQueues'
import { positionLabel } from '~/utils/quran/screen'
import { overlayRecords, type QuranEntry } from '~/utils/quranOutbox'
import { gazaToday } from '~/utils/reportWindow'
import { buildStudentSections } from '~/utils/studentSections'
import { studentMonthAttendance } from '~/utils/studentsMirror'
import { formatHalaqaTime } from '~/utils/time'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const user = useSupabaseUser()
const id = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''))
const today = gazaToday()

const students = useStudentsMirror()
const attendance = useOfflineMirror()
const quran = useQuranMirror()
const uid = computed(() => students.mirror.value?.uid ?? user.value?.sub ?? null)
const attendanceQueue = useOfflineQueue<OutboxEntry>(ATTENDANCE_QUEUE, uid)
const quranQueue = useOfflineQueue<QuranEntry>(QURAN_QUEUE, uid)
const { online, blockIfOffline } = useOfflineNav()

const ready = ref(false)
onMounted(async () => {
  const me = user.value?.sub ?? null
  await Promise.all([
    students.loadLocal(me).catch(() => null),
    attendance.loadLocal(me).catch(() => null),
    quran.loadLocal(me, today).catch(() => [])
  ])
  ready.value = true
})

const student = computed(() => students.mirror.value?.students.find(s => s.id === id.value) ?? null)
useSeoMeta({ title: () => student.value ? `${student.value.full_name} — ترجمان` : 'ملف الطالب — ترجمان', robots: 'noindex' })

const halaqa = computed(() => students.mirror.value?.halaqa
  ? { name: students.mirror.value.halaqa.name, teacher: null, time: formatHalaqaTime(students.mirror.value.halaqa.daily_time) || null }
  : null)
const sections = computed(() => student.value ? buildStudentSections(student.value) : [])

// ── هذا الشهر ──
const monthAtt = computed(() => {
  const s = student.value
  if (!s) return null
  return studentMonthAttendance({
    studentId: s.id,
    enrollmentDate: s.enrollment_date,
    month: today.slice(0, 7),
    days: attendance.mirror.value?.days ?? {},
    queued: attendanceQueue.pending.value.filter(e => e.halaqaId === s.halaqa_id)
  })
})
const quranMonths = computed(() => {
  const s = student.value
  if (!s) return []
  return quran.months.value.filter(m => m.inputs).map((m) => {
    const entries = quranQueue.entries.value.filter(e => e.studentId === s.id && e.year === m.year && e.month === m.month)
    const rec = overlayRecords(m.inputs!.records, entries).find(r => r.student_id === s.id) ?? null
    const queued = entries.some(e => e.status === 'pending')
    const text = !rec
      ? 'لم يُرصد بعد'
      : rec.from_surah === null
        ? 'لم يحفظ جديداً'
        : `من ${positionLabel({ surah: rec.from_surah, ayah: rec.from_ayah! }, quran.reference.surahName)} إلى ${positionLabel(rec.to_surah === null ? null : { surah: rec.to_surah, ayah: rec.to_ayah! }, quran.reference.surahName)} · ${rec.pages_memorized} صفحة`
    return { key: m.key, label: `الشهر ${String(m.month).padStart(2, '0')}`, text, recorded: !!rec, queued }
  })
})
</script>

<template>
  <div class="sv">
    <NuxtLink
      to="/t/students"
      class="back"
    >
      <UIcon
        name="i-lucide-chevron-right"
        class="size-[18px]"
      />
      <span>عودة إلى الطلاب</span>
    </NuxtLink>

    <template v-if="!ready">
      <UiSkeletonBand :actions="0" />
      <UiSkeletonLines :fields="4" />
    </template>
    <UiEmptyState
      v-else-if="!student"
      icon="i-lucide-user-x"
      title="الطالب ليس على جهازك"
      description="افتح «الطلاب» مرّةً وأنت متّصل ليُحفظ طلابُ حلقتك."
    />

    <template v-else>
      <StudentBand
        :name="student.full_name"
        :status="student.status"
        :gender="student.gender"
        :halaqa="halaqa"
      >
        <template #avatar>
          <span class="face"><ProfileAvatar
            :name="student.full_name"
            :zoomable="false"
          /></span>
        </template>
      </StudentBand>

      <!-- هذا الشهر: من نُسخ الجهاز، وفيه ما ينتظر الرفع -->
      <section class="card month">
        <h3>هذا الشهر</h3>
        <div class="facts">
          <div class="fact">
            <span class="f-ico"><UIcon
              name="i-lucide-calendar-check"
              class="size-5"
            /></span>
            <div>
              <small>الحضور</small>
              <b v-if="monthAtt && monthAtt.held">حضر {{ monthAtt.held - monthAtt.absent }} من {{ monthAtt.held }} يوماً<template v-if="monthAtt.absent"> · غاب {{ monthAtt.absent }}</template></b>
              <b v-else>لا أيامَ مسجَّلة بعد</b>
            </div>
          </div>
          <div
            v-for="q in quranMonths"
            :key="q.key"
            class="fact"
          >
            <span class="f-ico green"><UIcon
              name="i-lucide-book-open-check"
              class="size-5"
            /></span>
            <div>
              <small>الإنجاز القرآني — {{ q.label }}</small>
              <b :class="{ muted: !q.recorded }">{{ q.text }}</b>
              <UBadge
                v-if="q.queued"
                label="على جهازك — بانتظار الرفع"
                color="warning"
                variant="subtle"
                icon="i-lucide-cloud-upload"
                class="mt-1"
              />
            </div>
          </div>
        </div>
      </section>

      <StudentDetailCards :sections="sections" />

      <!-- رحلتُه والتعديلُ في ملفّه المتّصل -->
      <NuxtLink
        :to="`/students/${student.id}`"
        class="card more"
        :class="{ 'needs-net': !online }"
        @click="blockIfOffline(`/students/${student.id}`, $event)"
      >
        <UIcon
          name="i-lucide-route"
          class="size-5"
        />
        <span>رحلتُه واختباراتُه وتعديلُ بياناته<small v-if="!online"> — تحتاج اتصالاً</small></span>
        <UIcon
          name="i-lucide-chevron-left"
          class="size-5 chev"
        />
      </NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.sv { display: flex; flex-direction: column; gap: 16px; }
.back { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; font-size: 14.5px; font-weight: 600; color: var(--ink-2); }
.back:hover { color: var(--ink); }
.face { width: 100%; height: 100%; border-radius: inherit; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 18px 20px; }
.month h3 { margin: 0 0 14px; font-size: 16px; font-weight: 700; color: var(--ink); }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
.fact { display: flex; align-items: flex-start; gap: 12px; }
.fact small { display: block; font-size: 13px; color: var(--ink-3); margin-bottom: 2px; }
.fact b { font-size: 15px; font-weight: 600; color: var(--ink); line-height: 1.6; }
.fact b.muted { color: var(--ink-3); }
.f-ico { width: 40px; height: 40px; flex: none; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: var(--blue-soft); color: var(--blue-ink); }
.f-ico.green { background: var(--green-soft); color: var(--green-ink); }
.more { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 20px; color: var(--ink); font-weight: 600; text-decoration: none; }
.more span { flex: 1; }
.more small { font-weight: 500; color: var(--ink-3); }
.more .chev { color: var(--ink-3); }
.more.needs-net { opacity: .55; }
</style>
