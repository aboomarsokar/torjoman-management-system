<script setup lang="ts" generic="T extends string | number">
/**
 * غلاف موحّد حول USelect:
 * - يوسّع القائمة المنسدلة (content: w-fit) فلا يُقصّ النص الطويل في الخيارات.
 * - مؤشّرُ اليد عند المرور، واستدارة موحّدة (rounded-[13px])، وعرض كامل افتراضيّاً — إلا إذا مرّر الأب
 *   class مخصّص (مثل عرض ثابت لفلتر)، فيُحترم عرضه بدل فرض w-full عليه.
 * يمرّر بقية الخصائص (items/placeholder/size/disabled…) عبر $attrs.
 * تجاوز أيّ مفتاح أنماط عبر تمرير :ui.
 *
 * **الجذرُ عنصرٌ واحدٌ حقيقيّ** (div) يحمل `class` و`style` الأب: جذرُ USelect متعدّدُ العناصر، فكان Vue
 * لا يمرّر إليه صنفَ الأب ولا علامةَ نطاقه عند الرسم في المتصفّح (التنقّلُ داخل التطبيق)، ويمرّرهما رسمُ
 * السيرفر — فيظهر منتقي الشهر ومرشّحاتُ الشاشات ضيّقةً أوّلَ مرّة وصحيحةً بعد التحديث (2026-10-20).
 * أنماطُ الأب على الصنف تبقى للتخطيط (عرضٌ وتمدّد)؛ وما يخصّ الزرَّ نفسه يُكتب `:deep(button)`.
 */
import type { StyleValue } from 'vue'

defineOptions({ inheritAttrs: false })
const model = defineModel<T>()
const props = defineProps<{ ui?: Record<string, string> }>()
const attrs = useAttrs()

const rootStyle = computed(() => attrs.style as StyleValue | undefined)

// كلُّ الخصائص إلى USelect إلا الصنفَ والنمط (للجذر)
const selectAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

// مؤشّرُ اليد على القائمة دائماً (طلب المستخدم 2026-10-19) — يُضاف إلى `base` الممرَّر لا يُستبدل به
const mergedUi = computed(() => ({
  content: 'w-fit min-w-(--reka-select-trigger-width) max-w-[min(92vw,32rem)]',
  ...(props.ui || {}),
  base: `cursor-pointer ${props.ui?.base ?? 'rounded-[13px]'}`
}))
</script>

<template>
  <div
    class="ui-select"
    :class="attrs.class ?? 'w-full'"
    :style="rootStyle"
  >
    <USelect
      v-model="model"
      v-bind="selectAttrs"
      :ui="mergedUi"
      class="w-full"
    />
  </div>
</template>

<style scoped>
.ui-select { min-width: 0; }
</style>
