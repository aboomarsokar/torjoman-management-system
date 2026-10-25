<script setup lang="ts">
/**
 * «رسائل للكادر» (طلب المستخدم 2026-10-25): المديرُ يراسل مجموعةً من الكادر (المعلّمين والمشرفين الميدانيين
 * والمختبِرين في قسمٍ) أو شخصاً بعينه، فتصل الرسالةُ إلى جرس كلٍّ منهم وإلى صفحة «رسائل الإدارة». وتحت النموذج
 * سجلٌّ بما أُرسل: «شاهدها كذا من كذا»، وبالضغط مَن شاهد ومتى ومَن لم يشاهد. المرسِلون كلٌّ لقسمه، ومشرفُ المشروع يقرأ.
 */
import { audienceLabel, MESSAGE_LINKS, SECTIONS_BY_ROLE, type Section } from '~/constants/announcements'
import { seenCount, type MessageDraft, type SentMessage } from '~/composables/useStaffMessages'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'رسائل للكادر — ترجمان' })

const { profile } = useProfile()
const { isReadOnly } = usePermissions()
const { sent, pending, people, busy, send, recipientsOf } = useStaffMessages()

const sections = computed<Section[]>(() => (profile.value?.role && SECTIONS_BY_ROLE[profile.value.role]) || [])
const canSend = computed(() => sections.value.length > 0)
const canView = computed(() => canSend.value || isReadOnly.value)

async function onSend(d: MessageDraft, reset: () => void) {
  if (await send(d) !== null) reset()
}

const opened = ref<SentMessage | null>(null)
const seenOpen = computed({
  get: () => !!opened.value,
  set: (v) => {
    if (!v) opened.value = null
  }
})

const linkLabel = (to: string) => MESSAGE_LINKS.find(l => l.to === to)?.label ?? to
const toWhom = (m: SentMessage) => m.target?.full_name ?? audienceLabel(m.roles, m.section)
const sentAt = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Asia/Gaza', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
}).replace(',', ' ·')

const columns = [
  { key: 'num', label: '#' },
  { key: 'title', label: 'الرسالة' },
  { key: 'to', label: 'إلى', class: 'col-to' },
  { key: 'seen', label: 'المشاهدة', align: 'center' as const },
  { key: 'when', label: 'أُرسلت', class: 'col-when' }
]
</script>

<template>
  <div class="an">
    <UiPageHeader
      title="رسائل للكادر"
      subtitle="رسالةٌ تصل إلى جرس المعلّمين والمشرفين والمختبِرين وصفحة «رسائل الإدارة» عندهم، وتعرف مَن شاهدها."
    />
    <ClientOnly>
      <UiEmptyState
        v-if="profile && !canView"
        icon="i-lucide-lock"
        title="هذه الصفحة للإدارة."
      />
      <template v-else-if="profile">
        <MessagesComposeForm
          v-if="canSend"
          :sections="sections"
          :people="people ?? []"
          :busy="busy"
          @send="onSend"
        />

        <h2 class="an-h">
          ما أُرسل
        </h2>
        <UiSkeletonTable
          v-if="pending && !sent?.length"
          :columns="columns"
        />
        <UiEmptyState
          v-else-if="!sent?.length"
          icon="i-lucide-megaphone"
          title="لم تُرسَل رسالةٌ بعد"
        />
        <UiDataTable
          v-else
          :columns="columns"
          :rows="sent"
          row-key="id"
        >
          <template #num="{ index }">
            <span class="seq-n">{{ index + 1 }}</span>
          </template>
          <template #title="{ row }">
            <div class="t">
              <b>{{ row.title }}</b>
              <span
                v-if="row.body"
                class="t-body"
              >{{ row.body }}</span>
              <span
                v-if="row.link"
                class="t-link"
              ><UIcon
                name="i-lucide-link"
                class="size-3.5"
              />{{ linkLabel(row.link) }}</span>
            </div>
          </template>
          <template #to="{ row }">
            <span class="muted">{{ toWhom(row) }}</span>
          </template>
          <template #seen="{ row }">
            <UButton
              :label="`${seenCount(row)} من ${row.recipients}`"
              icon="i-lucide-eye"
              color="neutral"
              variant="soft"
              size="sm"
              :aria-label="`مَن شاهد: ${seenCount(row)} من ${row.recipients}`"
              :ui="{ base: 'rounded-[10px] min-h-9 tabular-nums' }"
              @click="opened = row"
            />
          </template>
          <template #when="{ row }">
            <div class="when">
              <bdi dir="ltr">{{ sentAt(row.created_at) }}</bdi>
              <span v-if="row.sender">{{ row.sender.full_name }}</span>
            </div>
          </template>
          <template #card="{ row, index }">
            <UiCardRow
              :title="row.title"
              :subtitle="row.body"
              :fields="[
                { label: 'إلى', value: toWhom(row) },
                { label: 'أُرسلت', value: sentAt(row.created_at) },
                ...(row.link ? [{ label: 'يفتح', value: linkLabel(row.link) }] : [])
              ]"
            >
              <template #lead>
                <span class="seq-n">{{ index + 1 }}</span>
              </template>
              <template #actions>
                <UButton
                  :label="`شاهدها ${seenCount(row)} من ${row.recipients}`"
                  icon="i-lucide-eye"
                  color="neutral"
                  variant="soft"
                  block
                  :ui="{ base: 'rounded-[12px] min-h-11' }"
                  @click="opened = row"
                />
              </template>
            </UiCardRow>
          </template>
        </UiDataTable>

        <MessagesSeenModal
          v-model:open="seenOpen"
          :title="opened?.title ?? ''"
          :load="() => recipientsOf(opened!.id)"
        />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.an { max-width: 1000px; display: flex; flex-direction: column; gap: 14px; }
.an-h { margin: 10px 0 0; font-size: 16px; font-weight: 700; color: var(--ink); }
.seq-n { color: var(--ink-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.t { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.t b { color: var(--ink); font-weight: 600; }
.t-body { color: var(--ink-2); font-size: 14px; }
.t-link { display: inline-flex; align-items: center; gap: 5px; color: var(--blue-ink); font-size: 13px; }
.muted { color: var(--ink-2); font-size: 14px; }
.when { display: flex; flex-direction: column; gap: 2px; font-size: 13.5px; color: var(--ink-2); white-space: nowrap; }
.when bdi { font-variant-numeric: tabular-nums; }
@container dt (max-width: 760px) {
  :deep(.col-to) { display: none; }
}
</style>
