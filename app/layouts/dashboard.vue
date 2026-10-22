<script setup lang="ts">
/**
 * الهيكل العام للوحة (§4.2) — Sidebar (يمين) حسب الدور + Topbar + Drawer للجوال.
 * مشترك بين كل الأدوار العاملة. القوائم تظهر حسب دور المستخدم.
 * المسارات غير المبنيّة بعد تُظهر تنبيه «قيد الإنشاء» (تُربط عند بناء كل شاشة).
 */
import { roleLabel as roleLabelFor, type Role } from '~/constants/roles'
import { queryFromTab, tabFromQuery, type StudentTab } from '~/composables/useStudentTab'

const { profile, role, status, fullName, pending: profilePending } = useProfile()
// صورة صاحب الحساب في الشريطين — أو الحرف الأول (ودائماً الحرف لحساب أنثى)
const { url: myPhotoUrl } = useMyPhoto()
const { signOut } = useAuth()
const toast = useToast()
const route = useRoute()
// النيابةُ تُسأل من الخادم مرّةً لكلّ تحميلٍ كامل، غيرَ حاجزة (الشريطُ يظهر حين تصل)
const { ensureChecked: checkImpersonation, reloadOnIdentityChange } = useImpersonation()
onMounted(() => void checkImpersonation())
// لسانٌ آخر بدأ نيابةً أو أنهاها (الكعكةُ مشتركة) ← إعادةُ تحميل هذا اللسان
reloadOnIdentityChange()

// طرد فوري لأي حساب يُعطَّل أثناء الجلسة (الخيار 1 لإنفاذ التعطيل) — وفي النيابة الحسابُ المعطَّل حسابُ الموظف لا المدير
watch(status, async (s) => {
  if (s === 'disabled') {
    const title = (await checkImpersonation()) ? 'عُطِّل حسابُ الموظف — انتهت النيابة.' : 'تم تعطيل حسابك. تواصل مع الإدارة.'
    toast.add({ title, color: 'error', icon: 'i-lucide-ban' })
    signOut()
  }
}, { immediate: true })

const drawerOpen = ref(false)
/** حاويةُ المحتوى — يقرؤها زرُّ «إلى الأعلى» حين تكون هي المُمرَّرة لا النافذة. */
const contentEl = ref<HTMLElement | null>(null)
function comingSoon() {
  drawerOpen.value = false
  toast.add({ title: 'هذه الشاشة قيد الإنشاء — قريباً.', icon: 'i-lucide-hammer', color: 'info' })
}

/** `tab`: تبويبُ صفحة الطالب (`/me?tab=`) — عناصرُ الطالب تقابل تبويباتِ صفحته (طلب المستخدم 2026-10-21).
 * `group`: مجموعتُه في القائمة (طلب المستخدم 2026-10-22: مجموعاتٌ بعناوين تُطوى)؛ وبلا مجموعةٍ يبقى في الأعلى ظاهراً.
 * `qtab`: تبويبُ صفحةٍ للعاملين في الرابط (`?tab=`) — `null` للتبويب الافتراضيّ؛ و`title` عنوانُ الشريط إن خالف التسمية.
 * `labelF`: التسميةُ بالمؤنّث للمديرة الإدارية — قسمُها كلُّه إناث (قرار المستخدم 2026-10-22). */
type GroupKey = 'people' | 'supervision' | 'quran' | 'programs' | 'exams' | 'sheets' | 'project' | 'account'
type Item = { key: string, label: string, labelF?: string, icon: string, to?: string, tab?: StudentTab, qtab?: string | null, title?: string, roles: Role[], group?: GroupKey }

const GROUPS: { key: GroupKey, label: string, icon: string }[] = [
  { key: 'people', label: 'الحلقات والأفراد', icon: 'i-lucide-users-round' },
  { key: 'supervision', label: 'الإشراف والتقييم', icon: 'i-lucide-shield-check' },
  // كان «المتابعة القرآنية» — تحته الحضورُ ومتابعةُ الرصد كذلك (طلب المستخدم 2026-10-22)
  { key: 'quran', label: 'المتابعة والرصد', icon: 'i-lucide-book-open-text' },
  { key: 'programs', label: 'البرامج المصاحبة', icon: 'i-lucide-library' },
  { key: 'exams', label: 'الاختبارات', icon: 'i-lucide-award' },
  { key: 'sheets', label: 'الكشوف', icon: 'i-lucide-receipt-text' },
  { key: 'project', label: 'إدارة المشروع', icon: 'i-lucide-briefcase' },
  { key: 'account', label: 'الحساب', icon: 'i-lucide-user-cog' }
]

// مجموعات الأدوار — مشرف المشروع (PS) يرى كل شاشة قراءة، والكتابة تُحجب داخل الشاشات (isReadOnly)
const PS: Role = 'project_supervisor'
const ADMIN: Role = 'admin_manager'
const TECH: Role = 'technical_manager'
const WOMEN: Role = 'women_admin'
const FIELD: Role = 'field_supervisor'
const LEADERS: Role[] = [PS, ADMIN, TECH]
const SCOPED_STAFF: Role[] = [...LEADERS, WOMEN, FIELD]

const mainNav: Item[] = [
  { key: 'me', label: 'لوحة التحكم', icon: 'i-lucide-layout-dashboard', to: '/me', tab: 'dashboard', roles: ['student'] },
  { key: 'me-journey', label: 'رحلتي', icon: 'i-lucide-route', to: '/me', tab: 'journey', roles: ['student'] },
  { key: 'me-data', label: 'بياناتي', icon: 'i-lucide-id-card', to: '/me', tab: 'data', roles: ['student'] },
  { key: 'programs', label: 'البرامج المصاحبة', icon: 'i-lucide-library', to: '/programs', roles: ['student'] },
  { key: 'dashboard', label: 'لوحة التحكم', icon: 'i-lucide-layout-dashboard', to: '/dashboard', roles: [...LEADERS, WOMEN, FIELD, 'teacher', 'examiner'] },
  // المدير الفني قائمةً للقراءة (قرار 2026-10-20) — منها «ادخل بحسابه»؛ الأزرارُ الكاتبة للمدير الإداري وحده
  { key: 'users', label: 'إدارة المستخدمين', labelF: 'عاملات القسم', icon: 'i-lucide-users', to: '/users', roles: [PS, ADMIN, TECH, WOMEN] }, // مستقلٌّ بلا مجموعة (طلب المستخدم 2026-10-22)
  { key: 'supervisors', label: 'المشرفون', labelF: 'المشرفات', icon: 'i-lucide-users-round', to: '/supervisors', roles: [...LEADERS, WOMEN], group: 'people' },
  { key: 'halqat', label: 'الحلقات', icon: 'i-lucide-book-open', to: '/halqat', roles: SCOPED_STAFF, group: 'people' },
  // المختبِر: «الحلقات» = اختباراتُ طلاب حلقاته وحدها بتفاصيلها (طلب المستخدم 2026-10-22)
  { key: 'exam-students', label: 'الحلقات', icon: 'i-lucide-book-open', to: '/exams/students', roles: ['examiner'], group: 'people' },
  { key: 'students', label: 'الطلاب', labelF: 'الطالبات', icon: 'i-lucide-graduation-cap', to: '/students', roles: [...SCOPED_STAFF, 'teacher'], group: 'people' },
  // والمعلم يرى زيارات حلقته ونتائجَها ويُقرّ بالاطّلاع (قرار 2026-10-21)
  { key: 'visits', label: 'الزيارات الإشرافية', icon: 'i-lucide-clipboard-check', to: '/visits', roles: [...SCOPED_STAFF, 'teacher'], group: 'supervision' },
  // سجلُّ تقييم الجودة الشهريّ (قرار 2026-10-21): المشرفُ يرصد، والإدارةُ تطّلع، والمعلمُ يرى سجلّه ويُقرّ
  { key: 'quality', label: 'تقييم المعلمين', labelF: 'تقييم المعلمات', icon: 'i-lucide-badge-check', to: '/quality', roles: SCOPED_STAFF, group: 'supervision' },
  { key: 'quality-mine', label: 'تقييمي الشهري', icon: 'i-lucide-badge-check', to: '/quality', roles: ['teacher'], group: 'supervision' },
  { key: 'exams', label: 'الاختبارات', icon: 'i-lucide-square-check-big', to: '/exams', roles: [...SCOPED_STAFF, 'teacher', 'examiner'], group: 'exams' },
  { key: 'examplan', label: 'خطة الاختبارات', icon: 'i-lucide-list-ordered', to: '/exam-plan', roles: [...SCOPED_STAFF, 'teacher', 'examiner'], group: 'exams' },
  // البرامجُ المصاحبة عنوانٌ مستقلّ تحته تبويبا صفحتها (طلب المستخدم 2026-10-22)
  { key: 'programs-progress', label: 'إنجاز الطلاب', labelF: 'إنجاز الطالبات', icon: 'i-lucide-chart-no-axes-column-increasing', to: '/programs', qtab: null, title: 'البرامج المصاحبة', roles: [...SCOPED_STAFF, 'teacher'], group: 'programs' },
  { key: 'programs-units', label: 'المقرّرات', icon: 'i-lucide-book-copy', to: '/programs', qtab: 'units', title: 'البرامج المصاحبة', roles: [...SCOPED_STAFF, 'teacher'], group: 'programs' },
  { key: 'reports', label: 'الإنجاز القرآني', icon: 'i-lucide-book-marked', to: '/reports', roles: [...SCOPED_STAFF, 'teacher'], group: 'quran' },
  // متابعةُ رصد الحضور والشهر القرآنيّ لمعرفة المقصّر (طلب المستخدم 2026-10-22)
  { key: 'follow-up', label: 'متابعة الرصد', icon: 'i-lucide-list-checks', to: '/follow-up', roles: [PS, ADMIN, TECH, WOMEN, FIELD], group: 'quran' },
  { key: 'attendance', label: 'الحضور اليوميّ', icon: 'i-lucide-calendar-check', to: '/attendance', roles: ['admin_manager', 'technical_manager', 'women_admin', 'project_supervisor', 'teacher'], group: 'quran' },
  // بلا المدير الفني (قرار 2026-10-19): المراجعة للمدير الإداري والمديرة الإدارية، ومشرف المشروع اطّلاعاً
  { key: 'incentives', label: 'كشف الحوافز', icon: 'i-lucide-gift', to: '/incentives', roles: [PS, ADMIN, WOMEN, 'teacher'], group: 'sheets' },
  { key: 'transport', label: 'كشف المواصلات', icon: 'i-lucide-bus', to: '/transport', roles: [PS, ADMIN, FIELD, 'examiner'], group: 'sheets' },
  // بلا المشرف الميدانيّ (قرار 2026-10-21): الإصدارُ للمديرَين وحدهما (alerts_insert)
  { key: 'alerts', label: 'التنبيهات الإدارية', icon: 'i-lucide-bell', to: '/alerts', roles: [...LEADERS, WOMEN, 'teacher'], group: 'supervision' }
]

const managerNav: Item[] = [
  { key: 'minutes', label: 'محاضر الاجتماعات', icon: 'i-lucide-notebook-pen', to: '/minutes', roles: [PS, ADMIN], group: 'project' },
  { key: 'booklets', label: 'أرشيف الملازم', icon: 'i-lucide-book-copy', to: '/booklets', roles: [PS, ADMIN], group: 'project' },
  { key: 'finance', label: 'الملف المالي', icon: 'i-lucide-wallet', to: '/finance', roles: [PS, ADMIN], group: 'project' },
  { key: 'news', label: 'الأخبار', icon: 'i-lucide-newspaper', to: '/news', roles: [PS, ADMIN], group: 'project' }
]

// الطالب بلا «ملف شخصي» وظيفيّ: بياناته وكلمة مروره وصورته في «صفحتي» (/me)
const profileItem: Item = { key: 'profile', label: 'الملف الشخصي', icon: 'i-lucide-user', to: '/profile/me', roles: [...SCOPED_STAFF, 'teacher', 'examiner'], group: 'account' }

const allItems = [...mainNav, ...managerNav, profileItem]
const labelOf = (i: Item) => (role.value === 'women_admin' && i.labelF) || i.label
const visibleItems = computed(() => allItems.filter(i => role.value && i.roles.includes(role.value)))
/** ما بلا مجموعة (لوحة التحكم وعناصرُ الطالب) في الأعلى، ثم المجموعاتُ التي فيها ما يظهر لهذا الدور بترتيبها. */
const topItems = computed(() => visibleItems.value.filter(i => !i.group))
const navGroups = computed(() => GROUPS
  .map(g => ({ ...g, items: visibleItems.value.filter(i => i.group === g.key) }))
  .filter(g => g.items.length))

// الطيُّ لكلّ متصفّحٍ وحده (تفضيلٌ لا بيانات)؛ ومجموعةُ الصفحة الحاليّة تبقى مفتوحةً كي لا يختفي البارز
const COLLAPSE_KEY = 'torjoman-nav-collapsed'
const collapsed = ref<Set<GroupKey>>(new Set())
onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '[]') as GroupKey[]
    collapsed.value = new Set(saved)
  } catch { /* تخزينٌ محجوب: كلُّ المجموعات مفتوحة */ }
})
const isOpen = (g: GroupKey) => !collapsed.value.has(g) || activeItem.value?.group === g
function toggleGroup(g: GroupKey) {
  const next = new Set(collapsed.value)
  if (isOpen(g)) next.add(g)
  else next.delete(g)
  collapsed.value = next
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]))
  } catch { /* لا يُحفظ — يبقى للجلسة */ }
}

// المسار أو ما تحته: صفحات التفاصيل (/halqat/<id>، /students/<id>…) تحمل عنوان قسمها وتُبرزه في القائمة
// (الملف الشخصي استثناء: /profile/<id> ملفّ غيرك، فلا يُبرز «الملف الشخصي» إلا لـ/profile/me)
// (وعناصرُ تبويبات الطالب تُطابَق بالتبويب أيضاً: «رحلتي» لا تُبرز «لوحة التحكم» على /me نفسها)
const routeTab = () => (typeof route.query.tab === 'string' ? route.query.tab : null)
const matches = (item: Item) => !!item.to
  && (item.tab
    ? route.path === item.to && tabFromQuery(route.query.tab) === item.tab
    : item.qtab !== undefined
      ? route.path === item.to && routeTab() === item.qtab
      : item.to === route.path || (item.key !== 'profile' && route.path.startsWith(`${item.to}/`)))
const activeItem = computed(() => visibleItems.value
  .filter(matches)
  .reduce<Item | null>((best, i) => (!best || (i.to ?? '').length > (best.to ?? '').length ? i : best), null))
const navTitle = computed(() => {
  if (route.path.startsWith('/profile/') && route.path !== '/profile/me') return 'الملف الشخصي'
  return activeItem.value?.title ?? (activeItem.value ? labelOf(activeItem.value) : 'لوحة التحكم')
})

const roleLabel = computed(() => (role.value ? roleLabelFor(role.value, profile.value?.gender ?? null) : ''))

function go(item: Item) {
  drawerOpen.value = false
  if (item.to && item.tab) navigateTo({ path: item.to, query: { tab: queryFromTab(item.tab) } })
  else if (item.to && item.qtab) navigateTo({ path: item.to, query: { tab: item.qtab } })
  else if (item.to) navigateTo(item.to)
  else comingSoon()
}
// البارزُ واحد: إن طابق المسارَ بندان (/exams و/exams/students) فالأطولُ رابطاً — الأدقّ — وحده
const isActive = (item: Item) => matches(item) && (!!item.tab || item.qtab !== undefined || item.to === activeItem.value?.to)
</script>

<template>
  <div class="shell">
    <!-- Overlay للجوال -->
    <div
      v-if="drawerOpen"
      class="overlay"
      @click="drawerOpen = false"
    />

    <!-- SIDEBAR -->
    <aside
      class="side"
      :class="{ 'side-open': drawerOpen }"
    >
      <div class="side-head">
        <img
          src="/brand/turjuman-full.svg"
          alt="ترجمان"
          class="side-logo"
        >
      </div>

      <nav class="side-nav">
        <ClientOnly>
          <template v-if="profilePending">
            <USkeleton
              v-for="i in 7"
              :key="i"
              class="nav-skel bg-white/10"
            />
          </template>
          <template v-else>
            <button
              v-for="item in topItems"
              :key="item.key"
              class="nav-item"
              :class="{ active: isActive(item) }"
              @click="go(item)"
            >
              <UIcon
                :name="item.icon"
                class="size-5"
              />
              <span>{{ labelOf(item) }}</span>
            </button>

            <section
              v-for="g in navGroups"
              :key="g.key"
              class="nav-sec"
            >
              <button
                type="button"
                class="nav-group"
                :aria-expanded="isOpen(g.key)"
                :aria-controls="`nav-${g.key}`"
                @click="toggleGroup(g.key)"
              >
                <span class="nav-g-label">
                  <UIcon
                    :name="g.icon"
                    class="size-5"
                  />
                  {{ g.label }}
                </span>
                <UIcon
                  name="i-lucide-chevron-down"
                  class="size-4 nav-chev"
                  :class="{ shut: !isOpen(g.key) }"
                />
              </button>
              <div
                v-show="isOpen(g.key)"
                :id="`nav-${g.key}`"
              >
                <button
                  v-for="item in g.items"
                  :key="item.key"
                  class="nav-item"
                  :class="{ active: isActive(item) }"
                  @click="go(item)"
                >
                  <UIcon
                    :name="item.icon"
                    class="size-5"
                  />
                  <span>{{ labelOf(item) }}</span>
                </button>
              </div>
            </section>
          </template>
        </ClientOnly>
      </nav>

      <div class="side-foot">
        <!-- ثابتٌ ما دام التطبيقُ غيرَ مثبَّت (طلب المستخدم 2026-10-22) — يختفي في التطبيق المثبَّت -->
        <PwaInstallButton variant="side" />
        <div class="user-card">
          <div class="user-av">
            <ProfileAvatar
              :name="fullName"
              :photo-url="myPhotoUrl"
            />
          </div>
          <div class="user-meta">
            <div class="user-name">
              {{ fullName }}
            </div>
            <div class="user-role">
              {{ roleLabel }}
            </div>
          </div>
          <button
            class="logout"
            aria-label="تسجيل الخروج"
            @click="signOut"
          >
            <UIcon
              name="i-lucide-log-out"
              class="size-[18px]"
            />
          </button>
        </div>
      </div>
    </aside>

    <!-- MAIN -->
    <div class="main">
      <!-- شريطُ النيابة والترويسة ثابتان معاً أعلى العمود — الشريطُ لا يُخفى في شاشة -->
      <div class="top-stack">
        <ImpersonationBar />
        <header class="topbar">
          <div class="top-start">
            <button
              class="hamburger"
              aria-label="القائمة"
              @click="drawerOpen = true"
            >
              <UIcon
                name="i-lucide-menu"
                class="size-6"
              />
            </button>
            <h1 class="top-title">
              {{ navTitle }}
            </h1>
          </div>
          <div class="top-end">
            <!-- الوضعُ بجانب الجرس (كان في أسفل القائمة الجانبية — 2026-10-22) -->
            <UiThemeToggle />
            <NotificationsBell />
            <div class="top-user">
              <div class="top-usertext">
                <div class="tu-name">
                  {{ fullName }}
                </div>
                <div class="tu-role">
                  {{ roleLabel }}
                </div>
              </div>
              <div class="top-av">
                <ProfileAvatar
                  :name="fullName"
                  :photo-url="myPhotoUrl"
                />
              </div>
            </div>
          </div>
        </header>
      </div>

      <main
        ref="contentEl"
        class="content"
      >
        <slot />
      </main>
      <UiBackToTop :container="contentEl" />
    </div>
  </div>
</template>

<style scoped>
.shell { display: flex; min-height: 100vh; background: var(--bg); color: var(--ink); }

/* SIDEBAR */
/* القائمة الجانبية: عرضٌ يلين بين 236 و274، ورأسٌ وذيلٌ ثابتان، والقائمة وحدها تُمرَّر.
   عناصر القائمة لا تنكمش (flex-shrink: 0) — كانت تنضغط فوق بعضها في الشاشات القصيرة بدل أن تُمرَّر */
.side { width: clamp(236px, 20vw, 274px); flex-shrink: 0; background: var(--side-bg); display: flex; flex-direction: column; height: 100vh; height: 100dvh; position: sticky; top: 0; }
.side-head { flex-shrink: 0; padding: 22px 22px 18px; display: flex; align-items: center; border-bottom: 1px solid var(--side-line); }
.side-logo { height: 52px; width: auto; filter: brightness(0) invert(1); }
.side-nav { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 12px 12px 16px; display: flex; flex-direction: column; gap: 2px; scrollbar-width: thin; scrollbar-color: var(--side-line) transparent; }
.side-nav > * { flex-shrink: 0; }
.side-nav::-webkit-scrollbar { width: 6px; }
.side-nav::-webkit-scrollbar-thumb { background: var(--side-line); border-radius: 6px; }
.nav-group { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 44px; margin-top: 8px; font-size: 15px; font-weight: 600; color: var(--side-strong); padding: 4px 14px; background: none; border: 0; border-radius: 11px; font-family: inherit; cursor: pointer; text-align: start; }
.nav-group:hover { background: var(--side-hover); }
.nav-group:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
.nav-g-label { display: inline-flex; align-items: center; gap: 12px; }
.nav-chev { transition: transform .18s; }
.nav-chev.shut { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .nav-chev { transition: none; } }
.nav-item { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 14px; border-radius: 11px; background: transparent; border: none; color: var(--side-ink); font-size: 15px; font-weight: 500; font-family: inherit; cursor: pointer; width: 100%; text-align: start; transition: background .15s, color .15s; }
.nav-item > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-item > :first-child { flex-shrink: 0; }
.nav-item:focus-visible { outline: 2px solid var(--side-strong); outline-offset: -2px; }
.nav-item:hover { background: var(--side-hover); color: var(--side-strong); }
.nav-item.active { background: var(--side-active); color: var(--side-strong); }
.nav-skel { height: 44px; border-radius: 11px; margin: 1.5px 0; }
.side-foot { flex-shrink: 0; padding: 12px; border-top: 1px solid var(--side-line); display: flex; flex-direction: column; gap: 6px; }
.user-card { display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: 12px; background: rgba(255, 255, 255, .06); }
.user-av { width: 38px; height: 38px; border-radius: 11px; background: #fff; color: var(--navy); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex-shrink: 0; overflow: hidden; }
.user-meta { min-width: 0; flex: 1; }
.user-name { font-size: 14.5px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-role { font-size: 12px; color: var(--side-ink); }
.logout { width: 32px; height: 32px; border-radius: 9px; border: none; background: transparent; color: var(--side-ink); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; }
.logout:hover { color: #fff; background: rgba(255, 255, 255, .1); }

/* MAIN */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.top-stack { flex-shrink: 0; position: sticky; top: 0; z-index: 20; }
.topbar { height: 76px; background: var(--surface); border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; padding: 0 32px; }
.top-start { display: flex; align-items: center; gap: 13px; min-width: 0; }
.hamburger { display: none; width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-2); align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
.top-title { font-size: 22px; font-weight: 700; margin: 0; color: var(--ink); white-space: nowrap; }
.top-end { display: flex; align-items: center; gap: 16px; }

.top-user { display: flex; align-items: center; gap: 11px; }
.top-usertext { text-align: start; }
.tu-name { font-size: 14.5px; font-weight: 600; color: var(--ink); line-height: 1.2; }
.tu-role { font-size: 12.5px; color: var(--ink-3); }
.top-av { width: 42px; height: 42px; border-radius: 12px; background: var(--navy); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 700; overflow: hidden; }
/* --content-pad يقرؤه .page-leave-active في main.css ليبقى موضع الصفحة المغادرة مطابقاً لحشوة المحتوى */
/* القاعُ أوسع بقدر زرّ «إلى الأعلى» (44 + هامشه) كي يُمرَّر آخرُ عنصرٍ — كأزرار الترقيم يساراً — فوقه لا تحته */
.content { --content-pad: 24px; flex: 1; overflow-y: auto; padding: var(--content-pad); padding-bottom: calc(var(--content-pad) + 60px); background: var(--bg); position: relative; }

/* RESPONSIVE */
.overlay { display: none; }
/* الشاشات القصيرة (حاسوبٌ محمول 768px وما دونه ارتفاعاً): كثافةٌ أعلى كي تتّسع القائمة بلا تمرير غالباً */
@media (max-height: 860px) {
  .side-head { padding: 14px 20px 12px; }
  .side-logo { height: 42px; }
  .nav-item { min-height: 40px; font-size: 14.5px; }
  .nav-group { margin-top: 6px; }
  .side-foot { padding: 10px 12px; }
  .side-foot .nav-item { min-height: 38px; }
  .user-card { padding: 6px 8px; }
  .user-av { width: 34px; height: 34px; }
}
@media (max-width: 1024px) {
  .side { position: fixed; top: 0; right: 0; width: min(300px, 86vw); height: 100vh; height: 100dvh; transform: translateX(106%); box-shadow: -18px 0 50px rgba(0, 0, 0, .28); z-index: 60; transition: transform .28s cubic-bezier(.22, 1, .36, 1); }
  .side.side-open { transform: translateX(0); }
  .hamburger { display: flex; }
  .overlay { display: block; position: fixed; inset: 0; background: rgba(2, 15, 25, .5); z-index: 55; }
}
@media (max-width: 620px) {
  .topbar { padding: 0 16px; }
  .content { --content-pad: 16px; }
  .top-usertext { display: none; }
}
</style>
