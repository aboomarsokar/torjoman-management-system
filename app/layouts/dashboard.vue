<script setup lang="ts">
/**
 * الهيكل العام للوحة (§4.2) — Sidebar (يمين) حسب الدور + Topbar + Drawer للجوال.
 * مشترك بين كل الأدوار العاملة. القوائم تظهر حسب دور المستخدم.
 * المسارات غير المبنيّة بعد تُظهر تنبيه «قيد الإنشاء» (تُربط عند بناء كل شاشة).
 */
import { roleLabel as roleLabelFor, type Role } from '~/constants/roles'

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

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

const drawerOpen = ref(false)
function comingSoon() {
  drawerOpen.value = false
  toast.add({ title: 'هذه الشاشة قيد الإنشاء — قريباً.', icon: 'i-lucide-hammer', color: 'info' })
}

type Item = { key: string, label: string, icon: string, to?: string, roles: Role[] }

// مجموعات الأدوار — مشرف المشروع (PS) يرى كل شاشة قراءة، والكتابة تُحجب داخل الشاشات (isReadOnly)
const PS: Role = 'project_supervisor'
const ADMIN: Role = 'admin_manager'
const TECH: Role = 'technical_manager'
const WOMEN: Role = 'women_admin'
const FIELD: Role = 'field_supervisor'
const LEADERS: Role[] = [PS, ADMIN, TECH]
const SCOPED_STAFF: Role[] = [...LEADERS, WOMEN, FIELD]

const mainNav: Item[] = [
  { key: 'me', label: 'صفحتي', icon: 'i-lucide-house', to: '/me', roles: ['student'] },
  { key: 'dashboard', label: 'لوحة التحكم', icon: 'i-lucide-layout-dashboard', to: '/dashboard', roles: [...LEADERS, FIELD, 'teacher'] },
  // المدير الفني قائمةً للقراءة (قرار 2026-10-20) — منها «ادخل بحسابه»؛ الأزرارُ الكاتبة للمدير الإداري وحده
  { key: 'users', label: 'إدارة المستخدمين', icon: 'i-lucide-users', to: '/users', roles: [PS, ADMIN, TECH] },
  { key: 'supervisors', label: 'المشرفون', icon: 'i-lucide-users-round', to: '/supervisors', roles: LEADERS },
  { key: 'halqat', label: 'الحلقات', icon: 'i-lucide-book-open', to: '/halqat', roles: SCOPED_STAFF },
  { key: 'students', label: 'الطلاب', icon: 'i-lucide-graduation-cap', to: '/students', roles: [...SCOPED_STAFF, 'teacher'] },
  { key: 'visits', label: 'الزيارات الإشرافية', icon: 'i-lucide-clipboard-check', to: '/visits', roles: SCOPED_STAFF },
  { key: 'exams', label: 'الاختبارات', icon: 'i-lucide-square-check-big', to: '/exams', roles: [...SCOPED_STAFF, 'teacher', 'examiner'] },
  { key: 'examplan', label: 'خطة الاختبارات', icon: 'i-lucide-list-ordered', to: '/exam-plan', roles: [...SCOPED_STAFF, 'teacher', 'examiner'] },
  { key: 'reports', label: 'الإنجاز القرآني', icon: 'i-lucide-book-marked', to: '/reports', roles: [...SCOPED_STAFF, 'teacher'] },
  { key: 'attendance', label: 'الحضور اليوميّ', icon: 'i-lucide-calendar-check', to: '/attendance', roles: ['admin_manager', 'technical_manager', 'women_admin', 'project_supervisor', 'teacher'] },
  // بلا المدير الفني (قرار 2026-10-19): المراجعة للمدير الإداري والمديرة الإدارية، ومشرف المشروع اطّلاعاً
  { key: 'incentives', label: 'كشف الحوافز', icon: 'i-lucide-gift', to: '/incentives', roles: [PS, ADMIN, WOMEN, 'teacher'] },
  { key: 'transport', label: 'كشف المواصلات', icon: 'i-lucide-bus', to: '/transport', roles: [PS, ADMIN, FIELD, 'examiner'] },
  // بلا المشرف الميدانيّ (قرار 2026-10-21): الإصدارُ للمديرَين وحدهما (alerts_insert)
  { key: 'alerts', label: 'التنبيهات الإدارية', icon: 'i-lucide-bell', to: '/alerts', roles: [...LEADERS, WOMEN, 'teacher'] }
]

const managerNav: Item[] = [
  { key: 'minutes', label: 'محاضر الاجتماعات', icon: 'i-lucide-notebook-pen', to: '/minutes', roles: [PS, ADMIN] },
  { key: 'finance', label: 'الملف المالي', icon: 'i-lucide-wallet', to: '/finance', roles: [PS, ADMIN] },
  { key: 'news', label: 'الأخبار', icon: 'i-lucide-newspaper', to: '/news', roles: [PS, ADMIN] }
]

const metricsItem: Item = { key: 'metrics', label: 'دليل المؤشرات', icon: 'i-lucide-gauge', to: '/metrics', roles: LEADERS }
// الطالب بلا «ملف شخصي» وظيفيّ: بياناته وكلمة مروره وصورته في «صفحتي» (/me)
const profileItem: Item = { key: 'profile', label: 'الملف الشخصي', icon: 'i-lucide-user', to: '/profile/me', roles: [...SCOPED_STAFF, 'teacher', 'examiner'] }

const visible = (items: Item[]) => computed(() => items.filter(i => role.value && i.roles.includes(role.value)))
const mainItems = visible(mainNav)
const managerItems = visible(managerNav)
const showMetrics = computed(() => role.value && metricsItem.roles.includes(role.value))
const showProfile = computed(() => role.value && profileItem.roles.includes(role.value))

// المسار أو ما تحته: صفحات التفاصيل (/halqat/<id>، /students/<id>…) تحمل عنوان قسمها وتُبرزه في القائمة
// (الملف الشخصي استثناء: /profile/<id> ملفّ غيرك، فلا يُبرز «الملف الشخصي» إلا لـ/profile/me)
const matches = (item: Item) => !!item.to
  && (item.to === route.path || (item.key !== 'profile' && route.path.startsWith(`${item.to}/`)))
const navTitle = computed(() => {
  const all = [...mainNav, ...managerNav, metricsItem, profileItem]
  if (route.path.startsWith('/profile/') && route.path !== '/profile/me') return 'الملف الشخصي'
  return all.find(matches)?.label ?? 'لوحة التحكم'
})

const roleLabel = computed(() => (role.value ? roleLabelFor(role.value, profile.value?.gender ?? null) : ''))

function go(item: Item) {
  drawerOpen.value = false
  if (item.to) navigateTo(item.to)
  else comingSoon()
}
const isActive = matches
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
            <div class="nav-group">
              القائمة الرئيسية
            </div>
            <button
              v-for="item in mainItems"
              :key="item.key"
              class="nav-item"
              :class="{ active: isActive(item) }"
              @click="go(item)"
            >
              <UIcon
                :name="item.icon"
                class="size-5"
              />
              <span>{{ item.label }}</span>
            </button>

            <template v-if="managerItems.length">
              <div class="nav-group">
                إدارة المشروع
              </div>
              <button
                v-for="item in managerItems"
                :key="item.key"
                class="nav-item"
                :class="{ active: isActive(item) }"
                @click="go(item)"
              >
                <UIcon
                  :name="item.icon"
                  class="size-5"
                />
                <span>{{ item.label }}</span>
              </button>
            </template>

            <template v-if="showMetrics">
              <button
                class="nav-item"
                :class="{ active: isActive(metricsItem) }"
                @click="go(metricsItem)"
              >
                <UIcon
                  :name="metricsItem.icon"
                  class="size-5"
                />
                <span>{{ metricsItem.label }}</span>
              </button>
            </template>

            <template v-if="showProfile">
              <div class="nav-group">
                الحساب
              </div>
              <button
                class="nav-item"
                :class="{ active: isActive(profileItem) }"
                @click="go(profileItem)"
              >
                <UIcon
                  :name="profileItem.icon"
                  class="size-5"
                />
                <span>{{ profileItem.label }}</span>
              </button>
            </template>
          </template>
        </ClientOnly>
      </nav>

      <div class="side-foot">
        <button
          class="nav-item theme"
          @click="toggleTheme"
        >
          <UIcon
            :name="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
            class="size-5"
          />
          <span>{{ isDark ? 'الوضع الفاتح' : 'الوضع الليلي' }}</span>
        </button>
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

      <main class="content">
        <slot />
      </main>
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
.nav-group { font-size: 11.5px; font-weight: 600; color: var(--side-ink); padding: 16px 12px 6px; opacity: .75; }
.nav-group:first-child { padding-top: 6px; }
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
.content { --content-pad: 24px; flex: 1; overflow-y: auto; padding: var(--content-pad); background: var(--bg); position: relative; }

/* RESPONSIVE */
.overlay { display: none; }
/* الشاشات القصيرة (حاسوبٌ محمول 768px وما دونه ارتفاعاً): كثافةٌ أعلى كي تتّسع القائمة بلا تمرير غالباً */
@media (max-height: 860px) {
  .side-head { padding: 14px 20px 12px; }
  .side-logo { height: 42px; }
  .nav-item { min-height: 40px; font-size: 14.5px; }
  .nav-group { padding: 12px 12px 4px; }
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
