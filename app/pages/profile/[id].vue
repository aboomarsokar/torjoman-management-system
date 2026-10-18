<script setup lang="ts">
/**
 * الملف الشخصي للعامل (§4.4/4.5) — عرض وتعديل بيانات عامل.
 * المسار: /profile/[id]، و«me» تعني المستخدم الحالي. العرض متاح للعاملين،
 * والتعديل للمدير الإداري أو لصاحب الملف نفسه (RLS). رقم الهوية يُقنَّع لغير المخوّل.
 * الجنس للمدير الإداري وحده (حارس القاعدة يمنع صاحب الملف من تغييره).
 * الصورة الشخصية اختيارية في مستودعٍ خاص (Task 6b) — يرفعها صاحب الملف أو المدير الإداري،
 * ولا صورة لحساب أنثى (لا حقل، والترويسة بالحرف الأول دائماً).
 * الطالب لا يملك ملفّاً وظيفيّاً: يُحوَّل إلى «صفحتي» (/me) حيث بياناته للقراءة وكلمة مروره وصورته.
 */
import type { Database } from '~/types/database.types'
import { roleLabel } from '~/constants/roles'
import { canHavePhoto, displayPhotoPath } from '~/constants/profilePhoto'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const supabase = useSupabaseClient<Database>()
const { profile: myProfile } = useProfile()
const { isAdmin, isStudent } = usePermissions()
const { handle } = useErrorHandler()
const { prime, urlFor } = useProfilePhotoUrls()
const { refresh: refreshMyPhoto } = useMyPhoto()
const toast = useToast()

const GENDER_LABEL: Record<string, string> = { male: 'ذكر', female: 'أنثى' }
const genderItems = [{ label: 'ذكر', value: 'male' }, { label: 'أنثى', value: 'female' }]

// الطالب لا يعدّل حقولاً وظيفيّة (المسمّى، التعيين، الاسم) — صفحته /me. الدور يصل غير متزامن، فيُراقَب.
watch(isStudent, (student) => {
  if (student) void navigateTo('/me', { replace: true })
}, { immediate: true })

const targetId = computed(() => route.params.id === 'me' ? (myProfile.value?.id ?? '') : String(route.params.id))
const isSelf = computed(() => !!targetId.value && targetId.value === myProfile.value?.id)
const canEdit = computed(() => isAdmin.value || isSelf.value)
const canSeeId = computed(() => isAdmin.value || isSelf.value)

type Profile = Database['public']['Tables']['profiles']['Row']
type Scope = { label: string, value: string | number }

// جلب غير حاجز (useLazyAsyncData): الاستعلامان مستقلّان ويعملان بالتوازي تلقائياً
const { data, pending, refresh } = useLazyAsyncData(() => `profile-${targetId.value}`, async () => {
  if (!targetId.value) return null
  const { data: p } = await supabase.from('profiles').select('*').eq('id', targetId.value).maybeSingle<Profile>()
  if (!p) return null

  const scope: Scope[] = []
  if (p.role === 'teacher') {
    const { data: h } = await supabase.from('halaqat').select('id, name').eq('teacher_id', p.id).limit(1).maybeSingle()
    if (h) {
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('halaqa_id', h.id).eq('status', 'active')
      scope.push({ label: 'الحلقة', value: h.name }, { label: 'عدد الطلاب', value: count ?? 0 })
    }
  } else if (p.role === 'field_supervisor') {
    const { count } = await supabase.from('halaqat').select('*', { count: 'exact', head: true }).eq('supervisor_id', p.id)
    scope.push({ label: 'الحلقات المُسندة', value: count ?? 0 })
  } else if (p.role === 'examiner') {
    const { count } = await supabase.from('halaqat').select('*', { count: 'exact', head: true }).eq('examiner_id', p.id)
    scope.push({ label: 'الحلقات المُسندة للاختبار', value: count ?? 0 })
  }
  return { p, scope }
}, { server: false, default: () => null, watch: [targetId] })

useSeoMeta({ title: () => data.value?.p ? `${data.value.p.full_name} — ترجمان` : 'الملف الشخصي — ترجمان' })

const photoPath = computed(() => displayPhotoPath(data.value?.p))
watch(photoPath, path => void prime([path]), { immediate: true })
const photoUrl = computed(() => urlFor(photoPath.value))
const showPhotoField = computed(() => canEdit.value && canHavePhoto(data.value?.p?.gender))

/** بعد رفع الصورة أو إزالتها: يُعاد جلب الملف، وصورة الشريط إن كان الملف ملفي. */
async function onPhotoChanged() {
  await refresh()
  if (isSelf.value) await refreshMyPhoto()
}

const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === '') ? '—' : String(v)
const age = computed(() => {
  const b = data.value?.p?.birth_date
  if (!b) return null
  const d = new Date(b)
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000))
})
const maskedId = computed(() => {
  const id = data.value?.p?.national_id
  if (!id) return '—'
  return canSeeId.value ? id : `•••• ${id.slice(-4)}`
})

const sections = computed(() => {
  const p = data.value?.p
  if (!p) return []
  return [
    {
      title: 'بيانات أساسية', icon: 'i-lucide-user', fields: [
        { label: 'الاسم', value: dash(p.full_name) },
        { label: 'الجنس', value: p.gender ? GENDER_LABEL[p.gender] : '—' },
        { label: 'تاريخ الميلاد', value: p.birth_date ? `${p.birth_date}${age.value != null ? ` (${age.value} سنة)` : ''}` : '—' },
        { label: 'رقم الهوية', value: maskedId.value },
        { label: 'الحالة الاجتماعية', value: dash(p.marital_status) },
        { label: 'عدد الأفراد', value: dash(p.family_count) }
      ]
    },
    {
      title: 'بيانات وظيفية', icon: 'i-lucide-briefcase', fields: [
        { label: 'المسمى الوظيفي', value: dash(p.job_title) },
        { label: 'تاريخ التعيين', value: dash(p.hire_date) },
        { label: 'سنوات الخبرة', value: dash(p.years_experience) }
      ]
    },
    {
      title: 'السكن والتواصل', icon: 'i-lucide-map-pin', fields: [
        { label: 'المنطقة/المدينة', value: dash(p.residence_area) },
        { label: 'أقرب مسجد', value: dash(p.nearest_mosque) },
        { label: 'العنوان التفصيلي', value: dash(p.address_detail) },
        { label: 'الجوال', value: dash(p.phone) }
      ]
    },
    {
      title: 'المؤهلات', icon: 'i-lucide-graduation-cap', fields: [
        { label: 'المؤهل التعليمي', value: dash(p.education_level) },
        { label: 'التخصص', value: dash(p.academic_major) },
        { label: 'الأجزاء المثبتة', value: p.quran_parts != null ? `${p.quran_parts} / 30` : '—' },
        { label: 'مستوى التجويد', value: dash(p.tajweed_level) }
      ]
    }
  ]
})

// ── تعديل ──
const modalOpen = ref(false)
const saving = ref(false)
const form = reactive({
  full_name: '', gender: '' as '' | 'male' | 'female', birth_date: '', national_id: '', marital_status: '', family_count: '',
  job_title: '', hire_date: '', years_experience: '',
  residence_area: '', nearest_mosque: '', address_detail: '', phone: '',
  education_level: '', academic_major: '', quran_parts: '', tajweed_level: ''
})
const numStr = (v: number | null) => v != null ? String(v) : ''

function openEdit() {
  const p = data.value?.p
  if (!p) return
  Object.assign(form, {
    full_name: p.full_name, gender: p.gender ?? '', birth_date: p.birth_date ?? '', national_id: p.national_id ?? '', marital_status: p.marital_status ?? '', family_count: numStr(p.family_count),
    job_title: p.job_title ?? '', hire_date: p.hire_date ?? '', years_experience: numStr(p.years_experience),
    residence_area: p.residence_area ?? '', nearest_mosque: p.nearest_mosque ?? '', address_detail: p.address_detail ?? '', phone: p.phone ?? '',
    education_level: p.education_level ?? '', academic_major: p.academic_major ?? '', quran_parts: numStr(p.quran_parts), tajweed_level: p.tajweed_level ?? ''
  })
  modalOpen.value = true
}

const numOrNull = (v: string) => (v === '' || v === null) ? null : Number(v)
const strOrNull = (v: string) => v.trim() || null

async function save() {
  if (!form.full_name.trim()) {
    toast.add({ title: 'الاسم مطلوب.', color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  saving.value = true
  try {
    const patch: Database['public']['Tables']['profiles']['Update'] = {
      full_name: form.full_name.trim(),
      // الجنس للمدير الإداري وحده — لا يُرسل من غيره (حارس القاعدة يرفض التغيير)
      ...(isAdmin.value ? { gender: form.gender || null } : {}),
      birth_date: strOrNull(form.birth_date),
      national_id: strOrNull(form.national_id),
      marital_status: strOrNull(form.marital_status),
      family_count: numOrNull(form.family_count),
      job_title: strOrNull(form.job_title),
      hire_date: strOrNull(form.hire_date),
      years_experience: numOrNull(form.years_experience),
      residence_area: strOrNull(form.residence_area),
      nearest_mosque: strOrNull(form.nearest_mosque),
      address_detail: strOrNull(form.address_detail),
      phone: strOrNull(form.phone),
      education_level: strOrNull(form.education_level),
      academic_major: strOrNull(form.academic_major),
      quran_parts: numOrNull(form.quran_parts),
      tajweed_level: strOrNull(form.tajweed_level)
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', targetId.value)
    if (error) throw error
    toast.add({ title: 'حُفظت البيانات.', color: 'success', icon: 'i-lucide-circle-check' })
    modalOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

// ── تغيير كلمة المرور (لصاحب الملف) ──
const pwOpen = ref(false)
</script>

<template>
  <div class="profile">
    <ClientOnly>
      <template v-if="pending || isStudent">
        <UiSkeletonBand :actions="2" />
        <div class="sections">
          <UiSkeletonLines
            v-for="i in 4"
            :key="i"
            :fields="i === 1 ? 6 : i === 4 ? 5 : i === 2 ? 2 : 2"
          />
        </div>
      </template>
      <UiEmptyState
        v-else-if="!data?.p"
        icon="i-lucide-user-x"
        title="الملف غير موجود"
      />

      <template v-else>
        <!-- الترويسة -->
        <div class="band">
          <div class="band-id">
            <div class="av">
              <ProfileAvatar
                :name="data.p.full_name"
                :photo-url="photoUrl"
              />
            </div>
            <div>
              <h1>{{ data.p.full_name }}</h1>
              <div class="band-sub">
                <UBadge
                  :label="roleLabel(data.p.role, data.p.gender)"
                  color="info"
                  variant="soft"
                />
                <span v-if="data.p.employee_number"><UIcon
                  name="i-lucide-id-card"
                  class="size-4"
                /><bdi dir="ltr">{{ data.p.employee_number }}</bdi></span>
              </div>
            </div>
          </div>
          <div class="band-actions">
            <UButton
              v-if="isSelf"
              label="تغيير كلمة المرور"
              color="neutral"
              variant="outline"
              size="lg"
              icon="i-lucide-key-round"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
              @click="pwOpen = true"
            />
            <UButton
              v-if="canEdit"
              label="تعديل البيانات"
              color="primary"
              size="lg"
              icon="i-lucide-pencil"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
              @click="openEdit"
            />
          </div>
        </div>

        <!-- تنبيه الكلمة الافتراضية -->
        <ProfilePasswordBanner
          v-if="isSelf && data.p.must_change_password"
          @change="pwOpen = true"
        />

        <!-- الصورة الشخصية (اختيارية؛ لا تُعرض لحساب أنثى) -->
        <section
          v-if="showPhotoField"
          class="card photo-card"
        >
          <ProfilePhotoField
            :profile-id="data.p.id"
            :name="data.p.full_name"
            :photo-path="photoPath"
            :gender="data.p.gender"
            @changed="onPhotoChanged"
          />
        </section>

        <!-- النطاق -->
        <div
          v-if="data.scope.length"
          class="scope"
        >
          <div
            v-for="s in data.scope"
            :key="s.label"
            class="scope-card"
          >
            <div class="scope-val">
              {{ s.value }}
            </div>
            <div class="scope-lbl">
              {{ s.label }}
            </div>
          </div>
        </div>

        <!-- الأقسام -->
        <div class="sections">
          <section
            v-for="sec in sections"
            :key="sec.title"
            class="card sec"
          >
            <h3>
              <UIcon
                :name="sec.icon"
                class="size-[18px]"
              />{{ sec.title }}
            </h3>
            <dl class="fields">
              <div
                v-for="f in sec.fields"
                :key="f.label"
                class="field"
              >
                <dt>{{ f.label }}</dt>
                <dd>{{ f.value }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </template>
    </ClientOnly>

    <!-- نافذة تغيير كلمة المرور -->
    <ProfilePasswordModal
      v-model:open="pwOpen"
      :profile-id="targetId"
      @changed="refresh"
    />

    <!-- نافذة التعديل -->
    <UModal
      v-model:open="modalOpen"
      title="تعديل البيانات"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <div class="form">
          <div class="grp">
            بيانات أساسية
          </div>
          <div class="row">
            <UFormField
              label="الاسم الرباعي"
              class="f2"
              required
            >
              <UInput
                v-model="form.full_name"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="الجنس"
              class="f1"
            >
              <UiSelect
                v-model="form.gender"
                :items="genderItems"
                :disabled="!isAdmin"
                placeholder="—"
                size="lg"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="تاريخ الميلاد"
              class="f1"
            >
              <UInput
                v-model="form.birth_date"
                type="date"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="رقم الهوية"
              class="f1"
            >
              <UInput
                v-model="form.national_id"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="الحالة الاجتماعية"
              class="f1"
            >
              <UInput
                v-model="form.marital_status"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="عدد الأفراد"
              class="f1"
            >
              <UInput
                v-model="form.family_count"
                type="number"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>

          <div class="grp">
            بيانات وظيفية
          </div>
          <div class="row">
            <UFormField
              label="المسمى الوظيفي"
              class="f2"
            >
              <UInput
                v-model="form.job_title"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="سنوات الخبرة"
              class="f1"
            >
              <UInput
                v-model="form.years_experience"
                type="number"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <UFormField label="تاريخ التعيين">
            <UInput
              v-model="form.hire_date"
              type="date"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>

          <div class="grp">
            السكن والتواصل
          </div>
          <div class="row">
            <UFormField
              label="المنطقة/المدينة"
              class="f1"
            >
              <UInput
                v-model="form.residence_area"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="الجوال"
              class="f1"
            >
              <UInput
                v-model="form.phone"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="أقرب مسجد"
              class="f1"
            >
              <UInput
                v-model="form.nearest_mosque"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="العنوان التفصيلي"
              class="f1"
            >
              <UInput
                v-model="form.address_detail"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>

          <div class="grp">
            المؤهلات
          </div>
          <div class="row">
            <UFormField
              label="المؤهل التعليمي"
              class="f1"
            >
              <UInput
                v-model="form.education_level"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="التخصص"
              class="f1"
            >
              <UInput
                v-model="form.academic_major"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <div class="row">
            <UFormField
              label="الأجزاء المثبتة"
              class="f1"
            >
              <UInput
                v-model="form.quran_parts"
                type="number"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="مستوى التجويد"
              class="f1"
            >
              <UInput
                v-model="form.tajweed_level"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="modal-foot">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            @click="modalOpen = false"
          />
          <UButton
            label="حفظ"
            color="primary"
            icon="i-lucide-check"
            :loading="saving"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="save"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }

.band { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 18px; }
.band-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.band-id { display: flex; align-items: center; gap: 16px; min-width: 0; }
.av { width: 64px; height: 64px; border-radius: 18px; background: var(--navy); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 700; flex: none; overflow: hidden; }
.photo-card { padding: 18px 22px; margin-bottom: 18px; }
.band h1 { margin: 0 0 8px; font-size: 24px; font-weight: 700; color: var(--ink); }
.band-sub { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.band-sub span { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--ink-2); }

.scope { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
.scope-card { flex: 1; min-width: 140px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 16px 18px; }
.scope-val { font-size: 24px; font-weight: 700; color: var(--ink); line-height: 1; }
.scope-lbl { font-size: 13px; color: var(--ink-3); margin-top: 7px; }

.sections { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
.sec { padding: 20px 22px; }
.sec h3 { margin: 0 0 16px; font-size: 16.5px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 8px; }
.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0; }
.field { background: var(--surface-2); border: 1px solid var(--line); border-radius: 13px; padding: 12px 14px; }
.field dt { font-size: 12px; color: var(--ink-3); margin-bottom: 6px; }
.field dd { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--ink); word-break: break-word; }

.form { display: flex; flex-direction: column; gap: 14px; }
.grp { font-size: 13px; font-weight: 700; color: var(--ink-3); margin-top: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--line); }
.row { display: flex; gap: 14px; }
.f1 { flex: 1; }
.f2 { flex: 2; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; }

@media (max-width: 760px) { .sections { grid-template-columns: 1fr; } }
@media (max-width: 560px) { .row { flex-direction: column; } .fields { grid-template-columns: 1fr; } }
</style>
