<script setup lang="ts">
/**
 * حقلُ الصورة الشخصية — معاينةٌ وزرّا رفعٍ وإزالة. منقولٌ من الصحابة
 * (`components/employees/PhotoField.vue`) ومكيَّفٌ على `profiles`.
 *
 * - الصورةُ اختياريّةٌ دائماً: لا شارةَ «بلا صورة» ولا لونَ تنبيه — الفراغُ اختيارٌ لا نقص.
 * - لا يُعرض لحساب أنثى أصلاً (قرار 2026-10-18) — والقاعدةُ ترفض على كلّ حال.
 * - يُبطل المخبأَ ويعيد التوقيعَ بنفسه بعد الرفع: الاسمُ ثابت، فبلا ذلك يظلّ الرافعُ يرى القديم.
 * - الحفظُ فوريٌّ (لا ينتظر زرَّ «حفظ» في نموذج)، ويُعلم الصفحةَ بـ`changed`.
 */
import { canHavePhoto, PHOTO_ACCEPT, photoPath as photoPathOf } from '~/constants/profilePhoto'
import { PhotoFileLeftError } from '~/composables/useProfilePhoto'

interface Props {
  /** معرّف الحساب (profiles.id) — مجلّدُ الصورة. */
  profileId: string
  /** الاسم الكامل — للحرف الأول في المعاينة. */
  name: string
  /** المسار الحاليّ أو null. */
  photoPath: string | null
  /** جنسُ الحساب — الأنثى لا حقلَ لها. */
  gender: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ changed: [] }>()

const { isSaving, upload, remove } = useProfilePhoto()
const { prime, urlFor, invalidate } = useProfilePhotoUrls()
const { handle } = useErrorHandler()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const allowed = computed(() => canHavePhoto(props.gender))

watch(() => props.photoPath, (path) => {
  void prime([path])
}, { immediate: true })

const url = computed(() => urlFor(props.photoPath))

async function onPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    await upload(props.profileId, file)
    // يُعاد التوقيعُ فوراً: الإبطالُ وحده يُفرِّغ المخبأ ولا يملؤه، والمشاهدُ على photoPath
    // لا يُطلَق لأنّ القيمة لم تتغيّر (الاسمُ ثابت).
    invalidate(photoPathOf(props.profileId))
    await prime([photoPathOf(props.profileId)])
    toast.add({ title: 'حُفظت الصورة.', color: 'success', icon: 'i-lucide-image' })
    emit('changed')
  } catch (error) {
    handle(error, 'تعذّر رفع الصورة.')
  } finally {
    // يُفرَّغ الحقل: بلا ذلك لا يقع change لو اختار الملفَّ نفسَه ثانيةً.
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function onRemove() {
  // أُفرغ المسار؟ نعم عند النجاح، وعند PhotoFileLeftError (فشل حذف الملف بعد إفراغ المسار)
  let cleared = false
  try {
    await remove(props.profileId)
    cleared = true
    toast.add({ title: 'أُزيلت الصورة.', color: 'success', icon: 'i-lucide-image-off' })
  } catch (error) {
    cleared = error instanceof PhotoFileLeftError
    handle(error, 'تعذّر إزالة الصورة.')
  }
  if (cleared) {
    invalidate(photoPathOf(props.profileId))
    emit('changed')
  }
}
</script>

<template>
  <div
    v-if="allowed"
    class="photo-field"
  >
    <div class="pf-preview">
      <ProfileAvatar
        :name="name"
        :photo-url="url"
      />
    </div>
    <div class="pf-body">
      <div class="pf-hint">
        صورة شخصية — اختياريّة
      </div>
      <input
        ref="fileInput"
        type="file"
        :accept="PHOTO_ACCEPT"
        class="hidden"
        @change="onPick"
      >
      <div class="pf-actions">
        <UButton
          icon="i-lucide-upload"
          :label="photoPath ? 'تبديل الصورة' : 'رفع صورة'"
          color="neutral"
          variant="outline"
          :loading="isSaving"
          class="min-h-11"
          @click="fileInput?.click()"
        />
        <UButton
          v-if="photoPath"
          icon="i-lucide-trash-2"
          label="إزالة"
          color="neutral"
          variant="ghost"
          :loading="isSaving"
          class="min-h-11"
          @click="onRemove"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-field { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.pf-preview { width: 64px; height: 64px; border-radius: 18px; background: var(--primary); color: var(--on-primary); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 700; flex: none; overflow: hidden; }
.pf-body { display: flex; flex-direction: column; gap: 8px; min-width: 180px; flex: 1; }
.pf-hint { font-size: 13px; color: var(--ink-3); }
.pf-actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
