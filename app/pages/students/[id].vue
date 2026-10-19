<script setup lang="ts">
/**
 * ملف الطالب (§4.23) — عرض تفصيلي لسجلّ الطالب.
 * بيانات أساسية + قرآنية + سكن + وليّ الأمر والتواصل. رحلة الطالب (§4.22)
 * تُضاف مع وحدتي التقارير والاختبارات.
 * الصورة الشخصية (Task 6b) تُعرض من حساب الطالب، ولا صورة لطالبة.
 * حساب الدخول (إعادة تعيين الكلمة وتعطيل الدخول) للمدير الإداري وحده — StudentAccountActions.
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
        <!-- شريط علوي -->
        <div class="band">
          <div class="av">
            <ProfileAvatar
              :name="student.full_name"
              :photo-url="photoUrl"
            />
          </div>
          <div class="band-info">
            <div class="band-top">
              <h2>{{ student.full_name }}</h2>
              <UBadge
                :label="STUDENT_STATUS[student.status]?.label"
                :color="STUDENT_STATUS[student.status]?.color"
                variant="soft"
              />
            </div>
            <div class="band-sub">
              {{ student.halaqa?.name || 'بلا حلقة' }}
              <template v-if="student.halaqa?.teacher?.full_name">
                · {{ student.gender === 'female' ? 'المعلّمة' : 'المعلّم' }} {{ student.halaqa.teacher.full_name }}
              </template>
              <template v-if="student.halaqa?.daily_time">
                · {{ student.halaqa.daily_time.slice(0, 5) }}
              </template>
            </div>
          </div>
          <div
            v-if="canManage"
            class="band-actions"
          >
            <UButton
              label="نسخ رابط الاطّلاع"
              icon="i-lucide-link"
              color="neutral"
              variant="ghost"
              size="md"
              :ui="{ base: 'rounded-xl bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25' }"
              @click="copyLink"
            />
            <UButton
              v-if="isAdmin"
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="md"
              :loading="regenerating"
              :ui="{ base: 'rounded-xl bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25' }"
              aria-label="إعادة توليد الرابط"
              title="إعادة توليد الرابط (يُبطل القديم)"
              @click="regenerateLink"
            />
          </div>
        </div>

        <!-- حساب الدخول (المدير الإداري): إعادة تعيين الكلمة وتعطيل الدخول -->
        <StudentAccountActions
          v-if="isAdmin && student.user_id"
          :user-id="student.user_id"
          :student-name="student.full_name"
          :national-id="student.national_id"
        />

        <!-- بطاقات البيانات -->
        <StudentDetailCards :sections="sections" />

        <!-- رحلة الطالب على خطة الاختبارات (حسب الحفظ) -->
        <StudentJourneyCard
          :student-id="student.id"
          :quran-parts="student.quran_parts"
          :enrollment-date="student.enrollment_date"
        />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.back { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; font-size: 14.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
.back:hover { color: var(--ink); }

.band { background: var(--band); border-radius: 22px; padding: 28px 30px; box-shadow: var(--shadow-lg); margin-bottom: 24px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.av { width: 70px; height: 70px; border-radius: 20px; background: rgba(255, 255, 255, .16); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; flex: none; overflow: hidden; }
.band-info { min-width: 0; flex: 1; }
.band-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.band-top h2 { margin: 0; font-size: 25px; font-weight: 700; color: #fff; }
.band-sub { font-size: 15px; color: var(--band-sub); margin-top: 6px; }
.band-actions { display: flex; align-items: center; gap: 8px; flex: none; }

/* هيكل التحميل فقط — البطاقات الحقيقية في StudentDetailCards */
.grid { columns: 2; column-gap: 22px; }
@media (max-width: 768px) { .grid { columns: 1; } }
</style>
