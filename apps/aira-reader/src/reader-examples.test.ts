import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { openAiraArchive } from '@airalogy/aira-core'
import { renderReadonlyRecordToVue, renderToVue } from '@airalogy/aimd-renderer'
import { buildDocumentViews } from './reader-model'

const examplesDir = fileURLToPath(new URL('../../../examples/aira/', import.meta.url))

async function readExampleNames(): Promise<string[]> {
  const names = await readdir(examplesDir)
  return names
    .filter(name => name.endsWith('.aira'))
    .sort((a, b) => a.localeCompare(b))
}

describe('Aira Reader examples', () => {
  it('opens, validates, builds views, and smoke-renders repository .aira examples', async () => {
    const names = await readExampleNames()
    expect(names.length).toBeGreaterThan(0)

    for (const name of names) {
      const bytes = await readFile(new URL(`../../../examples/aira/${name}`, import.meta.url))
      const archive = await openAiraArchive(bytes)
      const validation = await archive.validate()
      expect(validation.ok, `${name}: ${validation.issues.join('\n')}`).toBe(true)

      const views = await buildDocumentViews(archive)
      expect(views.length, `${name}: expected at least one document view`).toBeGreaterThan(0)

      for (const view of views) {
        if (!view.protocolContent) {
          expect(view.loadError, `${name}: missing protocol views should explain why`).toBeTruthy()
          continue
        }

        const rendered = view.recordPayload
          ? await renderReadonlyRecordToVue(view.protocolContent, view.recordPayload, {
              gfm: true,
              math: true,
              breaks: true,
              groupStepBodies: true,
              groupCheckBodies: true,
            })
          : await renderToVue(view.protocolContent, {
              gfm: true,
              math: true,
              breaks: true,
              groupStepBodies: true,
              groupCheckBodies: true,
            })

        expect(rendered.nodes.length, `${name}: ${view.label} should render content`).toBeGreaterThan(0)
      }
    }
  })
})
