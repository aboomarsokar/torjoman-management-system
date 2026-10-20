<script setup lang="ts">
/**
 * صفحة الطالب «صفحتي» — للقراءة، إلا أربعةَ حقولٍ يعدّلها بنفسه من «بياناتي» (جوّاله وبريد وليّ أمره والسكن
 * وأقرب مسجد — StudentContactModal ← `update_my_contact()`)، في ثلاثة تبويبات (طلبُ المستخدم 2026-10-20):
 * - «لوحة التحكم»: أرقامُه الأساسية في نظرة — التقدّم، والحضور هذا الشهر، والاختبارات، والمحطّة القادمة، وحلقته.
 * - «رحلتي»: رحلتُه على دورات الاختبار وسجلُّ شهوره المعتمدة.
 * - «بياناتي»: بطاقاتُ بياناته (المصدرُ نفسه لملف الطالب الداخلي — StudentDetailCards).
 * التبويبُ في الرابط (`?tab=`) فيبقى بعد التحديث، والأولُ بلا معامل.
 * - الصورة الشخصية: الحرفُ الأول في الشريط هو زرُّ تغييرها (ProfilePhotoButton) — للطالب الذكر؛
 *   والطالبة بلا صورة — الحرفُ الأول ساكناً.
 * - كلمة المرور: الطالب يبدأ بكلمةٍ افتراضية (must_change_password) ويغيّرها من هنا — لا ملفّ وظيفيّاً له،
 *   و/profile/me تُحوّله إلى هذه الصفحة.
 * - من ليس طالباً يُعاد إلى لوحته.
 */
import type { Database } from '~/types/database.types'
import { displayPhotoPath } from '~/constants/profilePhoto'
import { buildStudentSections } from '~/utils/studentSections'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'صفحتي — ترجمان' })

type StudentRow = Database['public']['Tables']['students']['Row'] & {
  halaqa: { name: string, daily_time: string | null, teacher: { full_name: string } | null } | null
}

const supabase = useSupabaseClient<Database>()
const { profile, role, pending: profilePending, fetchProfile } = useProfile()
const { refresh: refreshMyPhoto } = useMyPhoto()

// العاملون لا صفحة طالب لهم — يعودون إلى لوحتهم متى عُرف الدور
watch(role, (r) => {
  if (r && r !== 'student') void navigateTo('/dashboard', { replace: true })
}, { immediate: true })

// جلب غير حاجز؛ يُعاد عند وصول الحساب. الربط صريحٌ بـuser_id (لا يُترك للـRLS وحده) كي لا يُقرأ غير صفّه.
const { data: me, pending, refresh: refreshMe } = useLazyAsyncData<StudentRow | null>(
  'my-student',
  async () => {
    const userId = profile.value?.id
    if (!userId) return null
    const { data, error } = await supabase
      .from('students')
      .select('*, halaqa:halaqa_id(name, daily_time, teacher:teacher_id(full_name))')
      .eq('user_id', userId)
      .maybeSingle<StudentRow>()
    if (error) console.error('[me] فشل جلب سجلّ الطالب:', error.message)
    return data
  },
  { server: false, default: () => null, watch: [() => profile.value?.id] }
)

// حضوري هذا الشهر: أيام حلقته وغياباتي (مسموحٌ لي بالسياسات)
const { attendance } = useMyAttendance(() => me.value ? { studentId: me.value.id, halaqaId: me.value.halaqa_id, enrollmentDate: me.value.enrollment_date } : null)

const loading = computed(() => profilePending.value || pending.value)
const sections = computed(() => me.value ? buildStudentSections(me.value) : [])
const halaqa = computed(() => me.value?.halaqa
  ? { name: me.value.halaqa.name, teacher: me.value.halaqa.teacher?.full_name ?? null, time: me.value.halaqa.daily_time?.slice(0, 5) ?? null }
  : null)

const photoPath = computed(() => displayPhotoPath(profile.value))

// التبويبات — في الرابط
type Tab = 'dashboard' | 'journey' | 'data'
const TABS: { key: Tab, label: string, icon: string }[] = [
  { key: 'dashboard', label: 'لوحة التحكم', icon: 'i-lucide-layout-dashboard' },
  { key: 'journey', label: 'رحلتي', icon: 'i-lucide-route' },
  { key: 'data', label: 'بياناتي', icon: 'i-lucide-id-card' }
]
const route = useRoute()
const router = useRouter()
const tab = computed<Tab>({
  get: () => TABS.find(t => t.key === route.query.tab)?.key ?? 'dashboard',
  set: (v) => {
    void router.replace({ query: { ...route.query, tab: v === 'dashboard' ? undefined : v } })
  }
})

const pwOpen = ref(false)
const contactOpen = ref(false)
const mustChangePassword = computed(() => profile.value?.must_change_password === true)
</script>

<template>
  <div class="me">
    <ClientOnly>
      <template v-if="loading">
        <UiSkeletonBand :actions="1" />
        <div class="grid-skel">
          <UiSkeletonLines :fields="6" />
          <UiSkeletonLines :fields="2" />
          <UiSkeletonLines :fields="2" />
          <UiSkeletonLines :fields="5" />
        </div>
      </template>
      <UiEmptyState
        v-else-if="!me || !profile"
        icon="i-lucide-user-x"
        title="لا يوجد سجلّ طالبٍ لحسابك"
        description="تواصل مع الإدارة إن كنت ترى أنّ هذا خطأ."
      />

      <template v-else>
        <!-- الشريط العلوي -->
        <div class="band">
          <div class="av">
            <ProfilePhotoButton
              :profile-id="profile.id"
              :name="me.full_name"
              :photo-path="photoPath"
              :gender="me.gender"
              @changed="refreshMyPhoto"
            />
          </div>
          <div class="band-info">
            <h1>{{ me.full_name }}</h1>
            <div class="band-sub">
              <UBadge
                :label="STUDENT_STATUS[me.status]?.label"
                :color="STUDENT_STATUS[me.status]?.color"
                variant="soft"
                class="band-badge"
              />
              <span>{{ me.halaqa?.name || 'بلا حلقة' }}</span>
              <span v-if="me.halaqa?.teacher?.full_name">المعلّم {{ me.halaqa.teacher.full_name }}</span>
              <span
                v-if="halaqa?.time"
                dir="ltr"
              >{{ halaqa.time }}</span>
            </div>
          </div>
          <div class="band-actions">
            <UButton
              label="تغيير كلمة المرور"
              icon="i-lucide-key-round"
              color="neutral"
              variant="ghost"
              size="md"
              block
              :ui="{ base: 'min-h-11 rounded-xl bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25 justify-center' }"
              @click="pwOpen = true"
            />
          </div>
        </div>

        <!-- تنبيه الكلمة الافتراضية -->
        <ProfilePasswordBanner
          v-if="mustChangePassword"
          @change="pwOpen = true"
        />

        <!-- التبويبات -->
        <div
          class="tabs"
          role="tablist"
          aria-label="أقسام صفحتي"
        >
          <button
            v-for="t in TABS"
            :id="`tab-${t.key}`"
            :key="t.key"
            type="button"
            role="tab"
            class="tab"
            :class="{ active: tab === t.key }"
            :aria-selected="tab === t.key"
            :aria-controls="`panel-${t.key}`"
            @click="tab = t.key"
          >
            <UIcon
              :name="t.icon"
              class="size-[18px]"
            />
            {{ t.label }}
          </button>
        </div>

        <div
          :id="`panel-${tab}`"
          role="tabpanel"
          :aria-labelledby="`tab-${tab}`"
        >
          <StudentDashboard
            v-if="tab === 'dashboard'"
            :student-id="me.id"
            :quran-parts="me.quran_parts"
            :enrollment-date="me.enrollment_date"
            :attendance="attendance"
            :halaqa="halaqa"
            @open="tab = $event"
          />
          <StudentJourneyCard
            v-else-if="tab === 'journey'"
            :student-id="me.id"
            :quran-parts="me.quran_parts"
            :enrollment-date="me.enrollment_date"
            own-records
            bare
          />
          <template v-else>
            <div class="edit-bar">
              <p>
                تستطيع تعديل جوالك وبريد وليّ أمرك والسكن وأقرب مسجد. وبقيّةُ بياناتك تعدّلها الإدارة — أخبر معلّمك إن وجدت فيها خطأً.
              </p>
              <UButton
                label="تعديل بيانات التواصل"
                icon="i-lucide-pencil"
                color="primary"
                class="min-h-11 shrink-0"
                :ui="{ base: 'rounded-xl font-semibold justify-center' }"
                @click="contactOpen = true"
              />
            </div>
            <StudentDetailCards :sections="sections" />
          </template>
        </div>

        <StudentContactModal
          v-model:open="contactOpen"
          :student="me"
          @saved="refreshMe"
        />
      </template>
    </ClientOnly>

    <ProfilePasswordModal
      v-if="profile"
      v-model:open="pwOpen"
      :profile-id="profile.id"
      @changed="fetchProfile"
    />
  </div>
</template>

<style scoped>
.band { background: var(--band); border-radius: 22px; padding: 26px 28px; box-shadow: var(--shadow-lg); margin-bottom: 20px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 20px; }
.av { width: 72px; height: 72px; border-radius: 20px; background: rgba(255, 255, 255, .16); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; flex: none; }
.band-info { min-width: 0; }
.band-info h1 { margin: 0; font-size: 25px; font-weight: 700; line-height: 1.35; color: #fff; text-wrap: balance; }
.band-sub { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-size: 14.5px; color: var(--band-sub); }
.band-sub > span + span::before { content: '·'; margin-inline-end: 14px; opacity: .7; }
.band-badge { margin-inline-end: 2px; }
.band-actions { display: flex; align-items: center; }

/* التبويبات: مقطّعٌ واحد — بعرض الشاشة على الجوال، وبقدر محتواه على الحاسوب */
.tabs { display: inline-flex; gap: 4px; padding: 5px; margin-bottom: 20px; background: var(--surface-3); border: 1px solid var(--line); border-radius: 16px; max-width: 100%; }
.tab { flex: 1 1 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 20px; border: none; border-radius: 12px; background: transparent; color: var(--ink-2); font: inherit; font-size: 14.5px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: background .15s, color .15s, box-shadow .15s; }
.tab:hover { color: var(--ink); }
.tab.active { background: var(--surface); color: var(--ink); box-shadow: var(--shadow); }
.tab:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }

.edit-bar { display: flex; align-items: center; justify-content: space-between; gap: 14px 20px; flex-wrap: wrap; background: var(--blue-soft); border: 1px solid var(--line); border-radius: 18px; padding: 14px 18px; margin-bottom: 20px; }
.edit-bar p { margin: 0; flex: 1 1 280px; font-size: 14px; line-height: 1.7; color: var(--ink-2); }

@media (max-width: 640px) {
  .edit-bar :deep(button) { width: 100%; }
  .band { grid-template-columns: auto minmax(0, 1fr); padding: 20px 18px; gap: 16px 14px; border-radius: 20px; }
  .av { width: 62px; height: 62px; border-radius: 18px; font-size: 24px; }
  .band-info h1 { font-size: 20px; }
  .band-sub { font-size: 13.5px; gap: 4px 10px; }
  .band-sub > span + span::before { margin-inline-end: 10px; }
  .band-actions { grid-column: 1 / -1; }
  .tabs { display: flex; width: 100%; }
  .tab { padding: 0 8px; gap: 6px; font-size: 14px; }
}

/* هيكل التحميل فقط — البطاقات الحقيقية في المكوّنات */
.grid-skel { columns: 2; column-gap: 22px; }
@media (max-width: 768px) { .grid-skel { columns: 1; } }
</style>
