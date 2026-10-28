<script setup lang="ts">
/**
 * «محادثة جديدة» (طلب المستخدم 2026-10-27): من يحقّ لي محادثتُه وحده (من القاعدة)، بالبحث بالاسم وحالةِ كلٍّ
 * (متصل الآن / آخر ظهور). الاختيارُ يبدأ المحادثة أو يفتح القائمةَ منها.
 */
import type { ChatContact } from '~/composables/useChat'
import { roleLabel } from '~/constants/roles'
import { isOnline, lastSeenLabel } from '~/utils/chat'
import { searchKey } from '~/utils/arabicSearch'

defineProps<{ now: number }>()
const emit = defineEmits<{ pick: [id: string] }>()
const open = defineModel<boolean>('open', { required: true })
const { contacts } = useChatList()

const list = ref<ChatContact[]>([])
const loading = ref(false)
const q = ref('')
watch(open, async (o) => {
  if (!o) return
  q.value = ''
  loading.value = true
  list.value = await contacts()
  loading.value = false
})
const shown = computed(() => {
  const needle = searchKey(q.value.trim())
  return needle ? list.value.filter(c => searchKey(c.full_name).includes(needle)) : list.value
})
</script>

<template>
  <UModal
    v-model:open="open"
    title="محادثة جديدة"
  >
    <template #body>
      <div class="nc">
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="ابحث بالاسم"
          size="xl"
          class="w-full"
          :ui="{ base: 'rounded-[12px] min-h-12' }"
        />
        <p
          v-if="loading"
          class="nc-note"
        >
          جارٍ التحميل…
        </p>
        <p
          v-else-if="!shown.length"
          class="nc-note"
        >
          لا أحدَ بهذا الاسم ممّن تستطيع محادثتهم.
        </p>
        <ul
          v-else
          class="nc-list"
        >
          <li
            v-for="c in shown"
            :key="c.id"
          >
            <button
              type="button"
              class="nc-item"
              @click="emit('pick', c.id)"
            >
              <span class="nc-av">
                <ProfileAvatar
                  :name="c.full_name"
                  :zoomable="false"
                />
              </span>
              <span class="nc-main">
                <b>{{ c.full_name }}</b>
                <span>{{ roleLabel(c.role as never, c.gender as never) }} · <em :class="{ on: isOnline(c.last_seen_at, now) }">{{ lastSeenLabel(c.last_seen_at, now) }}</em></span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.nc { display: flex; flex-direction: column; gap: 12px; }
.nc-note { margin: 12px 0; text-align: center; color: var(--ink-3); }
.nc-list { list-style: none; margin: 0; padding: 0; max-height: 60vh; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.nc-item { width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 12px; text-align: start; min-height: 56px; cursor: pointer; }
.nc-item:hover { background: var(--surface-2); }
.nc-av { flex: none; width: 40px; height: 40px; border-radius: 999px; overflow: hidden; background: var(--blue-soft); color: var(--blue-ink); display: grid; place-items: center; }
.nc-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.nc-main b { color: var(--ink); font-weight: 600; }
.nc-main span { font-size: 12px; color: var(--ink-3); }
.nc-main em { font-style: normal; }
.nc-main em.on { color: var(--green-ink); font-weight: 600; }
</style>
