FROM python:3.13.12-slim AS builder

WORKDIR /builder

COPY packages/runtime/airalogy-engine-image/protocol_requirements.txt ./
COPY packages/pypi/airalogy ./packages/pypi/airalogy
COPY examples/protocols ./examples/protocols

# Resolve the runtime and the checked-out Core together so direct requirements
# cannot be silently replaced by a later installation step.
RUN pip install --no-cache-dir \
    -r protocol_requirements.txt \
    './packages/pypi/airalogy[markitdown]'

# run stage
FROM python:3.13.12-slim

ARG ENGINE_IMAGE_VERSION=development
ARG AIRALOGY_CORE_VERSION=development
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=

LABEL org.opencontainers.image.title="Airalogy Engine" \
      org.opencontainers.image.description="Sandbox runtime for Airalogy Protocol execution" \
      org.opencontainers.image.source="https://github.com/airalogy/airalogy" \
      org.opencontainers.image.version="$ENGINE_IMAGE_VERSION" \
      org.opencontainers.image.revision="$GIT_COMMIT" \
      org.opencontainers.image.created="$BUILD_TIME" \
      io.airalogy.core.version="$AIRALOGY_CORE_VERSION"

# retrieve packages from build stage
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages

# add a no-root user
RUN useradd -ms /bin/bash airalogy \
    && mkdir -p /home/airalogy/protocols/protocol \
    && chown -R airalogy:airalogy /home/airalogy/protocols
USER airalogy
WORKDIR /home/airalogy/protocols
