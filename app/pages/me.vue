<script setup lang="ts">
/**
 * صفحة الطالب «صفحتي» — ملفّه ورحلته للقراءة فقط (لا أزرار تعديل)، وتُوسَّع لاحقاً بالحضور والإنجاز.
 * - البيانات من `students` حيث user_id = حساب الطالب (RLS يقصرها عليه)، وبطاقاتها ورحلتها
 *   هي نفسها مكوّنات ملف الطالب الداخلي (StudentDetailCards / StudentJourneyCard).
 * - الصورة الشخصية: يرفعها الطالب (الذكر) ويُزيلها بنفسه؛ والطالبة بلا حقلٍ ولا صورة — الحرف الأول دائماً.
 * - كلمة المرور: الطالب يبدأ بكلمةٍ افتراضية (must_change_password) ويغيّرها من هنا — لا ملفّ وظيفيّاً له،
 *   و/profile/me تُحوّله إلى هذه الصفحة.
 * - من ليس طالباً يُعاد إلى لوحته.
 */
import type { Database } from '~/types/database.types'
import { canHavePhoto, displayPhotoPath } from '~/constants/profilePhoto'
import { buildStudentSections } from '~/utils/studentSections'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'صفحتي — ترجمان' })

type StudentRow = Database['public']['Tables']['students']['Row'] & {
  halaqa: { name: string, daily_time: string | null, teacher: { full_name: string } | null } | null
}

const supabase = useSupabaseClient<Database>()
const { profile, role, pending: profilePending, fetchProfile } = useProfile()
const { url: myPhotoUrl, refresh: refreshMyPhoto } = useMyPhoto()
const { isStudent } = usePermissions()

// العاملون لا صفحة طالب لهم — يعودون إلى لوحتهم متى عُرف الدور
watch(role, (r) => {
  if (r && r !== 'student') void navigateTo('/dashboard', { replace: true })
}, { immediate: true })

// جلب غير حاجز؛ يُعاد عند وصول الحساب. الربط صريحٌ بـuser_id (لا يُترك للـRLS وحده) كي لا يُقرأ غير صفّه.
const { data: me, pending } = useLazyAsyncData<StudentRow | null>(
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

const loading = computed(() => profilePending.value || pending.value)
const sections = computed(() => me.value ? buildStudentSections(me.value) : [])

// الصورة: للذكر فقط (الحراسة مكرّرة هنا وفي displayPhotoPath وفي القاعدة)
const photoAllowed = computed(() => isStudent.value && canHavePhoto(me.value?.gender))
const photoUrl = computed(() => photoAllowed.value ? myPhotoUrl.value : null)
const photoPath = computed(() => displayPhotoPath(profile.value))

const pwOpen = ref(false)
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
            <ProfileAvatar
              :name="me.full_name"
              :photo-url="photoUrl"
            />
          </div>
          <div class="band-info">
            <div class="band-top">
              <h1>{{ me.full_name }}</h1>
              <UBadge
                :label="STUDENT_STATUS[me.status]?.label"
                :color="STUDENT_STATUS[me.status]?.color"
                variant="soft"
              />
            </div>
            <div class="band-sub">
              {{ me.halaqa?.name || 'بلا حلقة' }}
              <template v-if="me.halaqa?.teacher?.full_name">
                · المعلّم {{ me.halaqa.teacher.full_name }}
              </template>
              <template v-if="me.halaqa?.daily_time">
                · {{ me.halaqa.daily_time.slice(0, 5) }}
              </template>
            </div>
          </div>
          <div class="band-actions">
            <UButton
              label="تغيير كلمة المرور"
              icon="i-lucide-key-round"
              color="neutral"
              variant="ghost"
              size="md"
              :ui="{ base: 'min-h-11 rounded-xl bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25' }"
              @click="pwOpen = true"
            />
          </div>
        </div>

        <!-- تنبيه الكلمة الافتراضية -->
        <ProfilePasswordBanner
          v-if="mustChangePassword"
          @change="pwOpen = true"
        />

        <!-- الصورة الشخصية (اختيارية؛ لا تُعرض لطالبة) -->
        <section
          v-if="photoAllowed"
          class="photo-card"
        >
          <ProfilePhotoField
            :profile-id="profile.id"
            :name="me.full_name"
            :photo-path="photoPath"
            :gender="me.gender"
            @changed="refreshMyPhoto"
          />
        </section>

        <!-- بطاقات البيانات (للقراءة فقط) -->
        <StudentDetailCards :sections="sections" />

        <!-- الرحلة -->
        <StudentJourneyCard
          :student-id="me.id"
          :quran-parts="me.quran_parts"
          :enrollment-date="me.enrollment_date"
          own-records
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
.me { max-width: 1000px; margin: 0 auto; }

.band { background: var(--band); border-radius: 22px; padding: 28px 30px; box-shadow: var(--shadow-lg); margin-bottom: 24px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.av { width: 70px; height: 70px; border-radius: 20px; background: rgba(255, 255, 255, .16); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; flex: none; overflow: hidden; }
.band-info { min-width: 0; flex: 1; }
.band-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.band-top h1 { margin: 0; font-size: 25px; font-weight: 700; color: #fff; }
.band-sub { font-size: 15px; color: var(--band-sub); margin-top: 6px; }
.band-actions { display: flex; align-items: center; gap: 8px; flex: none; }

.photo-card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 18px 22px; margin-bottom: 22px; }

/* هيكل التحميل فقط — البطاقات الحقيقية في StudentDetailCards */
.grid-skel { columns: 2; column-gap: 22px; }
@media (max-width: 768px) { .grid-skel { columns: 1; } }
</style>
