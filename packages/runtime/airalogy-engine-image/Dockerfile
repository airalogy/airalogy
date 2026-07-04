FROM python:3.13.12-slim AS builder

WORKDIR /builder

COPY packages/runtime/airalogy-engine-image/protocol_requirements.txt ./

# Install requirements
RUN pip install --no-cache-dir -r protocol_requirements.txt
COPY packages/pypi/airalogy ./packages/pypi/airalogy
COPY examples/protocols ./examples/protocols
RUN pip install --no-cache-dir './packages/pypi/airalogy[markitdown]'

# run stage
FROM python:3.13.12-slim

# retrieve packages from build stage
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages

# add a no-root user
RUN useradd -ms /bin/bash airalogy \
    && mkdir -p /home/airalogy/protocols/protocol \
    && chown -R airalogy:airalogy /home/airalogy/protocols
USER airalogy
WORKDIR /home/airalogy/protocols
