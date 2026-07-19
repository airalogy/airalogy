# Collector Syntax and Runtime

> Status: Phase 1 is implemented. Python and npm parsers support `collectors` blocks and cross-reference validation, `airalogy` provides `Observation[T]` and `ObservationSeriesRef[T]`, and `@airalogy/aimd-recorder` supports injected providers for `snapshot`, manually controlled `polling`, current-Record authorization, and explicit manual fallback. `stream`, automatic step/record lifecycle execution, and file-backed `ObservationSeriesRef[T]` writes remain on the roadmap.

A Collector declares how a Protocol field obtains observations from a runtime data source. The Protocol remains portable because AIMD declares the connector, channel, mode, and lifecycle while the host injects the trusted provider that actually accesses HTTP services, local networks, Bluetooth, serial ports, or device SDKs.

## Complete Example

````aimd
```connectors
lab_sensor_gateway:
  kind: data_source
  descriptor: ./connectors/sensors.yaml
  auth:
    token_env: LAB_SENSOR_TOKEN
```

```collectors
room_temperature:
  connector: lab_sensor_gateway
  channel: room.temperature
  mode: snapshot
  manual_fallback: true

incubator_temperature:
  connector: lab_sensor_gateway
  channel: incubator-01.temperature
  mode: polling
  interval: 5s
  lifecycle:
    start: manual
    stop: manual
```

Room temperature: {{var|room_temperature: Observation[float] | None, unit="Cel", collector="room_temperature"}}

Incubator temperature: {{var|temperature_log: list[Observation[float]] | None, unit="Cel", collector="incubator_temperature"}}
````

The connector must use `kind: data_source`. A collector-bound field must use `Observation[T]`, `list[Observation[T]]`, or `ObservationSeriesRef[T]`; a Collector cannot silently write a bare `float`, `int`, or `str` because that would discard acquisition provenance.

## Collector Block

Collector ids are declared directly at the top level of a YAML fenced block:

```yaml
room_temperature:
  connector: lab_sensor_gateway
  channel: room.temperature
  mode: snapshot
  manual_fallback: true
```

| Field | Required | Meaning |
| --- | --- | --- |
| `connector` | yes | Id of a `kind: data_source` connector. |
| `channel` | no | Stable provider-defined channel id. The parser treats it as an opaque string. |
| `mode` | no | `snapshot`, `polling`, or `stream`; defaults to `snapshot`. |
| `interval` | for polling | Positive duration such as `250ms`, `5s`, or `1min`. |
| `lifecycle` | no | Start/stop triggers; defaults to manual start and stop. |
| `manual_fallback` | no | Whether the Recorder may offer explicit manual observation entry; defaults to `false`. |
| `title` | no | Human-readable Collector label. |

Supported lifecycle declarations are:

```yaml
lifecycle:
  start: manual
  stop: manual
```

or:

```yaml
lifecycle:
  start:
    event: step_start
    step: incubation
  stop:
    event: step_complete
    step: incubation
```

Parsers preserve and validate `record_start`, `record_complete`, `step_start`, and `step_complete` declarations. The current browser Recorder executes only explicit manual start/stop controls; automatic lifecycle execution requires the later workflow lifecycle runtime.

## Field Binding

Use `collector="..."` metadata on a normal `var`:

```aimd
{{var|temperature: Observation[float] | None, unit="Cel", collector="room_temperature"}}
{{var|temperature_log: list[Observation[float]] | None, unit="Cel", collector="incubator_temperature"}}
```

The following rules are enforced by both Python and npm parsers:

- Collector and connector ids must exist.
- The connector must use `kind: data_source`.
- One field may bind one Collector, and one Collector may directly write one field.
- `snapshot` may target `Observation[T]` or `list[Observation[T]]`.
- `polling` and `stream` must target `list[Observation[T]]` or `ObservationSeriesRef[T]`.
- Phase 1 supports ordinary `var` fields; `var_table` subvars are not supported.
- `| None` means the field may remain empty before the first successful observation; it does not change acquisition behavior.

## Observation Values

The Recorder normalizes every provider result before writing the Record:

```json
{
  "value": 23.4,
  "observed_at": "2026-07-19T12:30:05.000Z",
  "received_at": "2026-07-19T12:30:06.000Z",
  "source": {
    "kind": "collector",
    "connector": "lab_sensor_gateway",
    "collector": "incubator_temperature",
    "device_id": "incubator-01"
  },
  "unit": "Cel",
  "quality": "ok",
  "sequence": 42,
  "metadata": {
    "firmware": "2.3.1"
  }
}
```

`value`, `observed_at`, `received_at`, and `source` are required. A provider may return a bare value such as `23.4` or an envelope containing `value` plus optional `observed_at`, `unit`, `quality`, `sequence`, `metadata`, and `device_id`. The runtime supplies missing timestamps and the trusted `source` identity.

Manual fallback never impersonates a device. It stores a separate provenance shape and requires a reason:

```json
{
  "value": 23.5,
  "observed_at": "2026-07-19T12:32:00.000Z",
  "received_at": "2026-07-19T12:32:00.000Z",
  "source": {
    "kind": "manual",
    "collector": "incubator_temperature",
    "actor_id": "user-123",
    "reason": "Thermometer is being calibrated"
  },
  "unit": "Cel"
}
```

`Observation[T]` stores the latest snapshot. `list[Observation[T]]` appends observations and preserves existing values when polling is stopped and restarted.

## Recorder Provider API

The host injects providers by connector id. AIMD does not execute connector descriptors by itself:

```vue
<script setup lang="ts">
import type { AimdCollectorProviderMap } from "@airalogy/aimd-recorder"

const collectorProviders: AimdCollectorProviderMap = {
  lab_sensor_gateway: {
    async read({ collector, signal }) {
      const response = await fetch(`/api/sensors/${collector.channel}`, { signal })
      const sample = await response.json()
      return {
        value: sample.value,
        observed_at: sample.timestamp,
        device_id: sample.device_id,
      }
    },
  },
}

async function requestCollectorPermission({ collector }) {
  return collector.mode === "snapshot" ? "once" : "record"
}
</script>

<template>
  <AimdRecorder
    v-model="record"
    :content="content"
    :collector-providers="collectorProviders"
    :request-collector-permission="requestCollectorPermission"
    :collector-record-key="recordId"
    collector-actor-id="user-123"
  />
</template>
```

`read()` receives the normalized connector, Collector, target field key, a Record snapshot, and an `AbortSignal`. `snapshot` calls it once. `polling` calls it sequentially at the declared interval, so reads never overlap, and stopping or unmounting aborts the current request.

The optional permission hook returns `false`, `true`/`"once"`, or `"record"`. `"record"` remembers authorization until `collectorRecordKey` or protocol content changes. The Collector action button itself is the explicit user gesture when no host permission hook is supplied; browser and operating-system device permission prompts still apply independently.

When no provider is registered, the Protocol still parses and renders. The Recorder reports that the source is unavailable and only shows manual entry when `manual_fallback: true`.

## Security and Runtime Boundary

- Never inline tokens, passwords, API keys, or client secrets in AIMD or descriptors; use connector environment-variable references.
- A Protocol may declare desired acquisition but cannot grant itself network, Bluetooth, serial, USB, or background permissions.
- Collector providers are read-only. Device control belongs in a separate action capability.
- Interactive hosts must keep collecting state visible and provide an immediate stop action.
- Tasks that must survive page closure belong in an engine, local edge agent, or controlled service runtime.

## Roadmap

The syntax and data models reserve `stream`, automatic record/step lifecycle triggers, persistent protocol-version authorization, background agents, and file-backed `ObservationSeriesRef[T]`. These declarations may be parsed today, but the Phase 1 browser Recorder intentionally reports unsupported execution instead of silently providing partial behavior.
