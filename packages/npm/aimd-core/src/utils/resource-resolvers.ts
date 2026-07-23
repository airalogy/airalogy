import type {
  AimdEntityRefOption,
  AimdEntityRefValue,
  AimdEntityResolveContext,
} from "./entity-connectors"

export interface AimdResourceRefValue extends AimdEntityRefValue {
  lot_id?: string
  container_id?: string
  /** Exact decimal quantity. String values are preferred across JSON boundaries. */
  quantity?: string
  /** UCUM-compatible unit. */
  unit?: string
  reservation_id?: string
  booking_id?: string
  /** Host-prepared output payload committed atomically with the Record. */
  prepared_output?: Record<string, unknown>
}

export interface AimdResourceRefOption extends AimdEntityRefOption {
  code?: string
  status?: string
  resource_type?: string
}

export interface AimdResourceLotOption {
  id: string
  label?: string
  expires_at?: string
  available?: string
  unit?: string
  disabled?: boolean
}

export interface AimdResourceContainerOption {
  id: string
  lot_id?: string
  label?: string
  location?: string
  available?: string
  unit?: string
  disabled?: boolean
}

export interface AimdEquipmentSlotOption {
  id?: string
  starts_at: string
  ends_at: string
  label?: string
  available?: boolean
}

export interface AimdResourceAvailability {
  available?: string
  unit?: string
  lots?: AimdResourceLotOption[]
  containers?: AimdResourceContainerOption[]
  equipment_slots?: AimdEquipmentSlotOption[]
}

export interface AimdPreparedResourceOutput {
  /** Client-generated stable id used by the host when the Record is committed. */
  id: string
  value: AimdResourceRefValue
  payload?: Record<string, unknown>
}

export interface AimdResourceResolveContext extends AimdEntityResolveContext {
  role?: "input" | "output" | "reference" | "equipment"
  quantityField?: string
  containerRequired?: boolean
  bookingRequired?: boolean
}

export interface AimdResourceResolver {
  search: (
    query: string,
    context: AimdResourceResolveContext,
  ) => AimdResourceRefOption[] | Promise<AimdResourceRefOption[]>
  resolve?: (
    id: string,
    context: AimdResourceResolveContext,
  ) => AimdResourceRefOption | null | undefined | Promise<AimdResourceRefOption | null | undefined>
  getAvailability?: (
    resource: AimdResourceRefValue,
    context: AimdResourceResolveContext,
  ) => AimdResourceAvailability | Promise<AimdResourceAvailability>
  prepareOutput?: (
    draft: AimdResourceRefValue,
    context: AimdResourceResolveContext,
  ) => AimdPreparedResourceOutput | Promise<AimdPreparedResourceOutput>
}

export type AimdResourceResolverMap = Record<string, AimdResourceResolver>
