<script setup lang="ts">
/**
 * الصورةُ الرمزية زرّاً — الحرفُ الأول (أو الصورة) في الشريط العلوي هو نفسُه موضعُ تغيير الصورة،
 * وعليه شارةُ كاميرا تقول ذلك. بلا صورةٍ: النقرُ يفتح اختيارَ الملفّ مباشرةً؛ ومعها: قائمةٌ صغيرة
 * «تبديل الصورة / إزالة الصورة». طلبُ المستخدم 2026-10-20 بدل بطاقة «صورة شخصية — اختياريّة».
 *
 * خطواتُ الرفع والإزالة كما في `PhotoField`: يُبطل المخبأَ ويعيد التوقيعَ بنفسه بعد الرفع (الاسمُ
 * ثابت، فبلا ذلك يظلّ الرافعُ يرى القديم)، والحفظُ فوريٌّ ويُعلم الصفحةَ بـ`changed`.
 * لا يُعرض لحساب أنثى أصلاً — يبقى الحرفُ ساكناً (والقاعدةُ ترفض على كلّ حال).
 */
import { canHavePhoto, PHOTO_ACCEPT, photoPath as photoPathOf } from '~/constants/profilePhoto'
import { PhotoFileLeftError } from '~/composables/useProfilePhoto'

interface Props {
  /** معرّف الحساب (profiles.id) — مجلّدُ الصورة. */
  profileId: string
  /** الاسم الكامل — للحرف الأول. */
  name: string
  /** المسار الحاليّ أو null. */
  photoPath: string | null
  /** جنسُ الحساب — الأنثى لا زرَّ لها. */
  gender: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ changed: [] }>()

const { isSaving, upload, remove } = useProfilePhoto()
const { prime, urlFor, invalidate } = useProfilePhotoUrls()
const { handle } = useErrorHandler()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const menuOpen = ref(false)
const allowed = computed(() => canHavePhoto(props.gender))

watch(() => props.photoPath, (path) => {
  void prime([path])
}, { immediate: true })

const url = computed(() => allowed.value ? urlFor(props.photoPath) : null)

function pick() {
  menuOpen.value = false
  fileInput.value?.click()
}

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
  menuOpen.value = false
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
  <!-- الأنثى: الحرفُ ساكناً بلا زرّ -->
  <div
    v-if="!allowed"
    class="pb-frame"
  >
    <span class="pb-face"><ProfileAvatar :name="name" /></span>
  </div>

  <template v-else>
    <input
      ref="fileInput"
      type="file"
      :accept="PHOTO_ACCEPT"
      class="hidden"
      @change="onPick"
    >

    <!-- بلا صورة: النقرُ يفتح اختيارَ الملفّ مباشرةً -->
    <button
      v-if="!photoPath"
      type="button"
      class="pb-frame pb-btn"
      aria-label="أضف صورة شخصية"
      title="أضف صورة شخصية"
      :disabled="isSaving"
      @click="pick"
    >
      <span class="pb-face"><ProfileAvatar
        :name="name"
        :photo-url="url"
        :zoomable="false"
      /></span>
      <span
        class="pb-hover"
        aria-hidden="true"
      ><UIcon
        name="i-lucide-camera"
        class="size-6"
      /></span>
      <span
        v-if="isSaving"
        class="pb-busy"
        aria-hidden="true"
      ><UIcon
        name="i-lucide-loader-circle"
        class="size-6 animate-spin"
      /></span>
      <span
        class="pb-badge"
        aria-hidden="true"
      ><UIcon
        name="i-lucide-camera"
        class="size-[15px]"
      /></span>
    </button>

    <!-- معها: قائمةٌ صغيرة -->
    <UPopover
      v-else
      v-model:open="menuOpen"
      :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
    >
      <button
        type="button"
        class="pb-frame pb-btn"
        aria-label="تغيير الصورة الشخصية"
        title="تغيير الصورة الشخصية"
        :disabled="isSaving"
      >
        <span class="pb-face"><ProfileAvatar
          :name="name"
          :photo-url="url"
          :zoomable="false"
        /></span>
        <span
          class="pb-hover"
          aria-hidden="true"
        ><UIcon
          name="i-lucide-camera"
          class="size-6"
        /></span>
        <span
          v-if="isSaving"
          class="pb-busy"
          aria-hidden="true"
        ><UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin"
        /></span>
        <span
          class="pb-badge"
          aria-hidden="true"
        ><UIcon
          name="i-lucide-pencil"
          class="size-[14px]"
        /></span>
      </button>
      <template #content>
        <div class="pb-menu">
          <button
            type="button"
            class="pb-item"
            @click="pick"
          >
            <UIcon
              name="i-lucide-image-up"
              class="size-[18px]"
            />
            تبديل الصورة
          </button>
          <button
            type="button"
            class="pb-item pb-danger"
            @click="onRemove"
          >
            <UIcon
              name="i-lucide-trash-2"
              class="size-[18px]"
            />
            إزالة الصورة
          </button>
        </div>
      </template>
    </UPopover>
  </template>
</template>

<style scoped>
.pb-frame { position: relative; width: 100%; height: 100%; border-radius: inherit; display: flex; align-items: center; justify-content: center; }
.pb-face { width: 100%; height: 100%; border-radius: inherit; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.pb-btn { padding: 0; border: none; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.pb-btn:focus-visible { outline: 3px solid rgba(255, 255, 255, .7); outline-offset: 3px; }
.pb-btn:disabled { cursor: progress; }

/* طبقةُ المرور: كاميرا فوق الوجه على الحاسوب */
.pb-hover, .pb-busy { position: absolute; inset: 0; border-radius: inherit; display: flex; align-items: center; justify-content: center; color: #fff; background: rgba(4, 28, 44, .55); }
.pb-hover { opacity: 0; transition: opacity .15s; }
@media (hover: hover) { .pb-btn:hover .pb-hover { opacity: 1; } }

/* الشارة: دائمةٌ — هي ما يقول «تُغيَّر من هنا» على الجوال حيث لا مرور */
.pb-badge { position: absolute; inset-inline-end: -6px; bottom: -6px; width: 28px; height: 28px; border-radius: 999px; background: #fff; color: var(--navy); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px var(--band), 0 4px 10px rgba(0, 0, 0, .25); transition: transform .15s; }
@media (hover: hover) { .pb-btn:hover .pb-badge { transform: scale(1.08); } }

.pb-menu { display: flex; flex-direction: column; padding: 6px; min-width: 190px; }
.pb-item { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px; border: none; background: transparent; border-radius: 10px; font: inherit; font-size: 14.5px; font-weight: 600; color: var(--ink); cursor: pointer; text-align: start; }
.pb-item:hover { background: var(--surface-2); }
.pb-danger { color: var(--err); }
.pb-danger:hover { background: var(--err-soft); }
</style>
