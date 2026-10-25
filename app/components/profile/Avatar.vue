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
 * - الصورةُ تُكبَّر بالضغط عليها (طلب المستخدم 2026-10-25 «حتى أعرف شكل المعلم أو الطالب»): نافذةٌ بالصورة كبيرةً
 *   والاسمِ عنواناً. الضغطةُ لا تبلغ صفَّ الجدول ولا رابطَ البطاقة حولها. والحرفُ لا يُكبَّر. `zoomable=false` يُطفئها.
 */
interface Props {
  /** الاسم الكامل — يُشتقّ منه الحرف الأول. */
  name: string
  /** الرابط الموقَّع، أو null فيُعرض الحرف. */
  photoUrl?: string | null
  zoomable?: boolean
}

const props = withDefaults(defineProps<Props>(), { photoUrl: null, zoomable: true })
const zoomOpen = ref(false)
function openZoom(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  zoomOpen.value = true
}

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
  <button
    v-if="showPhoto && zoomable"
    type="button"
    class="av-zoom"
    :aria-label="`تكبير صورة ${name}`"
    @click="openZoom"
  >
    <img
      :src="photoUrl ?? undefined"
      alt=""
      class="size-full object-cover"
      decoding="async"
      @error="failed = true"
    >
  </button>
  <img
    v-else-if="showPhoto"
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
  <UModal
    v-if="showPhoto && zoomable"
    v-model:open="zoomOpen"
    :title="name"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <img
        :src="photoUrl ?? undefined"
        :alt="`صورة ${name}`"
        class="av-big"
        decoding="async"
      >
    </template>
  </UModal>
</template>

<style scoped>
.av-zoom { display: block; width: 100%; height: 100%; padding: 0; border: 0; background: none; cursor: zoom-in; }
.av-zoom:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.av-big { display: block; width: 100%; max-height: 70vh; object-fit: contain; border-radius: 16px; background: var(--surface-2); }
</style>
