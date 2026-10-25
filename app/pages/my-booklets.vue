<script setup lang="ts">
/**
 * «الملازم» للمعلّم (طلب المستخدم 2026-10-25): خلاصةٌ وجدولا التسليمات وطلباتِه (`BookletsTeacherHistory`)،
 * وزرُّ «اطلب ملازم». والبطاقةُ المختصرة تبقى في لوحته.
 */
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الملازم — ترجمان' })

const supabase = useSupabaseClient()
const { profile } = useProfile()
const { isTeacher } = usePermissions()

const { data: halaqa, pending } = useLazyAsyncData('my-booklets-halaqa', async () => {
  const me = profile.value?.id
  if (!me) return null
  const { data } = await supabase.from('halaqat').select('id, name').eq('teacher_id', me).limit(1).maybeSingle()
  return data
}, { server: false, default: () => null, watch: [() => profile.value?.id] })
</script>

<template>
  <div class="mb">
    <UiPageHeader
      title="الملازم"
      subtitle="ما استلمته حلقتُك من ملازم المشروع، وطلبُ ما تحتاجه."
    />
    <ClientOnly>
      <UiEmptyState
        v-if="profile && !isTeacher"
        icon="i-lucide-lock"
        title="هذه الصفحة للمعلّمين."
        description="أرشيفُ الملازم كلُّه في «إدارة المشروع ← أرشيف الملازم»."
      />
      <UiSkeletonRow
        v-else-if="pending && !halaqa"
        :action="false"
      />
      <UiEmptyState
        v-else-if="!halaqa"
        icon="i-lucide-book-open"
        title="لا حلقة معيّنة لك بعد"
        description="تواصل مع الإدارة لإسناد حلقتك."
      />
      <BookletsTeacherHistory
        v-else
        :halaqa-id="halaqa.id"
      />
    </ClientOnly>
  </div>
</template>

<style scoped>
.mb { max-width: 900px; }
</style>
