import DefaultTheme from 'vitepress/theme'
import DocsHome from './DocsHome.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DocsHome', DocsHome)
  },
}
