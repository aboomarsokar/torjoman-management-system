<script setup lang="ts">
/**
 * «رسائل الإدارة» للكادر (طلب المستخدم 2026-10-25): كلُّ ما وصله من الإدارة، الأحدثُ أوّلاً، والجديدُ بارزٌ في هذه
 * الزيارة. فتحُ الصفحة يسجّل المشاهدةَ فيعرف المرسِلُ مَن شاهد ومتى (`useMyMessages`)؛ والجرسُ ينبّه فقط.
 */
import { MESSAGE_LINKS, MESSAGE_RECIPIENT_ROLES } from '~/constants/announcements'
import { SCREEN_KEYS } from '~/utils/teacherScreens'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'رسائل الإدارة — ترجمان' })

const { profile } = useProfile()
const isRecipient = computed(() => !!profile.value && MESSAGE_RECIPIENT_ROLES.includes(profile.value.role))
const { messages, pending, freshIds } = useMyMessages()

const linkLabel = (to: string) => MESSAGE_LINKS.find(l => l.to === to)?.label ?? 'افتح الصفحة'
const sentAt = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Asia/Gaza', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
}).replace(',', ' ·')
</script>

<template>
  <div class="mm">
    <UiPageHeader
      title="رسائل الإدارة"
      subtitle="ما أرسلته إليك إدارةُ المشروع، الأحدثُ أوّلاً."
    />
    <OfflineSavedNote :keys="[SCREEN_KEYS.myMessages]" />
    <ClientOnly>
      <UiEmptyState
        v-if="profile && !isRecipient"
        icon="i-lucide-lock"
        title="هذه الصفحة للمعلّمين والمشرفين والمختبِرين."
      />
      <UiSkeletonRow
        v-else-if="pending && !messages?.length"
        :action="false"
      />
      <UiEmptyState
        v-else-if="!messages?.length"
        icon="i-lucide-mail"
        title="لا رسائلَ بعد"
        description="حين تُرسل إليك الإدارةُ رسالةً تظهر هنا ويصلك بها إشعار."
      />
      <ol
        v-else
        class="mm-list"
      >
        <li
          v-for="m in messages"
          :key="m.message!.id"
          class="mm-item"
          :class="{ fresh: freshIds.has(m.message!.id) }"
        >
          <span class="mm-ico"><UIcon
            name="i-lucide-megaphone"
            class="size-5"
          /></span>
          <div class="mm-main">
            <div class="mm-head">
              <h2>{{ m.message!.title }}</h2>
              <UBadge
                v-if="freshIds.has(m.message!.id)"
                label="جديدة"
                color="warning"
                variant="soft"
                size="sm"
              />
            </div>
            <p
              v-if="m.message!.body"
              class="mm-body"
            >
              {{ m.message!.body }}
            </p>
            <div class="mm-foot">
              <span>
                <bdi dir="ltr">{{ sentAt(m.message!.created_at) }}</bdi>
                <template v-if="m.message!.sender"> · {{ m.message!.sender.full_name }}</template>
              </span>
              <UButton
                v-if="m.message!.link"
                :to="m.message!.link"
                :label="linkLabel(m.message!.link)"
                trailing-icon="i-lucide-arrow-left"
                color="primary"
                variant="soft"
                size="sm"
                :ui="{ base: 'rounded-[10px] min-h-9' }"
              />
            </div>
          </div>
        </li>
      </ol>
    </ClientOnly>
  </div>
</template>

<style scoped>
.mm { max-width: 820px; display: flex; flex-direction: column; gap: 14px; }
.mm-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.mm-item { display: flex; gap: 14px; padding: 18px 20px; border-radius: 18px; background: var(--surface); border: 1px solid var(--line); }
.mm-item.fresh { border-color: color-mix(in srgb, var(--ui-warning) 45%, var(--line)); box-shadow: var(--shadow); }
.mm-ico { width: 40px; height: 40px; border-radius: 12px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--blue-soft); color: var(--blue-ink); }
.mm-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.mm-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mm-head h2 { margin: 0; font-size: 16px; font-weight: 600; color: var(--ink); }
.mm-body { margin: 0; color: var(--ink-2); font-size: 14.5px; line-height: 1.8; white-space: pre-line; }
.mm-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 13px; color: var(--ink-3); }
.mm-foot bdi { font-variant-numeric: tabular-nums; }
@media (max-width: 560px) {
  .mm-item { padding: 14px; gap: 10px; }
  .mm-ico { width: 34px; height: 34px; }
}
</style>
