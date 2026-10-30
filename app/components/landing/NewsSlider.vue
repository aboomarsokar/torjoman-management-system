<script setup lang="ts">
/**
 * سلايدر أخبار صفحة الهبوط (§4.0/§4.26) — يعرض أحدث الأخبار المنشورة بشكل أفقي
 * قابل للتمرير، مع أزرار تنقّل ونقاط مؤشّر. كل بطاقة تفتح شاشة قراءة الخبر
 * الكاملة (`/news/[id]`).
 */
import type { ComponentPublicInstance } from 'vue'

type NewsItem = {
  id: string
  cat: string
  date: string
  title: string
  excerpt: string
  image: string | null
}

const props = defineProps<{ news: NewsItem[] }>()

const trackEl = ref<HTMLElement | null>(null)
const cardEls = ref<(HTMLElement | null)[]>([])
const activeIndex = ref(0)

/** مرجعُ الدالّة يُعطى عنصراً أو مكوّناً (أنواعُ Vue) — والبطاقةُ هنا عنصرُ article دائماً. */
function setCardEl(el: Element | ComponentPublicInstance | null, i: number) {
  cardEls.value[i] = el instanceof HTMLElement ? el : null
}

function goTo(i: number) {
  const clamped = Math.min(Math.max(i, 0), props.news.length - 1)
  activeIndex.value = clamped
  cardEls.value[clamped]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
}
const prev = () => goTo(activeIndex.value - 1)
const next = () => goTo(activeIndex.value + 1)

let observer: IntersectionObserver | null = null
function setupObserver() {
  observer?.disconnect()
  if (!trackEl.value || !cardEls.value.length) return
  observer = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
    if (visible) {
      const idx = cardEls.value.findIndex(el => el === visible.target)
      if (idx !== -1) activeIndex.value = idx
    }
  }, { root: trackEl.value, threshold: [0.6] })
  cardEls.value.forEach(el => el && observer!.observe(el))
}

watch(() => props.news, async () => {
  cardEls.value = []
  await nextTick()
  setupObserver()
}, { immediate: true })

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="slider">
    <div
      ref="trackEl"
      class="track"
    >
      <article
        v-for="(n, i) in news"
        :key="n.id"
        :ref="(el: Element | ComponentPublicInstance | null) => setCardEl(el, i)"
        class="news-card"
      >
        <NuxtLink
          :to="`/news/${n.id}`"
          class="card-link"
        >
          <div class="news-img">
            <img
              v-if="n.image"
              :src="n.image"
              :alt="n.title"
            >
            <UIcon
              v-else
              name="i-lucide-newspaper"
              class="size-10 opacity-40"
            />
          </div>
          <div class="news-body">
            <div class="news-meta">
              <UBadge
                :label="n.cat"
                color="info"
                variant="soft"
                size="sm"
              />
              <span class="news-date">{{ n.date }}</span>
            </div>
            <h3 class="news-title">
              {{ n.title }}
            </h3>
            <p class="news-excerpt">
              {{ n.excerpt }}
            </p>
            <span class="read-more">اقرأ المزيد<UIcon
              name="i-lucide-chevron-left"
              class="size-3.75"
            /></span>
          </div>
        </NuxtLink>
      </article>
    </div>

    <div
      v-if="news.length > 1"
      class="nav"
    >
      <button
        class="nav-btn"
        aria-label="الخبر السابق"
        :disabled="activeIndex === 0"
        @click="prev"
      >
        <UIcon name="i-lucide-chevron-right" />
      </button>
      <div class="dots">
        <button
          v-for="(n, i) in news"
          :key="n.id"
          class="dot"
          :class="{ active: i === activeIndex }"
          :aria-label="`الانتقال إلى الخبر ${i + 1}`"
          @click="goTo(i)"
        />
      </div>
      <button
        class="nav-btn"
        aria-label="الخبر التالي"
        :disabled="activeIndex === news.length - 1"
        @click="next"
      >
        <UIcon name="i-lucide-chevron-left" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.slider {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.track {
  display: flex;
  gap: 22px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  padding-bottom: 2px;
}
.track::-webkit-scrollbar {
  display: none;
}
.news-card {
  flex: 0 0 calc((100% - 44px) / 3);
  scroll-snap-align: start;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow);
  transition: all 0.2s;
}
.news-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
  border-color: var(--blue-soft);
}
.card-link {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: inherit;
}
.news-img {
  height: 150px;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-3);
  overflow: hidden;
}
.news-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.news-body {
  padding: 18px 18px 20px;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.news-meta {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
}
.news-date {
  font-size: 12.5px;
  color: var(--ink-3);
}
.news-title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.45;
  color: var(--ink);
}
.news-excerpt {
  margin: 0 0 14px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--ink-2);
  font-weight: 300;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.read-more {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  font-weight: 600;
  color: var(--blue-ink);
}

.nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
}
.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink-2);
  transition: all 0.2s;
}
.nav-btn:hover:not(:disabled) {
  color: var(--blue-ink);
  border-color: var(--blue-soft);
}
.nav-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.dots {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--line-2);
  transition: all 0.2s;
}
.dot.active {
  width: 22px;
  background: var(--blue-ink);
}

@media (max-width: 980px) {
  .news-card {
    flex: 0 0 calc((100% - 22px) / 2);
  }
}
@media (max-width: 620px) {
  .news-card {
    flex: 0 0 88%;
  }
}
</style>
