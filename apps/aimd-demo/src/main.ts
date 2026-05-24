import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'

const router = createRouter({
  // Use hash history so GitHub Pages can serve deep links without rewrite rules.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/tutorial' },
    { path: '/tutorial', component: () => import('./pages/TutorialDemo.vue') },
    { path: '/examples', component: () => import('./pages/ExamplesDemo.vue') },
    { path: '/full', component: () => import('./pages/FullDemo.vue') },
    { path: '/core', component: () => import('./pages/CoreDemo.vue') },
    { path: '/editor', component: () => import('./pages/EditorDemo.vue') },
    { path: '/renderer', component: () => import('./pages/RendererDemo.vue') },
    { path: '/recorder', component: () => import('./pages/RecorderDemo.vue') },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app')
