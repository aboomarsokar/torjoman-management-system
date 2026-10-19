<script setup lang="ts">
/**
 * صفحة اطّلاع الطالب العامّة (§4.23) — للقراءة فقط، بلا حساب دخول.
 * تُفتح برابط يحوي view_token. تعرض حقولاً آمنة فقط (دون بيانات حسّاسة).
 */
import type { MonthHistoryItem } from '~/utils/quran/studentHistory'

definePageMeta({ layout: false })

const route = useRoute()
const token = computed(() => String(route.params.token))

type PublicStudent = {
  full_name: string
  status: string
  quran_parts: number | null
  tajweed_level: string | null
  enrollment_date: string | null
  halaqa: { name: string, daily_time: string | null, teacher: { full_name: string } | null } | null
  exam_plan: { id: number, parts_from: number, parts_to: number, stage_type: 'partial' | 'cumulative' }[]
  results: { exam_plan_id: number | null, passed: boolean | null, total_score: number | null }[]
  memorization_pages: number
  target_per_month: number
  quran_history: MonthHistoryItem[]
  juz_done: number
}

const { data: student, error } = await useFetch<PublicStudent>(`/api/public/student/${token.value}`)

useSeoMeta({
  title: () => student.value ? `${student.value.full_name} — ترجمان` : 'رابط الطالب — ترجمان',
  robots: 'noindex'
})

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === '') ? '—' : String(v)

const fields = computed(() => {
  const s = student.value
  if (!s) return []
  return [
    { label: 'الحلقة', value: dash(s.halaqa?.name) },
    { label: 'المعلّم', value: dash(s.halaqa?.teacher?.full_name) },
    { label: 'الوقت اليومي', value: s.halaqa?.daily_time ? s.halaqa.daily_time.slice(0, 5) : '—' },
    { label: 'الأجزاء المثبتة', value: s.quran_parts != null ? `${s.quran_parts} جزء` : '—' },
    { label: 'الأحكام (التجويد)', value: dash(s.tajweed_level) }
  ]
})
</script>

<template>
  <div class="pub">
    <header class="top">
      <img
        src="/brand/turjuman-full.svg"
        alt="ترجمان"
        class="logo"
      >
      <UButton
        :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
        color="neutral"
        variant="subtle"
        size="lg"
        square
        aria-label="تبديل الوضع"
        :ui="{ base: 'rounded-xl' }"
        @click="toggleTheme"
      />
    </header>

    <main class="wrap">
      <div
        v-if="error || !student"
        class="card err"
      >
        <UIcon
          name="i-lucide-link-2-off"
          class="size-9"
        />
        <h1>الرابط غير صحيح</h1>
        <p>قد يكون الرابط منتهياً أو أُعيد توليده. تواصل مع إدارة الحلقة للحصول على رابط جديد.</p>
      </div>

      <div
        v-else
        class="card"
      >
        <div class="head">
          <div class="av">
            {{ student.full_name.trim().charAt(0) || '؟' }}
          </div>
          <div>
            <h1>{{ student.full_name }}</h1>
            <UBadge
              :label="STUDENT_STATUS[student.status]?.label"
              :color="STUDENT_STATUS[student.status]?.color"
              variant="soft"
            />
          </div>
        </div>

        <dl class="fields">
          <div
            v-for="f in fields"
            :key="f.label"
            class="field"
          >
            <dt>{{ f.label }}</dt>
            <dd>{{ f.value }}</dd>
          </div>
        </dl>

        <p class="note">
          <UIcon
            name="i-lucide-eye"
            class="size-4"
          />
          صفحة اطّلاع للقراءة فقط — منصّة ترجمان القرآني.
        </p>
      </div>

      <div
        v-if="student"
        class="card journey-card"
      >
        <h2 class="jtitle">
          <UIcon
            name="i-lucide-route"
            class="size-5"
          />
          رحلة الطالب على خطة الاختبارات
        </h2>
        <StudentJourney
          :quran-parts="student.quran_parts"
          :plan="student.exam_plan"
          :results="student.results"
          :memorization-pages="student.memorization_pages"
          :target-per-month="student.target_per_month"
          :enrollment-date="student.enrollment_date"
        />
        <StudentQuranHistory
          :items="student.quran_history"
          :juz-done="student.juz_done"
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
.pub { min-height: 100vh; background: var(--bg); color: var(--ink); }
.top { max-width: 640px; margin: 0 auto; padding: 22px 20px; display: flex; align-items: center; justify-content: space-between; }
.logo { height: 56px; width: auto; filter: var(--logo-filter); }
.wrap { max-width: 640px; margin: 0 auto; padding: 10px 20px 48px; }

.card { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; box-shadow: var(--shadow-lg); padding: 28px; }
.err { text-align: center; color: var(--ink-2); display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 28px; }
.err h1 { margin: 0; font-size: 22px; font-weight: 700; color: var(--ink); }
.err p { margin: 0; font-size: 15px; line-height: 1.8; font-weight: 300; max-width: 380px; }

.head { display: flex; align-items: center; gap: 16px; padding-bottom: 22px; border-bottom: 1px solid var(--line); margin-bottom: 22px; }
.av { width: 64px; height: 64px; border-radius: 18px; background: var(--navy); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 700; flex: none; }
.head h1 { margin: 0 0 8px; font-size: 24px; font-weight: 700; color: var(--ink); }

.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 0; }
.field { background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 14px 15px; }
.field dt { font-size: 12px; color: var(--ink-3); margin-bottom: 7px; font-weight: 500; }
.field dd { margin: 0; font-size: 15.5px; font-weight: 700; color: var(--ink); }

.note { margin: 22px 0 0; display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--ink-3); }

.journey-card { margin-top: 18px; }
.jtitle { margin: 0 0 18px; font-size: 18px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 9px; }
</style>
