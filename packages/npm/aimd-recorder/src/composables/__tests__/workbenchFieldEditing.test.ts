import { describe, expect, it } from 'vitest'
import {
  appendWorkbenchField,
  deleteWorkbenchField,
  generateNextWorkbenchFieldId,
  moveWorkbenchField,
  scanWorkbenchFields,
  updateWorkbenchFieldId,
  updateWorkbenchFieldKind,
  updateWorkbenchVarValueType,
} from '../workbenchFieldEditing'

describe('workbenchFieldEditing', () => {
  it('scans recorder-editable field descriptors from inline AIMD tags and quiz blocks', () => {
    const content = [
      'Sample: {{var|sample_name: str = "abc", title = "Sample"}}',
      '{{var_table|measurements, subvars=[temp: float, pressure: float]}}',
      '{{step|prepare}}',
      '{{check|done}}',
      '```quiz',
      'id: quiz_1',
      'type: choice',
      'stem: |',
      '  Pick one',
      'mode: single',
      'options:',
      '  - key: A',
      '    text: Option A',
      '```',
    ].join('\n')

    const fields = scanWorkbenchFields(content)
    expect(fields.map(field => field.fieldType)).toEqual(['var', 'var_table', 'step', 'check', 'quiz'])
    expect(fields[0]).toMatchObject({ id: 'sample_name', valueType: 'str' })
    expect(fields[1]).toMatchObject({ id: 'measurements', subvarsText: 'temp, pressure' })
    expect(fields[4]).toMatchObject({ id: 'quiz_1', quizType: 'choice', sourceKind: 'block' })
  })

  it('updates var ids and var value types without dropping defaults or kwargs', () => {
    const content = 'Sample: {{var|sample_name: str = "abc", title = "Sample"}}'
    const [field] = scanWorkbenchFields(content)
    const nextIdContent = updateWorkbenchFieldId(content, field, 'specimen_name')
    expect(nextIdContent).toContain('{{var|specimen_name: str = "abc", title = "Sample"}}')

    const nextTypeField = scanWorkbenchFields(nextIdContent)[0]
    const nextTypeContent = updateWorkbenchVarValueType(nextIdContent, nextTypeField, 'float')
    expect(nextTypeContent).toContain('{{var|specimen_name: float = "abc", title = "Sample"}}')
  })

  it('switches recorder field kinds by rebuilding the source snippet around the current id', () => {
    const content = '{{check|done}}'
    const [field] = scanWorkbenchFields(content)
    const nextContent = updateWorkbenchFieldKind(content, field, 'var')
    expect(nextContent).toContain('{{var|done: str}}')
  })

  it('updates quiz ids in fenced quiz blocks', () => {
    const content = [
      '```quiz',
      'id: quiz_1',
      'type: open',
      'stem: |',
      '  Explain.',
      '```',
    ].join('\n')

    const [field] = scanWorkbenchFields(content)
    const nextContent = updateWorkbenchFieldId(content, field, 'quiz_protocol_2')
    expect(nextContent).toContain('id: quiz_protocol_2')
    expect(nextContent).toContain('type: open')
  })

  it('adds, deletes, and reorders standalone field segments in source order', () => {
    const content = [
      '{{var|alpha: str}}',
      '',
      '{{var|beta: str}}',
    ].join('\n')

    const appended = appendWorkbenchField(content, 'check', { id: 'done' })
    expect(appended).toContain('{{check|done}}')

    const appendedFields = scanWorkbenchFields(appended)
    const deleted = deleteWorkbenchField(appended, appendedFields[1])
    expect(deleted).not.toContain('{{var|beta: str}}')

    const deletedFields = scanWorkbenchFields(deleted)
    const moved = moveWorkbenchField(deleted, deletedFields, deletedFields[1].uid, 0)
    expect(moved.trimStart().startsWith('{{check|done}}')).toBe(true)
  })

  it('generates non-conflicting default ids for new fields', () => {
    const fields = scanWorkbenchFields('{{var|new_var: str}}\n\n{{var|new_var_2: str}}')
    expect(generateNextWorkbenchFieldId(fields, 'var')).toBe('new_var_3')
    expect(generateNextWorkbenchFieldId(fields, 'step')).toBe('new_step')
  })
})
