<script setup lang="ts">
/**
 * صفحةُ الالتحاق العامّة بمعلّمي ترجمان (طلب المستخدم 2026-10-30): نموذجُ تسجيلٍ بلا حساب، واستعلامٌ عن حالة الطلب.
 * رابطٌ يُنشر للمرشّحين: torjoman.org/join.
 */
import type { SegmentTab } from '~/components/ui/SegmentTabs.vue'

definePageMeta({ layout: false })
useHead({ htmlAttrs: { lang: 'ar', dir: 'rtl' } })
useSeoMeta({
  title: 'الالتحاق بمعلّمي ترجمان — منصة ترجمان القرآنية',
  description: 'سجّل للالتحاق بمعلّمي ومعلّمات منصة ترجمان القرآنية، وتابع حالة طلبك وموعد مقابلتك.'
})

type View = 'register' | 'lookup'
const view = ref<View>('register')
const tabs: SegmentTab<View>[] = [
  { key: 'register', label: 'طلب التحاق', icon: 'i-lucide-user-plus' },
  { key: 'lookup', label: 'حالة طلبي', icon: 'i-lucide-search' }
]
</script>

<template>
  <div class="pub">
    <header class="top">
      <NuxtLink
        to="/"
        class="logo-link"
      >
        <img
          src="/brand/turjuman-full.svg"
          alt="ترجمان"
          class="logo"
        >
      </NuxtLink>
      <UiThemeToggle />
    </header>

    <main class="wrap">
      <h1>الالتحاق بمعلّمي ترجمان</h1>
      <p class="lead">
        منصة ترجمان القرآنية تستقبل طلبات المعلّمين والمعلّمات لحلقات الحفظ والفهم والتدبّر. سجّل بياناتك، وسنتواصل معك لموعد المقابلة.
      </p>
      <section class="card">
        <UiSegmentTabs
          v-model="view"
          :tabs="tabs"
          label="الالتحاق"
          class="tabs"
        />
        <div
          :id="`panel-${view}`"
          role="tabpanel"
          :aria-labelledby="`tab-${view}`"
        >
          <CandidatesJoinForm
            v-if="view === 'register'"
            @lookup="view = 'lookup'"
          />
          <CandidatesStatusLookup v-else />
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.pub { min-height: 100vh; background: var(--bg); color: var(--ink); }
.top { max-width: 760px; margin: 0 auto; padding: 22px 20px; display: flex; align-items: center; justify-content: space-between; }
.logo-link { display: flex; }
.logo { height: 56px; width: auto; filter: var(--logo-filter); }
.wrap { max-width: 760px; margin: 0 auto; padding: 6px 20px 64px; display: flex; flex-direction: column; gap: 14px; }
h1 { margin: 0; font-size: clamp(24px, 4vw, 32px); font-weight: 700; color: var(--ink); text-wrap: balance; }
.lead { margin: 0 0 6px; font-size: 16px; line-height: 1.9; color: var(--ink-2); max-width: 62ch; }
.card { background: var(--surface); border-radius: 20px; box-shadow: var(--shadow-lg); padding: 24px; display: flex; flex-direction: column; gap: 4px; }
.tabs { width: 100%; }
@media (max-width: 560px) {
  .card { padding: 18px 16px; }
  .logo { height: 46px; }
}
</style>
