# Airalogy Engine Notes

- Python package: `packages/pypi/airalogy-engine`
- Node package: `packages/npm/airalogy-engine`
- Shared sandbox image: `packages/runtime/airalogy-engine-image`
- Example protocol: `examples/airalogy-engine`

Both packages wrap the same `protocol_executor.py` behavior and expose parse, assign, and validate
operations through BoxLite.

Use rootfs mode for local deterministic tests after building the image:

```bash
cd packages/runtime/airalogy-engine-image
docker build -t airalogy-engine:latest .
docker save airalogy-engine:latest -o airalogy-engine-image.tar
mkdir airalogy-engine-image
tar -xf airalogy-engine-image.tar -C airalogy-engine-image
```

Then pass `packages/runtime/airalogy-engine-image/airalogy-engine-image` as the rootfs path.
