<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, onUnmounted, watchEffect } from 'vue'
import { useDemoLocale, useDemoMessages } from './composables/demoI18n'

const route = useRoute()
const { locale } = useDemoLocale()
const messages = useDemoMessages()
const docsHref = computed(() => locale.value === 'zh-CN'
  ? 'https://airalogy.github.io/airalogy/aimd/zh/'
  : 'https://airalogy.github.io/airalogy/aimd/en/')
const githubHref = 'https://github.com/airalogy/airalogy'

const navItems = computed(() => [
  { path: '/tutorial', label: messages.value.nav.tutorial },
  { path: '/examples', label: messages.value.nav.examples },
  { path: '/core', label: messages.value.nav.core },
  { path: '/editor', label: messages.value.nav.editor },
  { path: '/renderer', label: messages.value.nav.renderer },
  { path: '/recorder', label: messages.value.nav.recorder },
])

const currentPath = computed(() => route.path)
const isBoundedRoute = computed(() => (
  currentPath.value === '/examples' || currentPath.value.startsWith('/examples/')
))

watchEffect(() => {
  if (typeof document === 'undefined') {
    return
  }

  document.body.classList.toggle('aimd-demo-body--bounded', isBoundedRoute.value)
  if (isBoundedRoute.value && typeof window !== 'undefined') {
    window.scrollTo({ top: 0, left: 0 })
  }
})

onUnmounted(() => {
  if (typeof document === 'undefined') {
    return
  }

  document.body.classList.remove('aimd-demo-body--bounded')
})
</script>

<template>
  <div :class="['app', { 'app--bounded': isBoundedRoute }]">
    <header class="app-header">
      <h1 class="app-title">{{ messages.app.title }}</h1>
      <nav class="app-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="['nav-link', { active: currentPath === item.path }]"
        >
          {{ item.label }}
        </router-link>
      </nav>
      <div class="app-links">
        <a :href="docsHref" class="app-link-btn" target="_blank" rel="noreferrer">
          {{ messages.app.links.docs }}
        </a>
        <a :href="githubHref" class="app-link-btn app-link-btn--ghost" target="_blank" rel="noreferrer">
          {{ messages.app.links.github }}
        </a>
      </div>
      <label class="locale-switcher">
        <span class="locale-switcher__label">{{ messages.app.languageLabel }}</span>
        <select v-model="locale" class="locale-switcher__select">
          <option value="zh-CN">{{ messages.app.localeNames['zh-CN'] }}</option>
          <option value="en-US">{{ messages.app.localeNames['en-US'] }}</option>
        </select>
      </label>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  min-height: 100%;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #333;
  background: #f5f7fa;
}

body.aimd-demo-body--bounded {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

body.aimd-demo-body--bounded #app {
  height: 100%;
  overflow: hidden;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app--bounded {
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  padding: 16px 32px;
  display: flex;
  align-items: center;
  gap: 32px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  white-space: nowrap;
}

.app-nav {
  display: flex;
  gap: 4px;
  flex: 1;
}

.app-links {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.app-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  background: #1a73e8;
  color: #fff;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.app-link-btn:hover {
  background: #1765cb;
}

.app-link-btn--ghost {
  border: 1px solid #d0d7de;
  background: #fff;
  color: #334155;
}

.app-link-btn--ghost:hover {
  background: #f8fafc;
}

.nav-link {
  padding: 8px 16px;
  border-radius: 6px;
  text-decoration: none;
  color: #555;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-link:hover {
  background: #f0f2f5;
  color: #333;
}

.nav-link.active {
  background: #e8f0fe;
  color: #1a73e8;
}

.locale-switcher {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.locale-switcher__label {
  color: #555;
  font-size: 13px;
  font-weight: 600;
}

.locale-switcher__select {
  height: 34px;
  min-width: 124px;
  padding: 0 10px;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #fff;
  color: #333;
  font-size: 13px;
}

.app-main {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: 24px clamp(16px, 2.8vw, 40px);
}

.app--bounded .app-main {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 960px) {
  .app-header {
    padding: 12px 16px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .app-title {
    font-size: 18px;
  }

  .app-nav {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 2px;
    flex: none;
  }

  .locale-switcher {
    margin-left: 0;
  }

  .app-links {
    width: 100%;
  }

  .app-main {
    padding-top: 16px;
    padding-bottom: 16px;
  }
}
</style>
