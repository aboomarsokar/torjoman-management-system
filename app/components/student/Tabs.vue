<script setup lang="ts">
/**
 * تبويباتُ صفحة الطالب — «لوحة التحكم» و«رحلتي/رحلته» و«بياناتي/بياناته» — مشتركةٌ بين «صفحتي»
 * وملفّ الطالب عند العاملين. الشكلُ في `UiSegmentTabs` (المقطّعُ المشترك).
 * التبويبُ في الرابط (`useStudentTab`)، والصياغةُ بضمير المتكلّم للطالب وبالغائب للعامل.
 */
import type { StudentTab } from '~/composables/useStudentTab'

interface Props {
  /** الطالبُ نفسه (رحلتي/بياناتي) أم العامل (رحلته/بياناته). */
  self: boolean
}

const props = defineProps<Props>()
const tab = defineModel<StudentTab>({ required: true })

const tabs = computed(() => [
  { key: 'dashboard' as const, label: 'لوحة التحكم', icon: 'i-lucide-layout-dashboard' },
  { key: 'journey' as const, label: props.self ? 'رحلتي' : 'رحلته', icon: 'i-lucide-route' },
  { key: 'data' as const, label: props.self ? 'بياناتي' : 'بياناته', icon: 'i-lucide-id-card' }
])
</script>

<template>
  <UiSegmentTabs
    v-model="tab"
    :tabs="tabs"
    label="أقسام صفحة الطالب"
  />
</template>
