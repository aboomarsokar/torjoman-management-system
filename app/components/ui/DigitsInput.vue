<script setup lang="ts">
/**
 * حقلٌ لا يقبل إلا الأرقام: تُحوَّل الأرقامُ العربية إلى لاتينية، ويُحذف ما سواها فوراً من الحقل نفسه، ويُقصّ إلى `max` خانة.
 * بقيّةُ الخصائص (size, placeholder, autocomplete…) تُمرَّر إلى UInput.
 */
import { digitsOnly } from '~/constants/identity'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ max: number }>()
const model = defineModel<string>({ required: true })
const input = useTemplateRef<{ inputRef: HTMLInputElement | null }>('input')

function sync(v: unknown) {
  const clean = digitsOnly(String(v ?? '')).slice(0, props.max)
  model.value = clean
  // القيمةُ قد لا تتغيّر (حرفٌ مرفوض) فلا يُعاد الرسم — نصحّح الحقلَ مباشرة
  const el = input.value?.inputRef
  if (el && el.value !== clean) el.value = clean
}
</script>

<template>
  <UInput
    ref="input"
    v-bind="$attrs"
    :model-value="model"
    inputmode="numeric"
    dir="ltr"
    @update:model-value="sync"
  />
</template>
