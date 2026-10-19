<script setup lang="ts">
/**
 * سحبُ ترشيحٍ بانتظار الرصد (حذفُ بندِه) — للمعلّم في حلقته وللمديرَين، كما يسمح RLS (`items_write`).
 * المرصودُ لا يُسحب: حارسُ القاعدة يردّه برسالته العربيّة فتُعرض كما هي.
 */
import type { Database } from '~/types/database.types'
import type { WithdrawTarget } from '~/utils/exams/nomination'

const target = defineModel<WithdrawTarget | null>('target', { default: null })
const emit = defineEmits<{ withdrawn: [] }>()

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()
const busy = ref(false)

/** القائمةُ التي سُحب آخرُ بنودها تُحذف (lists_delete للمعلّم صاحبها وللمديرَين) — لا تبقى قوائمُ فارغة. */
async function dropEmptyList(listId: string) {
  const { count, error } = await supabase.from('exam_list_items')
    .select('id', { count: 'exact', head: true }).eq('exam_list_id', listId)
  if (error) throw error
  // صفرٌ صريح وحده (حذفُ القائمة يسحب بنودَها معها)
  if (count !== 0) return
  const { error: e2 } = await supabase.from('exam_lists').delete().eq('id', listId)
  if (e2) throw e2
}

async function confirm() {
  if (!target.value) return
  busy.value = true
  try {
    const { data, error } = await supabase.from('exam_list_items').delete().eq('id', target.value.itemId).select('id, exam_list_id')
    if (error) throw error
    // RLS يُسقط الصفّ بصمتٍ لمن لا يملكه: لا حذفَ بلا خطأ
    const listId = data?.[0]?.exam_list_id
    if (!listId) throw new Error('تعذّر سحب الترشيح — ليس لك أن تسحبه أو سُحب من قبل.')
    toast.add({ title: 'سُحب الترشيح.', color: 'neutral', icon: 'i-lucide-undo-2' })
    target.value = null
    emit('withdrawn')
    await dropEmptyList(listId)
  } catch (err) {
    handle(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiConfirmModal
    :open="!!target"
    title="سحب الترشيح"
    confirm-label="سحب الترشيح"
    confirm-icon="i-lucide-undo-2"
    :loading="busy"
    @update:open="v => { if (!v) target = null }"
    @confirm="confirm"
  >
    سحبُ ترشيح «<strong>{{ target?.studentName }}</strong>» لـ{{ target?.cycleTitle }}؟ يعود الطالب قابلاً للترشيح.
  </UiConfirmModal>
</template>
