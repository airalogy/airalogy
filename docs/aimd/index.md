---
layout: home
hero:
  name: AIMD Docs
  text: Choose your language
  actions:
    - theme: brand
      text: English
      link: /en/
    - theme: alt
      text: 简体中文
      link: /zh/
    - theme: alt
      text: Quick Demo
      link: /demo/
      target: _self
---

<script setup>
import { withBase } from 'vitepress'

const demoHref = withBase('/demo/')
</script>

# Quick Experience

- <a :href="demoHref" target="_self">Open Demo</a>
