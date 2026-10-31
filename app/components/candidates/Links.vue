<script setup lang="ts">
/**
 * رابطا صفحة المقابلات (استُخرجا من الصفحة 2026-10-31): نسخُ رابط التسجيل العامّ (/join) لنشره، واستمارةُ التحكيم للطباعة.
 */
const toast = useToast()

async function copyJoinLink() {
  const link = `${location.origin}/join`
  try {
    await navigator.clipboard.writeText(link)
    toast.add({ title: 'نُسخ رابط التسجيل.', description: link, color: 'success', icon: 'i-lucide-link' })
  } catch {
    toast.add({ title: 'رابط التسجيل', description: link, color: 'info' })
  }
}
</script>

<template>
  <UButton
    label="انسخ رابط التسجيل"
    icon="i-lucide-link"
    color="neutral"
    variant="outline"
    :ui="{ base: 'rounded-[12px] min-h-11' }"
    @click="copyJoinLink"
  />
  <UButton
    label="استمارة التحكيم للطباعة"
    icon="i-lucide-printer"
    color="neutral"
    variant="outline"
    to="/candidates/sheet"
    :ui="{ base: 'rounded-[12px] min-h-11' }"
  />
</template>
