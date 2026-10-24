// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@pinia/nuxt', '@nuxtjs/supabase', '@vite-pwa/nuxt'],

  devtools: {
    enabled: true
  },

  // عربي + RTL بالكامل (مبدأ حاكم في البريف §2)
  app: {
    // انتقال سلس بين الشاشات (تلاشٍ + انزياح خفيف) — أنماط .page-* في main.css
    pageTransition: { name: 'page' },
    head: {
      htmlAttrs: {
        lang: 'ar',
        dir: 'rtl'
      },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // أيقونة PNG مربّعة 192×192 (مضاعف لـ 48px) — شرط جوجل لعرض الأيقونة في نتائج البحث
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
        // رابط المانيفست: @vite-pwa/nuxt يولّده لكنه لا يحقن الرابط، فنضيفه هنا ليكتشفه Chrome
        { rel: 'manifest', href: '/manifest.webmanifest' }
      ],
      meta: [
        { name: 'theme-color', content: '#094064' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  // النطاق العامّ للموقع (canonical / og:url / sitemap / robots).
  // اضبطه عند معرفة النطاق عبر متغيّر البيئة NUXT_PUBLIC_SITE_URL على Vercel.
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://turjuman.vercel.app'
    }
  },

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // الخطوط: في وضع التطوير نعطّل المزوّدات الشبكية ليعمل الخادم دون إنترنت
  // (يتجنّب انهيار vite-node عند انقطاع الشبكة). الإنتاج يبقى كامل المزوّدات.
  fonts: process.env.NODE_ENV !== 'production'
    ? { providers: { google: false, bunny: false, fontshare: false, googleicons: false } }
    : {},

  // أيقوناتُ الوضع في حزمة العميل (2026-10-22): حين تُجلب «moon-star» و«monitor» في طلبٍ واحد يبني @nuxt/icon 2.2.2
  // قاعدةَ الأولى بصورة الثانية فيظهر القمرُ شاشة — والمضمَّنةُ لا تُجلب أصلاً.
  icon: {
    clientBundle: { icons: ['lucide:sun', 'lucide:moon-star', 'lucide:monitor'] }
  },

  // PWA: التطبيق قابل للتثبيت (مانيفست + service worker لهيكل التطبيق فقط).
  // لا يخزّن استدعاءات Supabase — البيانات تبقى حيّة. النصوص عربية RTL.
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'ترجمان',
      short_name: 'ترجمان',
      lang: 'ar',
      dir: 'rtl',
      display: 'standalone',
      start_url: '/',
      theme_color: '#094064',
      background_color: '#FFFFFF',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    // التنقّلُ من الشبكة دائماً (لا رجوعَ إلى نسخةٍ محفوظة من «/»): كانت كلُّ صفحةٍ تُقدَّم من هيكل النشر
    // السابق حتى ينزل عاملُ الخدمة الجديد ويعيد التحميل — فيرى المستخدم الشاشةَ القديمة ثم الجديدة بعد التحديث،
    // وتُبنى الصفحات على هيكل «/» فلا تطابق (Hydration mismatch). العملُ بلا إنترنت غيرُ مبنيٍّ أصلاً (ROADMAP #14).
    // `null` لا حذفُ المفتاح: @vite-pwa/nuxt يضع «/» إن غاب.
    workbox: {
      navigateFallback: null
    },
    // فحصُ نسخةٍ جديدة كلَّ ساعة (وعند العودة إلى التبويب — plugins/pwa-update.client.ts)، و autoUpdate يعيد التحميل
    client: {
      periodicSyncForUpdates: 3600
    }
  },

  // Supabase: المفاتيح من .env (SUPABASE_URL / SUPABASE_KEY).
  // redirect معطّل الآن — سنبني حماية المسارات حسب الدور كـ middleware خاص بنا (المهمة 7).
  supabase: {
    redirect: false
  }
})
