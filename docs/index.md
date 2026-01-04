---
layout: home
hero:
  name: Airalogy Docs
  text: Choose your language
  actions:
    - theme: brand
      text: English
      link: /en/
    - theme: alt
      text: 简体中文
      link: /zh/
---

# Documentation Maintenance

The `airalogy` package ships with documentation in two languages:

- English (main reference): `/en/`
- Chinese (secondary reference): `/zh/`
- Language landing page: `docs/index.md`
- Sidebar config: `docs/.vitepress/sidebars/`

To keep both audiences well-served, follow these guidelines:

1. **Primary source of truth**
   The English documentation is authoritative. Any change to the Chinese docs must faithfully reflect the English version.

2. **Update both languages together**
   Whenever you add or change a feature, edit the corresponding pages in **both** `docs/en` and `docs/zh` before merging.

3. **Pull-request checklist**
   If a PR touches documentation, confirm that:

   - English pages are updated.
   - Chinese pages are updated and synchronised with the English content.

## Local preview

From the repo root:

```bash
cd docs
npm install
npm run docs:dev
```

The production build uses `npm run docs:build`.

By maintaining the two sets in lockstep, we ensure a consistent experience for users worldwide.
