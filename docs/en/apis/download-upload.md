# Downloading and Uploading Airalogy-Hosted Cloud Data in a Protocol

This guide shows how to interact with files and records that are stored in Airalogy’s cloud. All examples use the official `airalogy` Python client.

## Files

Any file you upload (image, video, audio, document, etc.) is stored in the cloud and assigned a unique **Airalogy File ID**:

```txt
airalogy.id.file.<UUID>.<ext>
```

- `<UUID>`: A standard UUID (e.g. `d2f2cbe4-e566-4a22-8f4e-41246d163947`)
- `<ext>`: The original file extension (`png`, `pdf`, `mp4`, etc.)

### Download and Upload Files

You can download or upload files as raw **bytes** or **base64** strings.

```python
from airalogy import Airalogy

# ── Initialise the client (required env vars) ──────────────────────────────
#   AIRALOGY_ENDPOINT
#   AIRALOGY_API_KEY
#   AIRALOGY_PROTOCOL_ID
#
# For local testing you might do:
#   os.environ["AIRALOGY_ENDPOINT"]   = "http://localhost:4000"
#   os.environ["AIRALOGY_API_KEY"]    = "sk-…"
#   os.environ["AIRALOGY_PROTOCOL_ID"] = (
#       "airalogy.id.lab.lab1.project.proj1.protocol.protocol1.v.0.0.1"
#   )
airalogy_client = Airalogy()

# ── Download ──────────────────────────────────────────────────────────────
file_id = "airalogy.id.file.d2f2cbe4-e566-4a22-8f4e-41246d163947.png"

file_bytes:  bytes = airalogy_client.download_file_bytes(file_id=file_id)
file_base64: str   = airalogy_client.download_file_base64(file_id=file_id)

# ── Upload (bytes) ────────────────────────────────────────────────────────
upload_resp = airalogy_client.upload_file_bytes(
    file_name="example.png",  # extension is mandatory – it becomes part of the ID
    file_bytes=file_bytes
)
# upload_resp → {
#   "id":        "airalogy.id.file.d2f2cbe4-e566-4a22-8f4e-41246d163947.png",
#   "file_name": "example.png"
# }
new_file_id = upload_resp["id"]

# ── Upload (base64) ───────────────────────────────────────────────────────
airalogy_client.upload_file_base64(
    file_name="example.png",
    file_base64=file_base64
)
```

> **Why the response is an object, not a plain string?**
> We mirror the OpenAI API design, leaving room to add attributes such as size, upload timestamp, checksum, etc.

### Get a Temporary File URL

When you upload a file to the Airalogy platform, you may need to obtain a temporary URL for that file. Use the following code:

```py
from airalogy import Airalogy
airalogy_client = Airalogy()

file_id = "airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.yyy"
# Get a temporary file URL
file_url: str = airalogy_client.get_file_url(
    file_id=file_id,
)
```

For files uploaded to a **private Airalogy Protocol**, the generated URL remains valid for **24 hours**.

## Records

Every **Airalogy Record** also has a globally unique ID:

```txt
airalogy.id.record.<UUID>.v.<version_number>
```

To download a list of records:

```python
from airalogy import Airalogy
import json

airalogy_client = Airalogy()

records_json: str = airalogy_client.download_records_json(
    record_ids=[
        "airalogy.id.record.11111111-2222-3333-4444-555555555555.v.1",
        "airalogy.id.record.11111111-2222-3333-4444-555555555555.v.2",
        "airalogy.id.record.66666666-7777-8888-9999-aaaaaaaaaaaa.v.1",
    ]
)

# The returned string is a JSON array:
# [
#   { … },   # record 1 (v1)
#   { … },   # record 1 (v2)
#   { … }    # record 2 (v1)
# ]

# Convert to Python objects if needed:
records: list[dict] = json.loads(records_json)
```
