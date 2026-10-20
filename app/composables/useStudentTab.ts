/**
 * تبويبُ صفحة الطالب في الرابط (`?tab=journey|data`؛ والأولُ بلا معامل) — فيبقى بعد التحديث، ويُرسَل الرابطُ
 * على تبويبه. مشتركٌ بين «صفحتي» وملفّ الطالب عند العاملين.
 */
export type StudentTab = 'dashboard' | 'journey' | 'data'

const TABS: StudentTab[] = ['dashboard', 'journey', 'data']

/** قيمةُ المعامل ← التبويب؛ المجهولُ والغائب ← لوحة التحكم. */
export function tabFromQuery(value: unknown): StudentTab {
  return TABS.find(t => t === value) ?? 'dashboard'
}

/** التبويب ← المعامل؛ الأولُ يُحذف من الرابط. */
export function queryFromTab(tab: StudentTab): string | undefined {
  return tab === 'dashboard' ? undefined : tab
}

export function useStudentTab() {
  const route = useRoute()
  const router = useRouter()
  return computed<StudentTab>({
    get: () => tabFromQuery(route.query.tab),
    set: (v) => {
      void router.replace({ query: { ...route.query, tab: queryFromTab(v) } })
    }
  })
}
