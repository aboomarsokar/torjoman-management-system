<script setup lang="ts">
/**
 * لوحةُ مدير المحتوى (2026-11-03): بابان — الأخبار (كتابةً ونشراً) وخطةُ القسم (قراءةً، وحالةُ ما أُسند إليه).
 */
const LINKS = [
  { to: '/news', icon: 'i-lucide-newspaper', title: 'الأخبار', text: 'اكتب الأخبار وانشرها على الصفحة العامة، وعدّل المنشور أو أخفه.' },
  { to: '/plan', icon: 'i-lucide-target', title: 'خطة القسم', text: 'اطّلع على أهداف الشهر وأنشطته، وحدّث حالة ما أُسند إليك منها.' }
] as const
</script>

<template>
  <div class="ch">
    <NuxtLink
      v-for="l in LINKS"
      :key="l.to"
      :to="l.to"
      class="ch-card"
    >
      <span class="ch-ico"><UIcon
        :name="l.icon"
        class="size-6"
      /></span>
      <span class="ch-txt">
        <strong>{{ l.title }}</strong>
        <span>{{ l.text }}</span>
      </span>
      <UIcon
        name="i-lucide-chevron-left"
        class="size-5 ch-go"
      />
    </NuxtLink>
  </div>
</template>

<style scoped>
.ch { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.ch-card { display: flex; align-items: center; gap: 14px; padding: 20px 22px; min-height: 44px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); color: var(--ink); text-decoration: none; transition: border-color .15s; }
.ch-card:hover, .ch-card:focus-visible { border-color: var(--blue); outline: none; }
.ch-ico { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex: none; background: var(--blue-soft); color: var(--blue-ink); }
.ch-txt { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.ch-txt strong { font-size: 17px; }
.ch-txt span { font-size: 14px; color: var(--ink-2); line-height: 1.6; }
.ch-go { color: var(--ink-3); flex: none; }
</style>
