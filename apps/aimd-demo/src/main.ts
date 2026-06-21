import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'

const router = createRouter({
  // Use hash history so GitHub Pages can serve deep links without rewrite rules.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/editor' },
    { path: '/tutorial', component: () => import('./pages/TutorialDemo.vue') },
    { path: '/examples', component: () => import('./pages/ExamplesDemo.vue') },
    { path: '/full', redirect: '/examples' },
    { path: '/core', component: () => import('./pages/CoreDemo.vue') },
    { path: '/editor', component: () => import('./pages/EditorDemo.vue') },
    { path: '/renderer', component: () => import('./pages/RendererDemo.vue') },
    { path: '/recorder', component: () => import('./pages/RecorderDemo.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/editor' },
  ],
})

const app = createApp(App)
app.use(router)

void router.isReady().finally(() => {
  app.mount('#app')
})
