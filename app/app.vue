<script setup lang="ts">
/**
 * جذر التطبيق — NuxtLayout يطبّق التخطيط حسب الصفحة.
 * Landing والدخول: layout=false (واجهة كاملة خاصة). لوحة التحكم: layout=dashboard (Shell).
 * اللغة والاتجاه (ar/rtl) مضبوطان في nuxt.config للصفحة، و`locale` هنا لمكوّنات Nuxt UI نفسها:
 * بدونه تعمل كلّها LTR بنصوصٍ إنجليزية («Close»، اتجاه القوائم، التقويم معكوس).
 */
import { ar } from '@nuxt/ui/locale'
</script>

<template>
  <UApp :locale="ar">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <PwaInstallBanner />
    <PwaUpdateProgress />
  </UApp>
</template>
