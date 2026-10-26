<script setup lang="ts">
/**
 * لوحة المعلم — بسيطةٌ عن قصد (طلب المستخدم 2026-10-26: «لوحة التحكم ما يكون فيها تفاصيل كتير»، و«الأزرار الهامة في
 * مقدّمة الصفحة» كتطبيق الصحابة): أزرارٌ عريضةٌ أوّلاً (الحضورُ ممتلئاً، وغيرُه هادئاً) ← «المطلوب منك» المعلّقُ وحده ←
 * سطرُ الحلقة (اسمُها وعددُها وموعدُها وتغييرُه).
 * و«طلابٌ يحتاجون متابعتك» سطرٌ واحدٌ يُفتح عند الطلب. الأرقامُ والتفاصيلُ في صفحاتها. البياناتُ من `useTeacherDashboard`.
 */
import { formatAmount, isolateLtr } from '~/utils/transport'
import { formatDay, gazaToday } from '~/utils/reportWindow'
import { teacherActions } from '~/utils/teacherDashboard'
import { formatHalaqaTime } from '~/utils/time'

// الشهورُ والتواريخ معزولةٌ لاتينيّاً: «10-2026» بعد كلامٍ عربيّ تنقلب «2026-10»
const day = (iso: string) => isolateLtr(formatDay(iso))

const { dash, pending, refresh } = useTeacherDashboard()

const d = computed(() => (dash.value && dash.value.halaqa ? dash.value : null))
const noHalaqa = computed(() => !pending.value && dash.value?.halaqa === null)

const actions = computed(() => d.value
  ? teacherActions({
      today: gazaToday(),
      todayAttendance: d.value.today,
      recording: d.value.recording,
      recordedCount: d.value.recordedCount,
      studentCount: d.value.studentCount,
      incentive: d.value.incentive,
      newAlerts: d.value.newAlerts,
      money: (n: number) => isolateLtr(formatAmount(n)),
      day
    })
  : [])

/** أكثرُ الشاشات استعمالاً — أزرارٌ كبيرةٌ تُضغط بالإبهام، وبقيّتُها في القائمة. */
const QUICK = [
  { to: '/t', label: 'تسجيل الحضور', icon: 'i-lucide-calendar-check', primary: true },
  { to: '/reports', label: 'الإنجاز القرآني', icon: 'i-lucide-book-open-check', primary: false },
  { to: '/students', label: 'الطلاب', icon: 'i-lucide-graduation-cap', primary: false },
  { to: '/my-booklets', label: 'الملازم', icon: 'i-lucide-book-copy', primary: false }
] as const

const showUnrecorded = computed(() => !!d.value && ['none', 'draft', 'returned'].includes(d.value.recording.state))
/** من يحتاج متابعةً (بلا تكرار من في أكثر من قائمة) — سطرٌ واحدٌ يُفتح عند الطلب. */
const attentionCount = computed(() => {
  const v = d.value
  if (!v) return 0
  const ids = new Set([...v.absentees, ...(showUnrecorded.value ? v.unrecorded : []), ...v.eligible, ...v.readingBehind].map(p => p.id))
  return ids.size
})
const attentionOpen = ref(false)
</script>

<template>
  <div class="th">
    <template v-if="pending && !d">
      <UiSkeletonBand :actions="0" />
      <UiSkeletonLines :fields="4" />
    </template>

    <div
      v-else-if="noHalaqa"
      class="card placeholder"
    >
      لا توجد حلقة معيّنة لك بعد. تواصل مع الإدارة لإسناد حلقتك.
    </div>

    <template v-else-if="d">
      <!-- أكثرُ الشاشات استعمالاً -->
      <nav
        class="quick"
        aria-label="الوصول السريع"
      >
        <NuxtLink
          v-for="q in QUICK"
          :key="q.to"
          :to="q.to"
          class="q"
          :class="{ primary: q.primary }"
        >
          <UIcon
            :name="q.icon"
            class="size-6"
          />
          <span>{{ q.label }}</span>
        </NuxtLink>
      </nav>

      <DashboardTeacherActions :actions="actions" />

      <!-- سطرُ الحلقة -->
      <div class="card head">
        <span class="h-ico"><UIcon
          name="i-lucide-book-open"
          class="size-6"
        /></span>
        <div class="h-info">
          <h2>{{ d.halaqa.name }}</h2>
          <p>
            {{ d.studentCount }} طالب<template v-if="d.halaqa.daily_time">
              · الموعد {{ formatHalaqaTime(d.halaqa.daily_time) }}
            </template>
          </p>
        </div>
        <!-- المعلّمُ يغيّر موعدَ حلقته وتُشعَر الإدارة (2026-10-25) -->
        <DashboardHalaqaTimeEdit
          :halaqa-id="d.halaqa.id"
          :time="d.halaqa.daily_time"
          :female="d.halaqa.gender === 'female'"
          class="h-time"
          @changed="refresh"
        />
      </div>

      <!-- من يحتاج متابعةً: سطرٌ واحدٌ يُفتح عند الطلب -->
      <button
        v-if="attentionCount"
        type="button"
        class="card att-line"
        :aria-expanded="attentionOpen"
        @click="attentionOpen = !attentionOpen"
      >
        <span class="att-ico"><UIcon
          name="i-lucide-users-round"
          class="size-5"
        /></span>
        <span class="att-text"><b>{{ attentionCount }}</b> {{ attentionCount === 1 ? 'طالبٌ يحتاج' : attentionCount === 2 ? 'طالبان يحتاجان' : 'طلاب يحتاجون' }} متابعتك</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-5 att-chev"
          :class="{ open: attentionOpen }"
        />
      </button>
      <DashboardTeacherAttention
        v-if="attentionOpen"
        :absentees="d.absentees"
        :unrecorded="d.unrecorded"
        :show-unrecorded="showUnrecorded"
        :recording-label="d.recording.label"
        :eligible="d.eligible"
        :reading-behind="d.readingBehind"
      />
    </template>
  </div>
</template>

<style scoped>
.th { display: flex; flex-direction: column; gap: 16px; max-width: 760px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 18px 20px; }
.placeholder { font-size: 15px; color: var(--ink-2); }
.head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.h-ico { width: 48px; height: 48px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--blue-soft); color: var(--blue-ink); }
.h-info { min-width: 0; flex: 1 1 220px; }
/* زرُّ الموعد يأخذ سطرَه تحت الاسم حين يضيق العرض — كان يعصر الاسمَ عموداً كلمةً كلمة (لقطة المستخدم 2026-10-26) */
.h-time { margin-inline-start: auto; }
.h-info h2 { margin: 0; font-size: 19px; font-weight: 700; color: var(--ink); line-height: 1.4; }
.h-info p { margin: 4px 0 0; font-size: 14px; color: var(--ink-2); }

.quick { display: flex; flex-direction: column; gap: 10px; }
.q { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 58px; padding: 0 16px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink); font-size: 16.5px; font-weight: 700; text-decoration: none; transition: background-color .15s, transform .12s; }
.q:hover { background: var(--surface-3); }
.q.primary { background: var(--primary); border-color: var(--primary); color: var(--on-primary); min-height: 64px; font-size: 17.5px; box-shadow: var(--shadow); }
.q.primary:hover { background: var(--primary-hover); }
.q:active { transform: scale(.98); }
.q:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }

.att-line { display: flex; align-items: center; gap: 12px; width: 100%; font: inherit; text-align: start; cursor: pointer; padding: 14px 18px; }
.att-ico { width: 38px; height: 38px; border-radius: 11px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--err-soft); color: var(--err); }
.att-text { flex: 1; font-size: 15px; font-weight: 600; color: var(--ink); }
.att-text b { font-variant-numeric: tabular-nums; }
.att-chev { color: var(--ink-3); transition: transform .15s; }
.att-chev.open { transform: rotate(180deg); }

@media (max-width: 560px) {
  .th { gap: 14px; }
  .card { padding: 16px; }
}
</style>
