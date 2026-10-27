import { inject, ref, type InjectionKey, type Ref } from 'vue'

export const fieldDisplayKey: InjectionKey<Readonly<Ref<'compact' | 'detailed'>>> = Symbol('aimd-field-display')

export function useFieldPresentation() {
  return inject(fieldDisplayKey, ref<'compact' | 'detailed'>('detailed'))
}
