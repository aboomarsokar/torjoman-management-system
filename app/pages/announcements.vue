<script setup lang="ts">
/**
 * «إشعارات للمعلّمين» (طلب المستخدم 2026-10-25): المديرُ يلفت انتباهَ المعلّمين إلى أمرٍ — عنوانٌ ونصٌّ ورابطٌ
 * اختياريٌّ لصفحةٍ في قائمة المعلّم — فيصل إلى جرس كلِّ معلّمٍ نشطٍ في الجمهور. والسجلُّ تحته بما أُرسل ولمن.
 * المرسِلون كلٌّ لقسمه، ومشرفُ المشروع يقرأ السجلَّ وحدَه.
 */
import {
  ANNOUNCEMENT_LINKS, AUDIENCE_LABELS, AUDIENCES_BY_ROLE, MAX_ANNOUNCEMENT_BODY, MAX_ANNOUNCEMENT_TITLE, type Audience
} from '~/constants/announcements'
import type { AnnouncementDraft } from '~/composables/useTeacherAnnouncements'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'إشعارات للمعلّمين — ترجمان' })

const { profile } = useProfile()
const { isReadOnly } = usePermissions()
const { sent, pending, busy, send } = useTeacherAnnouncements()

const audiences = computed<Audience[]>(() => (profile.value?.role && AUDIENCES_BY_ROLE[profile.value.role]) || [])
const canSend = computed(() => audiences.value.length > 0)
const canView = computed(() => canSend.value || isReadOnly.value)

const blank = (): AnnouncementDraft => ({ title: '', body: '', link: undefined, audience: audiences.value.length === 1 ? audiences.value[0] : undefined })
const form = reactive<AnnouncementDraft>(blank())
watch(audiences, () => Object.assign(form, blank()))

const audienceItems = computed(() => audiences.value.map(a => ({ label: AUDIENCE_LABELS[a], value: a })))
const linkItems = ANNOUNCEMENT_LINKS.map(l => ({ label: l.label, value: l.to }))
const linkLabel = (to: string | null) => ANNOUNCEMENT_LINKS.find(l => l.to === to)?.label ?? to ?? '—'
const audienceLabel = (a: string) => AUDIENCE_LABELS[a as Audience] ?? a

async function submit() {
  if (await send(form) !== null) Object.assign(form, blank())
}

const sentAt = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Asia/Gaza', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
}).replace(',', ' ·')

const columns = [
  { key: 'num', label: '#' },
  { key: 'title', label: 'الإشعار' },
  { key: 'audience', label: 'إلى', class: 'col-aud' },
  { key: 'recipients', label: 'وصل إلى', align: 'center' as const },
  { key: 'when', label: 'أُرسل', class: 'col-when' }
]
</script>

<template>
  <div class="an">
    <UiPageHeader
      title="إشعارات للمعلّمين"
      subtitle="رسالةٌ قصيرة تصل إلى جرس كلّ معلّمٍ ومعلّمة، للفت انتباههم إلى أمرٍ جديد."
    />
    <ClientOnly>
      <UiEmptyState
        v-if="profile && !canView"
        icon="i-lucide-lock"
        title="هذه الصفحة للإدارة."
      />
      <template v-else-if="profile">
        <section
          v-if="canSend"
          class="an-form"
          aria-label="إشعارٌ جديد"
        >
          <UFormField
            label="العنوان"
            :hint="`${form.title.trim().length}/${MAX_ANNOUNCEMENT_TITLE}`"
          >
            <UInput
              v-model="form.title"
              size="xl"
              class="w-full"
              :maxlength="MAX_ANNOUNCEMENT_TITLE"
              placeholder="مثلاً: أُضيفت ميزةُ طلب الملازم من صفحتك"
              :ui="{ base: 'rounded-[12px] min-h-12' }"
            />
          </UFormField>
          <UFormField
            label="التفاصيل (اختياريّة)"
            :hint="`${form.body.trim().length}/${MAX_ANNOUNCEMENT_BODY}`"
          >
            <UTextarea
              v-model="form.body"
              :rows="3"
              autoresize
              class="w-full"
              :maxlength="MAX_ANNOUNCEMENT_BODY"
              placeholder="مثلاً: من قائمتك ← الكشوف ← الملازم، اضغط «اطلب ملازم»."
            />
          </UFormField>
          <div class="an-row">
            <UFormField label="إلى">
              <UiSelect
                v-model="form.audience"
                :items="audienceItems"
                :disabled="audienceItems.length === 1"
                placeholder="اختر الجمهور"
                size="xl"
                class="w-full"
                :ui="{ base: 'rounded-[12px] min-h-12' }"
              />
            </UFormField>
            <UFormField label="يفتح عند الضغط (اختياريّ)">
              <UiSelect
                v-model="form.link"
                :items="linkItems"
                placeholder="بلا صفحة"
                size="xl"
                class="w-full"
                :ui="{ base: 'rounded-[12px] min-h-12' }"
              />
            </UFormField>
          </div>
          <div class="an-actions">
            <UButton
              v-if="form.link"
              label="بلا صفحة"
              color="neutral"
              variant="ghost"
              :ui="{ base: 'rounded-[12px] min-h-11' }"
              @click="form.link = undefined"
            />
            <UButton
              label="أرسل الإشعار"
              icon="i-lucide-send"
              color="primary"
              :loading="busy"
              :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
              @click="submit"
            />
          </div>
        </section>

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
          title="لم يُرسَل إشعارٌ بعد"
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
          <template #audience="{ row }">
            <span class="muted">{{ audienceLabel(row.audience) }}</span>
          </template>
          <template #recipients="{ row }">
            <b class="n">{{ row.recipients }}</b>
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
                { label: 'إلى', value: audienceLabel(row.audience) },
                { label: 'وصل إلى', value: row.recipients },
                { label: 'أُرسل', value: sentAt(row.created_at) },
                ...(row.link ? [{ label: 'يفتح', value: linkLabel(row.link) }] : [])
              ]"
            >
              <template #lead>
                <span class="seq-n">{{ index + 1 }}</span>
              </template>
            </UiCardRow>
          </template>
        </UiDataTable>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.an { max-width: 960px; display: flex; flex-direction: column; gap: 14px; }
.an-form { display: flex; flex-direction: column; gap: 14px; padding: 20px 22px; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.an-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.an-actions { display: flex; justify-content: flex-end; gap: 8px; }
.an-h { margin: 10px 0 0; font-size: 16px; font-weight: 700; color: var(--ink); }
.seq-n { color: var(--ink-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.t { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.t b { color: var(--ink); font-weight: 600; }
.t-body { color: var(--ink-2); font-size: 14px; }
.t-link { display: inline-flex; align-items: center; gap: 5px; color: var(--blue-ink); font-size: 13px; }
.muted { color: var(--ink-2); white-space: nowrap; }
.n { font-size: 16px; color: var(--ink); font-variant-numeric: tabular-nums; }
.when { display: flex; flex-direction: column; gap: 2px; font-size: 13.5px; color: var(--ink-2); white-space: nowrap; }
.when bdi { font-variant-numeric: tabular-nums; }
@media (max-width: 640px) {
  .an-row { grid-template-columns: 1fr; }
  .an-form { padding: 16px; }
}
@container dt (max-width: 760px) {
  :deep(.col-aud) { display: none; }
}
</style>
