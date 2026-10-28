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

// ── جدولُ الرسائل و«عرض» (طلب المستخدم 2026-10-28): العنوانُ والتاريخُ ظاهران، والنصُّ في نافذته ──
type Row = { id: string, title: string, body: string | null, link: string | null, date: string, sender: string | null, fresh: boolean }
const columns = [
  { key: 'title', label: 'الرسالة' },
  { key: 'date', label: 'التاريخ' },
  { key: 'sender', label: 'المرسِل', class: 'col-sender' },
  { key: 'actions', label: '', align: 'end' as const }
]
const rows = computed<Row[]>(() => (messages.value ?? []).filter(m => m.message).map(m => ({
  id: m.message!.id,
  title: m.message!.title,
  body: m.message!.body,
  link: m.message!.link,
  date: sentAt(m.message!.created_at),
  sender: m.message!.sender?.full_name ?? null,
  fresh: freshIds.value.has(m.message!.id)
})))
const viewing = ref<Row | null>(null)
const viewOpen = computed({
  get: () => viewing.value !== null,
  set: (v) => {
    if (!v) viewing.value = null
  }
})
const open = (r: Row) => {
  viewing.value = r
}
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
      <!-- جدولٌ بالعنوان والتاريخ و«عرض» (طلب المستخدم 2026-10-28)، وعلى الجوال بطاقاتٌ والتاريخُ تحت العنوان -->
      <UiDataTable
        v-else
        :columns="columns"
        :rows="rows"
        row-key="id"
        :row-class="(r: Row) => (r.fresh ? 'is-fresh' : undefined)"
      >
        <template #title="{ row }">
          <span class="t-cell">
            <span class="t-title">{{ row.title }}</span>
            <UBadge
              v-if="row.fresh"
              label="جديدة"
              color="warning"
              variant="soft"
              size="sm"
            />
          </span>
        </template>
        <template #date="{ row }">
          <bdi
            dir="ltr"
            class="t-date"
          >{{ row.date }}</bdi>
        </template>
        <template #sender="{ row }">
          <span class="muted">{{ row.sender ?? '—' }}</span>
        </template>
        <template #actions="{ row }">
          <UButton
            label="عرض"
            icon="i-lucide-eye"
            color="neutral"
            variant="outline"
            :ui="{ base: 'rounded-[10px] min-h-10' }"
            @click="open(row)"
          />
        </template>
        <template #card="{ row }">
          <UiCardRow
            :title="row.title"
            :subtitle="row.date"
            subtitle-dir="ltr"
          >
            <template
              v-if="row.fresh"
              #badge
            >
              <UBadge
                label="جديدة"
                color="warning"
                variant="soft"
                size="sm"
              />
            </template>
            <template #actions>
              <UButton
                label="عرض"
                icon="i-lucide-eye"
                color="neutral"
                variant="outline"
                block
                :ui="{ base: 'rounded-[12px] min-h-11 justify-center' }"
                @click="open(row)"
              />
            </template>
          </UiCardRow>
        </template>
      </UiDataTable>
    </ClientOnly>

    <!-- الرسالةُ كاملةً -->
    <!-- العنوانُ الطويلُ يفسح لزرّ الإغلاق (لقطة الجوال 2026-10-28: كان «✕» فوق آخره) -->
    <UModal
      v-model:open="viewOpen"
      :title="viewing?.title ?? ''"
      :ui="{ title: 'pe-10 leading-relaxed' }"
    >
      <template #body>
        <div
          v-if="viewing"
          class="mv"
        >
          <p class="mv-meta">
            <bdi dir="ltr">{{ viewing.date }}</bdi><template v-if="viewing.sender">
              · {{ viewing.sender }}
            </template>
          </p>
          <p
            v-if="viewing.body"
            class="mv-body"
          >
            {{ viewing.body }}
          </p>
          <UButton
            v-if="viewing.link"
            :to="viewing.link"
            :label="linkLabel(viewing.link)"
            trailing-icon="i-lucide-arrow-left"
            color="primary"
            variant="soft"
            :ui="{ base: 'rounded-[12px] min-h-11 self-start' }"
            @click="viewOpen = false"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.mm { display: flex; flex-direction: column; gap: 14px; }
.t-cell { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.t-title { font-weight: 600; color: var(--ink); }
.t-date { font-variant-numeric: tabular-nums; color: var(--ink-2); white-space: nowrap; }
.muted { color: var(--ink-3); }
.mm :deep(tr.is-fresh) { background: color-mix(in srgb, var(--ui-warning) 7%, transparent); }
/* المرسِلُ يسقط على العرض المتوسّط: العنوانُ والتاريخُ أولى */
@container dt (max-width: 820px) {
  .mm :deep(.col-sender) { display: none; }
}
.mv { display: flex; flex-direction: column; gap: 12px; }
.mv-meta { margin: 0; font-size: 13.5px; color: var(--ink-3); }
.mv-meta bdi { font-variant-numeric: tabular-nums; }
.mv-body { margin: 0; color: var(--ink); font-size: 15px; line-height: 1.9; white-space: pre-line; }
</style>
