import {
  createProtocolAiraArchive,
  type CreateProtocolAiraArchiveFile,
  type CreateProtocolAiraArchiveOptions,
} from '@airalogy/aira-core'
import { prepareAimdForFormalOutput } from '@airalogy/aimd-editor/authoring'

export interface CreateEditorProtocolDownloadOptions {
  aimd: string
  filenameStem: string
  protocol: NonNullable<CreateProtocolAiraArchiveOptions['protocol']>
  files: CreateProtocolAiraArchiveFile[]
}

export interface EditorProtocolDownload {
  aimd: string
  changed: boolean
  generatedFigureIds: string[]
  kind: 'aimd' | 'aira'
  filename: string
  mimeType: string
  data: string | Uint8Array
}

type ProtocolArchiveFactory = (
  options: CreateProtocolAiraArchiveOptions,
) => Promise<Uint8Array>

export async function createEditorProtocolDownload(
  options: CreateEditorProtocolDownloadOptions,
  createArchive: ProtocolArchiveFactory = createProtocolAiraArchive,
): Promise<EditorProtocolDownload> {
  const formalized = prepareAimdForFormalOutput(options.aimd)
  if (options.files.length === 0) {
    return {
      aimd: formalized.content,
      changed: formalized.changed,
      generatedFigureIds: formalized.generated.map(figure => figure.id),
      kind: 'aimd',
      filename: `${options.filenameStem}.aimd`,
      mimeType: 'text/plain;charset=utf-8',
      data: formalized.content,
    }
  }

  const archiveBytes = await createArchive({
    aimd: formalized.content,
    protocol: options.protocol,
    files: options.files,
  })
  return {
    aimd: formalized.content,
    changed: formalized.changed,
    generatedFigureIds: formalized.generated.map(figure => figure.id),
    kind: 'aira',
    filename: `${options.filenameStem}.aira`,
    mimeType: 'application/vnd.airalogy.archive+zip',
    data: archiveBytes,
  }
}
