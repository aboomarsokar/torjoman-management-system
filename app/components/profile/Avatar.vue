<script setup lang="ts">
/**
 * الصورة الرمزية — **صورةٌ إن وُجدت، وإلا الحرفُ الأول**. منقولٌ من الصحابة
 * (`components/profile/Avatar.vue`) ومكيَّف: يملأ إطارَه الذي يرسمه موضعُه (ترويسة الملف،
 * خلايا القوائم، الشريطان) فيبقى شكلُ كلّ موضعٍ كما صُمّم، والإطارُ يحتاج `overflow: hidden`.
 *
 * - مكوّنٌ واحدٌ لكلّ المواضع: نسخةٌ في كلٍّ تُصلَح في واحدةٍ وتُنسى في اثنتين.
 * - يسقط إلى الحرف عند فشل التحميل: الرابطُ الموقَّع ينتهي في شاشةٍ مفتوحةٍ طويلاً، ومربّعٌ
 *   مكسور يُقرأ عطباً. والصورةُ اختياريّةٌ أصلاً فغيابُها ليس نقصاً.
 * - `alt` فارغ و`aria-hidden` على الحرف: الاسمُ كاملاً بجانبها، فلا يُقرأ مرّتين.
 * - لا صورة لحساب أنثى: الموضعُ يمرّر `photoUrl` من `displayPhotoPath` فيصل `null`.
 */
interface Props {
  /** الاسم الكامل — يُشتقّ منه الحرف الأول. */
  name: string
  /** الرابط الموقَّع، أو null فيُعرض الحرف. */
  photoUrl?: string | null
}

const props = withDefaults(defineProps<Props>(), { photoUrl: null })

const failed = ref(false)

// رابطٌ جديد يعيد المحاولة: بعد رفعٍ ناجحٍ لا يبقى الحرفُ عالقاً.
watch(() => props.photoUrl, () => {
  failed.value = false
})

const showPhoto = computed(() => Boolean(props.photoUrl) && !failed.value)

// الحرفُ الأولُ لا الحروفُ الأولى: الرباعيُّ يُنتج أربعةَ حروفٍ لا تُقرأ.
const monogram = computed(() => props.name.trim().charAt(0) || '؟')
</script>

<template>
  <img
    v-if="showPhoto"
    :src="photoUrl ?? undefined"
    alt=""
    class="size-full object-cover"
    decoding="async"
    @error="failed = true"
  >
  <span
    v-else
    aria-hidden="true"
  >{{ monogram }}</span>
</template>
