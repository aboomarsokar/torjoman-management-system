<script setup lang="ts">
/**
 * صفحة قراءة الخبر العامّة (§4.26) — رابط مستقل قابل للمشاركة والفهرسة.
 * تعرض خبراً منشوراً واحداً بشاشة كبيرة؛ الوصول عبر Landing («اقرأ المزيد»).
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: false })

const route = useRoute()
const id = computed(() => String(route.params.id))

const supabase = useSupabaseClient<Database>()
const { data: item, error } = await useAsyncData(`news-${id.value}`, async () => {
  const { data } = await supabase
    .from('news')
    .select('id, title, body, category, image_url, news_date')
    .eq('id', id.value)
    .eq('published', true)
    .maybeSingle()
  return data
})

const site = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
const seoTitle = computed(() => item.value ? `${item.value.title} — ترجمان` : 'خبر — ترجمان')
const seoDesc = computed(() => item.value?.body?.slice(0, 160) || 'خبر من أخبار ترجمان.')

useSeoMeta({
  title: seoTitle,
  description: seoDesc,
  ogType: 'article',
  ogTitle: seoTitle,
  ogDescription: seoDesc,
  ogUrl: () => site + route.fullPath,
  ogImage: () => item.value?.image_url || site + '/og-image.png',
  twitterCard: 'summary_large_image',
  twitterTitle: seoTitle,
  twitterDescription: seoDesc
})

const dateLabel = computed(() => item.value
  ? new Date(item.value.news_date).toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })
  : '')
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
      <!-- فاتح ← ليلي ← حسب النظام، كسائر المنصّة -->
      <UiThemeToggle />
    </header>

    <main class="wrap">
      <div
        v-if="error || !item"
        class="card err"
      >
        <UIcon
          name="i-lucide-newspaper"
          class="size-9"
        />
        <h1>الخبر غير متاح</h1>
        <p>قد يكون الرابط غير صحيح أو الخبر لم يعد منشوراً.</p>
        <UButton
          to="/#news"
          label="العودة إلى الأخبار"
          color="primary"
          :ui="{ base: 'rounded-xl font-semibold' }"
        />
      </div>

      <article
        v-else
        class="card"
      >
        <NuxtLink
          to="/#news"
          class="back"
        >
          <UIcon name="i-lucide-arrow-right" />العودة إلى الأخبار
        </NuxtLink>

        <div
          v-if="item.image_url"
          class="cover"
        >
          <img
            :src="item.image_url"
            :alt="item.title"
          >
        </div>

        <div class="meta">
          <UBadge
            :label="item.category || 'عام'"
            color="info"
            variant="soft"
            size="sm"
          />
          <span class="date">{{ dateLabel }}</span>
        </div>

        <h1 class="title">
          {{ item.title }}
        </h1>

        <p class="body">
          {{ item.body }}
        </p>
      </article>
    </main>
  </div>
</template>

<style scoped>
.pub { min-height: 100vh; background: var(--bg); color: var(--ink); }
.top { max-width: 760px; margin: 0 auto; padding: 22px 20px; display: flex; align-items: center; justify-content: space-between; }
.logo-link { display: flex; }
.logo { height: 56px; width: auto; filter: var(--logo-filter); }
.wrap { max-width: 760px; margin: 0 auto; padding: 10px 20px 64px; }

.card { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; box-shadow: var(--shadow-lg); padding: 32px; }
.err { text-align: center; color: var(--ink-2); display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 56px 28px; }
.err h1 { margin: 0; font-size: 22px; font-weight: 700; color: var(--ink); }
.err p { margin: 0; font-size: 15px; line-height: 1.8; font-weight: 300; max-width: 380px; }

.back { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: var(--blue-ink); margin-bottom: 22px; }

.cover { border-radius: 16px; overflow: hidden; margin-bottom: 24px; background: var(--surface-3); }
.cover img { width: 100%; max-height: 420px; object-fit: cover; display: block; }

.meta { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.date { font-size: 13px; color: var(--ink-3); }

.title { margin: 0 0 22px; font-size: clamp(26px, 4vw, 34px); font-weight: 700; line-height: 1.35; color: var(--ink); }

.body { margin: 0; font-size: 18px; line-height: 2.1; font-weight: 300; color: var(--ink-2); white-space: pre-line; }

@media (max-width: 620px) {
  .card { padding: 22px; }
}
</style>
