<script setup lang="ts">
/**
 * «مَن شاهد» لرسالةٍ واحدة (طلب المستخدم 2026-10-25): تبويبان — شاهدوها (بوقت المشاهدة، الأسبقُ أوّلاً)
 * ولم يشاهدوها بعد (بالاسم). المستلمون يُجلبون عند الفتح وفي نطاق RLS للقارئ.
 */
import { roleLabel } from '~/constants/roles'
import type { MessageRecipient } from '~/composables/useStaffMessages'
import type { SegmentTab } from '~/components/ui/SegmentTabs.vue'

const props = defineProps<{ title: string, load: () => Promise<MessageRecipient[]> }>()
const open = defineModel<boolean>('open', { required: true })

const rows = ref<MessageRecipient[]>([])
const loading = ref(false)
const tab = ref<'seen' | 'unseen'>('seen')
watch(open, async (o) => {
  if (!o) return
  loading.value = true
  rows.value = await props.load()
  loading.value = false
  tab.value = rows.value.some(r => r.seen_at) ? 'seen' : 'unseen'
})

const byName = (a: MessageRecipient, b: MessageRecipient) => (a.person?.full_name ?? '').localeCompare(b.person?.full_name ?? '', 'ar')
const seen = computed(() => rows.value.filter(r => r.seen_at).sort((a, b) => a.seen_at!.localeCompare(b.seen_at!)))
const unseen = computed(() => rows.value.filter(r => !r.seen_at).sort(byName))
const tabs = computed<SegmentTab<'seen' | 'unseen'>[]>(() => [
  { key: 'seen', label: 'شاهدوها', icon: 'i-lucide-eye', count: seen.value.length },
  { key: 'unseen', label: 'لم يشاهدوها', icon: 'i-lucide-eye-off', count: unseen.value.length }
])
const list = computed(() => (tab.value === 'seen' ? seen.value : unseen.value))

const seenAt = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Asia/Gaza', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
}).replace(',', ' ·')
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    description="مَن شاهد الرسالةَ ومتى، ومَن لم يشاهدها بعد."
  >
    <template #body>
      <UiSkeletonLines
        v-if="loading"
        :fields="5"
      />
      <template v-else>
        <UiSegmentTabs
          v-model="tab"
          :tabs="tabs"
          label="حالة المشاهدة"
        />
        <ul
          :id="`panel-${tab}`"
          role="tabpanel"
          :aria-labelledby="`tab-${tab}`"
          class="sm-list"
        >
          <li
            v-for="(r, i) in list"
            :key="i"
          >
            <span class="sm-name">{{ r.person?.full_name ?? '—' }}
              <small v-if="r.person">{{ roleLabel(r.person.role as never, r.person.gender as never) }}</small>
            </span>
            <bdi
              v-if="r.seen_at"
              dir="ltr"
              class="sm-at"
            >{{ seenAt(r.seen_at) }}</bdi>
          </li>
          <li
            v-if="!list.length"
            class="sm-empty"
          >
            {{ tab === 'seen' ? 'لم يشاهدها أحدٌ بعد.' : 'شاهدها الجميع.' }}
          </li>
        </ul>
      </template>
    </template>
  </UModal>
</template>

<style scoped>
.sm-list { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; max-height: 52vh; overflow-y: auto; }
.sm-list li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 4px; border-bottom: 1px solid var(--line); }
.sm-list li:last-child { border-bottom: none; }
.sm-name { display: flex; flex-direction: column; color: var(--ink); font-size: 14.5px; }
.sm-name small { color: var(--ink-3); font-size: 12.5px; }
.sm-at { color: var(--ink-2); font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sm-empty { justify-content: center !important; color: var(--ink-3); }
</style>
