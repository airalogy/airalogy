# Airalogy Engine Notes

- Python package: `packages/pypi/airalogy-engine`
- Node package: `packages/npm/airalogy-engine`
- Shared sandbox image: `packages/runtime/airalogy-engine-image`
- Example protocol: `examples/airalogy-engine`

Both packages wrap the same `protocol_executor.py` behavior and expose parse, assign, and validate
operations through BoxLite.

Use rootfs mode for local deterministic tests after building the image:

```bash
pnpm build:engine-rootfs
```

Then pass `packages/runtime/airalogy-engine-image/airalogy-engine-image` as the rootfs path.
