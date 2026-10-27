<script setup>
import { withBase } from 'vitepress'

const demoRoot = import.meta.env.DEV
  ? 'http://localhost:5188'
  : withBase('/demo')

const demoPages = [
  { label: 'Examples', path: '/examples', desc: 'Repository AIMD examples with source editing, render preview, recorder entry, fields, and record data' },
  { label: 'Core Parser', path: '/core', desc: 'AST and extracted AIMD fields' },
  { label: 'Editor', path: '/editor', desc: 'AIMD authoring experience' },
  { label: 'Renderer', path: '/renderer', desc: 'HTML / Vue render output preview' },
  { label: 'Recorder', path: '/recorder', desc: 'Structured data input UI' },
]

const linkTo = path => `${demoRoot}/#${path}`
</script>

# Airalogy Markdown Demo

Use the Airalogy Markdown Demo in a separate page for a cleaner reading experience. Protocol entries on the examples page preview and fill the `protocol.aimd` source; engine-backed assigner execution belongs in the higher-level Airalogy Protocol demo.

<div class="aimd-demo-actions">
  <a :href="linkTo('/examples')" class="aimd-demo-button" target="_blank" rel="noreferrer">
    Open Airalogy Markdown Demo
  </a>
</div>

<div class="aimd-demo-list">
  <a
    v-for="item in demoPages"
    :key="item.path"
    :href="linkTo(item.path)"
    class="aimd-demo-card"
    target="_blank"
    rel="noreferrer"
  >
    <div class="aimd-demo-card__title">{{ item.label }}</div>
    <div class="aimd-demo-card__desc">{{ item.desc }}</div>
  </a>
</div>

## Bilingual Syntax Tour

The AIMD Syntax Tour is available in English and Chinese. Loading or resetting this example uses the current Demo language; saved editor drafts are not automatically replaced. Both versions share field IDs, enum values, references, local assets, and client assigners while translating labels, step titles, instructions, and quiz content. Sources are in [examples/aimd/aimd-syntax-tour](https://github.com/airalogy/airalogy/tree/main/examples/aimd/aimd-syntax-tour).

## AI Glasses Lab Templates

Every step in both templates explicitly declares a `title` for human-readable display or host-provided spoken guidance; the step ID remains the key for navigation, references and records. Template updates do not overwrite saved browser drafts. Inspect the new template on the examples page first; before replacing an editor draft, export any template and records you need to retain, then explicitly load the updated template.

Choose either "AI 眼镜实验指导" entry in the editor's template picker or the example switcher to load the Chinese-language vinegar titration (18 steps) and floating leaf disk photosynthesis (19 steps) protocols. Both include practical instructions, human confirmation, timers, repeated measurements, exception handling, and glasses interaction logs, without requiring Engine. Sources and bilingual test guides live in [examples/protocols](https://github.com/airalogy/airalogy/tree/main/examples/protocols).

Start with water/empty-vessel rehearsal; wet-lab use requires local safety review and pilot validation. These are not validated SOPs and do not imply that the Demo already integrates glasses cameras or voice control; those capabilities and enforced step gates belong to the host. Existing Recorder supports manual entry and draft saving, with human review of calculations and scientific interpretation.

## Save Templates And Records

The input toolbar's **Advanced / custom** choice lists registered Airalogy types while allowing free type expressions. Checkpoints accept optional names, with automatically generated stable IDs. Hovering or keyboard-focusing **Import package** opens its complete instructions outside the workspace clipping area; the hint stays within the viewport and can be dismissed with Escape.

Show field details is always accessible in the upper-right corner of each workspace panel and is on for first-time visitors. Turning it off shows a compact form. The choice is saved in the current browser and takes precedence over the app default on subsequent visits. Editing and filling share the preference, including both panels in split view. It is never stored in AIMD, Record values, or exported `.aira` packages. Other hosts can configure the initial display through the components' `field-display` prop and manage user preferences themselves.

The online editor lets users edit input definitions and fill real values in one visual document. Template content and Record values remain separate: `{{var|temperature: float}}` stays in AIMD, while the entered `37.5` belongs to `data.var.temperature`, not a template default.

- **Drafts**: the template, values, protocol assets, record attachments, and edits to imported records are stored together in local IndexedDB. Wait for "Draft saved locally" before reloading. Incomplete drafts need not pass validation and autosave does not assign a formal record ID.
- **Save template**: exports only the template, as `.aimd` without local assets or a Protocol `.aira` with assets. Filled values and record attachments are excluded.
- **Save record .aira**: runs Recorder's frontend validation and exports the current record, its matching protocol snapshot, and available attachments. First export assigns an ID and version 1; unchanged retries retain the version, while changed values or template content increment it. Imported records retain their identity.
- **Reimport**: use Import package to reopen the exported record and continue filling. Switching among imported records preserves their individual drafts; Save record exports only the current record.

An embedded protocol snapshot contains the current source and local assets. Unchanged imported protocols retain their version; modified local snapshots use a content-hash `local-...` version rather than claiming to be published releases. Figure IDs generated during formal output are written back into the editor with a notice.

Locally selected record attachments include their actual bytes. External references without bytes remain external, with an explicit export notice; the browser does not automatically fetch those files or submit records to a server. Drafts are not backups or cross-browser/domain/port sync. Clearing site data, private browsing, and storage limits can affect recovery, so export important records. Frontend validation does not execute custom Python `model.py`; authoritative validation and server submission remain the host's responsibility.

Package boundaries: `aimd-editor` edits AIMD definitions; `aimd-recorder` owns value entry and interaction validation; the demo/host owns draft persistence, record IDs, versions, and save actions; `aira-core` owns archive format, files, and hashes. The reusable `createRecordsAiraArchive` API can package multiple records sharing a protocol and deduplicates attachment bytes by SHA-256; see the [aira-core README](https://github.com/airalogy/airalogy/tree/main/packages/npm/aira-core#export-records).

In local development:

- `pnpm docs:dev` for docs
- `pnpm dev:demo` for demo app
- `pnpm dev:protocol-demo:full` for engine-backed Protocol demo

<style scoped>
.aimd-demo-actions {
  margin: 14px 0 18px;
}

.aimd-demo-button {
  display: inline-block;
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid #c9d8ff;
  background: #eaf1ff;
  color: #1f4fbb;
  text-decoration: none;
  font-weight: 600;
}

.aimd-demo-button:hover {
  background: #dfe9ff;
}

.aimd-demo-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin: 0 0 14px;
}

.aimd-demo-card {
  display: block;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  text-decoration: none;
}

.aimd-demo-card:hover {
  border-color: #bfd1ff;
  background: #fafcff;
}

.aimd-demo-card__title {
  color: #1f2937;
  font-weight: 600;
  font-size: 14px;
}

.aimd-demo-card__desc {
  color: #6b7280;
  font-size: 12px;
  margin-top: 4px;
}
</style>
