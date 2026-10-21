<script setup lang="ts">
/**
 * ملف الطالب (§4.23) عند العاملين — **بشكل «صفحتي» نفسه** (طلبُ المستخدم 2026-10-20): الشريطُ العلويّ
 * والتبويباتُ الثلاثة («لوحة التحكم» و«رحلته» و«بياناته») مكوّناتٌ مشتركة مع `/me`، والقراءةُ بسياسات
 * العامل لا بدوالّ الطالب (`self = false`).
 * الصورة الشخصية تُعرض من حساب الطالب، ولا صورة لطالبة.
 * نسخُ رابط الاطّلاع لمن يعمل على الطالب، وإعادةُ توليده وحسابُ الدخول (إعادة تعيين الكلمة وتعطيل الدخول)
 * للمدير الإداري وحده — StudentAccountActions في تبويب «بياناته».
 */
import type { Database } from '~/types/database.types'
import { canHavePhoto, displayPhotoPath } from '~/constants/profilePhoto'
import { buildStudentSections } from '~/utils/studentSections'

definePageMeta({ layout: 'dashboard' })

type StudentRow = Database['public']['Tables']['students']['Row'] & {
  halaqa: { name: string, daily_time: string | null, teacher: { full_name: string } | null } | null
}

const route = useRoute()
const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()
const id = computed(() => String(route.params.id))
const { isAdmin, canAssign, isTeacher, isReadOnly } = usePermissions()
/** نسخ رابط الاطّلاع لمن يعمل على الطالب؛ وإعادة توليده للمدير الإداري وحده (view_token محميّ في القاعدة). */
const canManage = computed(() => !isReadOnly.value && (canAssign.value || isTeacher.value))

// جلب غير حاجز (useLazyAsyncData): الاستعلامات الأربعة مستقلّة وتعمل بالتوازي تلقائياً
const { data: student, pending, refresh } = useLazyAsyncData<StudentRow | null>(
  () => `student-${id.value}`,
  async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*, halaqa:halaqa_id(name, daily_time, teacher:teacher_id(full_name))')
      .eq('id', id.value)
      .single<StudentRow>()
    if (error) {
      console.error('[student] فشل الجلب:', error.message)
      return null
    }
    return data
  },
  { server: false, default: () => null }
)

useSeoMeta({ title: () => student.value ? `${student.value.full_name} — ترجمان` : 'ملف الطالب — ترجمان' })

// الصورة الشخصية على حساب الطالب (profiles عبر user_id) — ولا صورة لطالبة: الحرف الأول دائماً
const { prime: primePhoto, urlFor: photoUrlFor } = useProfilePhotoUrls()
const { data: accountPhotoPath } = useLazyAsyncData<string | null>(
  () => `student-photo-${id.value}`,
  async () => {
    const s = student.value
    if (!s?.user_id || !canHavePhoto(s.gender)) return null
    const { data } = await supabase.from('profiles').select('photo_path').eq('id', s.user_id).maybeSingle()
    return data?.photo_path ?? null
  },
  { server: false, default: () => null, watch: [student] }
)
const photoPath = computed(() => displayPhotoPath({ gender: student.value?.gender, photo_path: accountPhotoPath.value }))
watch(photoPath, path => void primePhoto([path]), { immediate: true })
const photoUrl = computed(() => photoUrlFor(photoPath.value))

// رابط الاطّلاع العام (للقراءة فقط)
function copyLink() {
  if (!student.value) return
  navigator.clipboard.writeText(`${window.location.origin}/s/${student.value.view_token}`)
  toast.add({ title: 'تم نسخ رابط الاطّلاع.', color: 'success', icon: 'i-lucide-copy-check' })
}
const regenerating = ref(false)
async function regenerateLink() {
  if (!student.value) return
  regenerating.value = true
  try {
    const { error } = await supabase.from('students').update({ view_token: crypto.randomUUID() }).eq('id', student.value.id)
    if (error) throw error
    await refresh()
    toast.add({ title: 'أُعيد توليد الرابط — القديم لم يعد صالحاً.', color: 'success', icon: 'i-lucide-refresh-cw' })
  } catch (err) {
    handle(err)
  } finally {
    regenerating.value = false
  }
}

const sections = computed(() => student.value ? buildStudentSections(student.value) : [])
const halaqa = computed(() => student.value?.halaqa
  ? { name: student.value.halaqa.name, teacher: student.value.halaqa.teacher?.full_name ?? null, time: formatHalaqaTime(student.value.halaqa.daily_time) || null }
  : null)

// حضورُه هذا الشهر (أيامُ حلقته وغياباتُه — مقروءةٌ للعامل في نطاقه)
const { attendance } = useMyAttendance(() => student.value
  ? { studentId: student.value.id, halaqaId: student.value.halaqa_id, enrollmentDate: student.value.enrollment_date }
  : null)

const tab = useStudentTab()
</script>

<template>
  <div class="sp">
    <NuxtLink
      to="/students"
      class="back"
    >
      <UIcon
        name="i-lucide-chevron-right"
        class="size-[18px]"
      />
      <span>عودة إلى الطلاب</span>
    </NuxtLink>

    <ClientOnly>
      <template v-if="pending">
        <UiSkeletonBand :actions="2" />
        <div class="grid">
          <UiSkeletonLines :fields="6" />
          <UiSkeletonLines :fields="2" />
          <UiSkeletonLines :fields="2" />
          <UiSkeletonLines :fields="5" />
        </div>
      </template>
      <UiEmptyState
        v-else-if="!student"
        icon="i-lucide-user-x"
        title="الطالب غير موجود"
        description="قد يكون حُذف أو ليس ضمن نطاقك."
      />

      <template v-else>
        <!-- الشريط العلوي (مشتركٌ مع «صفحتي») -->
        <StudentBand
          :name="student.full_name"
          :status="student.status"
          :gender="student.gender"
          :halaqa="halaqa"
        >
          <template #avatar>
            <span class="face"><ProfileAvatar
              :name="student.full_name"
              :photo-url="photoUrl"
            /></span>
          </template>
          <template
            v-if="canManage"
            #actions
          >
            <UButton
              label="نسخ رابط الاطّلاع"
              icon="i-lucide-link"
              color="neutral"
              variant="ghost"
              size="md"
              :ui="{ base: 'min-h-11 rounded-xl bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25 justify-center' }"
              @click="copyLink"
            />
            <UButton
              v-if="isAdmin"
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="md"
              :loading="regenerating"
              class="regen"
              :ui="{ base: 'min-h-11 min-w-11 rounded-xl bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25 justify-center' }"
              aria-label="إعادة توليد الرابط"
              title="إعادة توليد الرابط (يُبطل القديم)"
              @click="regenerateLink"
            />
          </template>
        </StudentBand>

        <StudentTabs
          v-model="tab"
          :self="false"
        />

        <div
          :id="`panel-${tab}`"
          role="tabpanel"
          :aria-labelledby="`tab-${tab}`"
        >
          <StudentDashboard
            v-if="tab === 'dashboard'"
            :student-id="student.id"
            :quran-parts="student.quran_parts"
            :enrollment-date="student.enrollment_date"
            :attendance="attendance"
            :halaqa="halaqa"
            :self="false"
            :gender="student.gender"
          />
          <template v-else-if="tab === 'journey'">
            <StudentJourneyCard
              :student-id="student.id"
              :quran-parts="student.quran_parts"
              :enrollment-date="student.enrollment_date"
              bare
            />
            <StudentReadingStations
              :student-id="student.id"
              :enrollment-date="student.enrollment_date"
            />
          </template>
          <template v-else>
            <!-- حساب الدخول (المدير الإداري): إعادة تعيين الكلمة وتعطيل الدخول -->
            <StudentAccountActions
              v-if="isAdmin && student.user_id"
              :user-id="student.user_id"
              :student-name="student.full_name"
              :national-id="student.national_id"
            />
            <StudentDetailCards :sections="sections" />
          </template>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.back { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; font-size: 14.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
.back:hover { color: var(--ink); }

/* الصورةُ تُقصّ في إطار الشريط (الحرفُ أو الصورة) */
.face { width: 100%; height: 100%; border-radius: inherit; overflow: hidden; display: flex; align-items: center; justify-content: center; }
/* زرُّ إعادة التوليد مربّعٌ لا يتمدّد على الجوال */
.regen { flex: none !important; }

/* هيكل التحميل فقط — البطاقات الحقيقية في StudentDetailCards */
.grid { columns: 2; column-gap: 22px; }
@media (max-width: 768px) { .grid { columns: 1; } }
</style>
