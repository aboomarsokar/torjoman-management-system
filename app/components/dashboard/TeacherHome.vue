<script setup lang="ts">
/**
 * لوحة المعلم — بسيطةٌ عن قصد (طلب المستخدم 2026-10-26: «لوحة التحكم ما يكون فيها تفاصيل كتير»، و«الأزرار الهامة في
 * مقدّمة الصفحة» كتطبيق الصحابة): بطاقةُ الحلقة (اسمُها وعددُها وموعدُها وتغييرُه) ← أزرارٌ عريضة (الحضورُ ممتلئاً، وغيرُه
 * هادئاً) ← «المطلوب منك» و«طلابٌ يحتاجون متابعتك» شريطان بعدديهما يُفتحان عند الضغط.
 * و«طلابٌ يحتاجون متابعتك» سطرٌ واحدٌ يُفتح عند الطلب. الأرقامُ والتفاصيلُ في صفحاتها. البياناتُ من `useTeacherDashboard`.
 */
import { formatAmount, isolateLtr } from '~/utils/transport'
import { formatDay, gazaToday } from '~/utils/reportWindow'
import { teacherActions } from '~/utils/teacherDashboard'
import { formatHalaqaTime } from '~/utils/time'
import { formatSavedAt } from '~/utils/offlineSnapshot'

// الشهورُ والتواريخ معزولةٌ لاتينيّاً: «10-2026» بعد كلامٍ عربيّ تنقلب «2026-10»
const day = (iso: string) => isolateLtr(formatDay(iso))

const { dash, pending, refresh, savedAt } = useTeacherDashboard()
// بلا إنترنت (2026-10-27): آخرُ نسخةٍ محفوظة بوقتها، وما لا يعمل بلا اتصالٍ يُعتَم ويقول ذلك عند ضغطه
const { online, needsNetwork, blockIfOffline } = useOfflineNav()
const savedTime = computed(() => (savedAt.value ? formatSavedAt(savedAt.value) : null))

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
  { to: '/t/quran', label: 'الإنجاز القرآني', icon: 'i-lucide-book-open-check', primary: false },
  { to: '/t/students', label: 'الطلاب', icon: 'i-lucide-graduation-cap', primary: false },
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
      <DashboardTeacherSkeleton />
    </template>

    <div
      v-else-if="noHalaqa"
      class="card placeholder"
    >
      لا توجد حلقة معيّنة لك بعد. تواصل مع الإدارة لإسناد حلقتك.
    </div>

    <template v-else-if="d">
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
          v-if="online"
          :halaqa-id="d.halaqa.id"
          :time="d.halaqa.daily_time"
          :female="d.halaqa.gender === 'female'"
          class="h-time"
          @changed="refresh"
        />
      </div>

      <p
        v-if="savedTime"
        class="saved"
      >
        <UIcon
          name="i-lucide-cloud-off"
          class="size-4"
        />آخرُ تحديثٍ <bdi>{{ savedTime }}</bdi> — يُحدَّث حين يعود الاتصال
      </p>

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
          :class="{ 'primary': q.primary, 'needs-net': needsNetwork(q.to) }"
          @click="blockIfOffline(q.to, $event)"
        >
          <UIcon
            :name="q.icon"
            class="size-6"
          />
          <span class="q-label">{{ q.label }}</span>
          <UIcon
            name="i-lucide-chevron-left"
            class="size-5 q-chev"
          />
        </NuxtLink>
      </nav>

      <!-- «المطلوب منك» و«طلاب يحتاجون متابعتك» متجاوران على الشاشة الكبيرة -->
      <div class="pair">
        <DashboardTeacherActions :actions="actions" />

        <!-- من يحتاج متابعةً: شريطٌ يُفتح عند الطلب، وقائمتُه في البطاقة نفسِها -->
        <section
          v-if="attentionCount"
          class="card att-box"
        >
          <button
            type="button"
            class="att-line"
            :aria-expanded="attentionOpen"
            @click="attentionOpen = !attentionOpen"
          >
            <span class="att-ico"><UIcon
              name="i-lucide-users-round"
              class="size-5"
            /></span>
            <span class="att-text">طلاب يحتاجون متابعتك</span>
            <span class="att-count">{{ attentionCount }}</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-5 att-chev"
              :class="{ open: attentionOpen }"
            />
          </button>
          <DashboardTeacherAttention
            v-if="attentionOpen"
            class="att-body"
            :absentees="d.absentees"
            :unrecorded="d.unrecorded"
            :show-unrecorded="showUnrecorded"
            :recording-label="d.recording.label"
            :eligible="d.eligible"
            :reading-behind="d.readingBehind"
          />
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* يملأ عرضَ المحتوى كسائر الصفحات (لقطة المستخدم 2026-10-27: كانت عموداً ضيّقاً إلى اليمين على الشاشة الكبيرة) */
.th { display: flex; flex-direction: column; gap: 16px; }
.pair { display: flex; flex-direction: column; gap: 16px; }
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
.q { display: flex; align-items: center; gap: 12px; min-height: 58px; padding: 0 18px; border-radius: 16px; background: var(--surface); border: 1.5px solid color-mix(in srgb, var(--blue) 35%, var(--line)); box-shadow: var(--shadow); color: var(--ink); font-size: 16.5px; font-weight: 700; text-decoration: none; transition: background-color .15s, transform .12s; }
.q:hover { background: var(--blue-soft); }
.q-label { flex: 1; }
.q-chev { color: var(--ink-3); }
.q.primary .q-chev { color: var(--on-primary); opacity: .8; }
.q.primary { background: var(--primary); border-color: var(--primary); color: var(--on-primary); min-height: 64px; font-size: 17.5px; box-shadow: var(--shadow); }
.q.primary:hover { background: var(--primary-hover); }
.q:active { transform: scale(.98); }
.q:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.q.needs-net { opacity: .5; }
.saved { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13.5px; font-weight: 600; color: var(--ink-3); }
.saved bdi { font-variant-numeric: tabular-nums; }

.att-box { padding: 14px 18px; }
.att-line { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 0; border: none; background: none; font: inherit; text-align: start; cursor: pointer; }
.att-line:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); border-radius: 10px; }
.att-body { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
.att-ico { width: 38px; height: 38px; border-radius: 11px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--err-soft); color: var(--err); }
.att-text { flex: 1; font-size: 16px; font-weight: 700; color: var(--ink); }
.att-count { min-width: 26px; height: 26px; padding: 0 8px; border-radius: 999px; background: var(--err); color: var(--on-primary); font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
.att-chev { color: var(--ink-3); transition: transform .15s; }
.att-chev.open { transform: rotate(180deg); }

/* الشاشةُ الكبيرة: الأزرارُ عمودان ثمّ أربعةٌ في صفّ، و«المطلوب» و«المتابعة» متجاوران */
@media (min-width: 900px) {
  .quick { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .q.primary { min-height: 58px; font-size: 16.5px; }
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
  /* لا متابعةَ: «المطلوب» يأخذ العرضَ كلَّه */
  .pair:has(> :only-child) { grid-template-columns: minmax(0, 1fr); }
}
@media (min-width: 1280px) {
  .quick { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .th { gap: 14px; }
  .card { padding: 16px; }
}
</style>
