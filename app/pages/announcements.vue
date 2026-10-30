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

/** النصُّ الطويل يُقصَّ في السجلّ على ثلاثة أسطر، و«المزيد» يفتحه (تحسين 2026-10-30). */
const expanded = ref(new Set<string>())
function toggleBody(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}
const BODY_PREVIEW = 160
const isLong = (body: string | null) => (body?.length ?? 0) > BODY_PREVIEW
const bodyPreview = (m: SentMessage) => !m.body || expanded.value.has(m.id) || !isLong(m.body) ? m.body : `${m.body.slice(0, BODY_PREVIEW).trimEnd()}…`
/** المشاهدةُ اكتملت أم بقي من لم يشاهد. */
const seenTone = (m: SentMessage) => m.recipients > 0 && seenCount(m) >= m.recipients ? 'success' : 'neutral'

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
        <div
          class="an-grid"
          :class="{ solo: !canSend }"
        >
          <MessagesComposeForm
            v-if="canSend"
            class="an-compose"
            :sections="sections"
            :people="people ?? []"
            :busy="busy"
            @send="onSend"
          />
          <section
            class="an-log"
            aria-labelledby="an-log-h"
          >
            <h2
              id="an-log-h"
              class="an-h"
            >
              ما أُرسل
              <span
                v-if="sent?.length"
                class="an-count"
              >{{ sent.length }}</span>
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
                  <template v-if="row.body">
                    <span
                      class="t-body"
                      :class="{ clamp: !expanded.has(row.id) }"
                    >{{ row.body }}</span>
                    <button
                      v-if="isLong(row.body)"
                      type="button"
                      class="t-more"
                      :aria-expanded="expanded.has(row.id)"
                      @click="toggleBody(row.id)"
                    >
                      {{ expanded.has(row.id) ? 'أقلّ' : 'المزيد' }}
                    </button>
                  </template>
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
                  :icon="seenTone(row) === 'success' ? 'i-lucide-check-check' : 'i-lucide-eye'"
                  :color="seenTone(row)"
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
                  :subtitle="bodyPreview(row) ?? undefined"
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
                    <div class="card-actions">
                      <UButton
                        v-if="isLong(row.body)"
                        :label="expanded.has(row.id) ? 'أقلّ' : 'اقرأ الرسالة كاملة'"
                        :icon="expanded.has(row.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                        color="neutral"
                        variant="ghost"
                        block
                        :ui="{ base: 'rounded-[12px] min-h-11' }"
                        @click="toggleBody(row.id)"
                      />
                      <UButton
                        :label="`شاهدها ${seenCount(row)} من ${row.recipients}`"
                        :icon="seenTone(row) === 'success' ? 'i-lucide-check-check' : 'i-lucide-eye'"
                        :color="seenTone(row)"
                        variant="soft"
                        block
                        :ui="{ base: 'rounded-[12px] min-h-11' }"
                        @click="opened = row"
                      />
                    </div>
                  </template>
                </UiCardRow>
              </template>
            </UiDataTable>
          </section>
        </div>

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
.an { display: flex; flex-direction: column; gap: 14px; }
/* الشاشةُ العريضة: النموذجُ ثابتٌ يميناً والسجلُّ بجانبه، فلا تبقى مساحةٌ فارغة (تحسين 2026-10-30) */
.an-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; align-items: start; }
.an-log { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.an-h { margin: 4px 0 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: var(--ink); }
.an-count {
  min-width: 26px; padding: 1px 8px; border-radius: 999px; background: var(--surface-3); color: var(--ink-2);
  font-size: 12.5px; font-weight: 700; text-align: center; font-variant-numeric: tabular-nums;
}
@media (min-width: 1280px) {
  .an-grid:not(.solo) { grid-template-columns: minmax(400px, 460px) minmax(0, 1fr); }
  .an-compose { position: sticky; top: 96px; }
}
.seq-n { color: var(--ink-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.t { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.t b { color: var(--ink); font-weight: 600; }
.t-body { color: var(--ink-2); font-size: 14px; line-height: 1.75; white-space: pre-line; }
.t-body.clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.t-more {
  align-self: flex-start; padding: 0; border: 0; background: none; font: inherit; font-size: 13px; font-weight: 600;
  color: var(--blue-ink); cursor: pointer; min-height: 28px;
}
.t-more:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 4px; }
.t-link { display: inline-flex; align-items: center; gap: 5px; color: var(--blue-ink); font-size: 13px; }
.card-actions { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.muted { color: var(--ink-2); font-size: 14px; }
.when { display: flex; flex-direction: column; gap: 2px; font-size: 13.5px; color: var(--ink-2); white-space: nowrap; }
.when bdi { font-variant-numeric: tabular-nums; }
@container dt (max-width: 760px) {
  :deep(.col-to) { display: none; }
}
</style>
