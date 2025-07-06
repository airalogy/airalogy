# Environment Variables

## `.env`

Some Airalogy Protocol Assigners need environment variables to function—for instance, an external LLM `API_KEY` or a `DATABASE_URL`.
Place these variables in a `.env` file at the root of the protocol package:

```txt
protocol/
├── protocol.aimd
├── model.py
├── assigner.py
└── .env
```

```env
API_KEY=your_api_key
DATABASE_URL=your_database_url
```

When you upload the protocol to the [Airalogy platform](https://airalogy.com):

1. **Security first** – the platform **deletes** the `.env` file from the cloud copy.
2. Airalogy reads the variables and stores them in the protocol’s *Environment* settings.
3. At runtime, those variables are injected automatically.

## `.env.example`

To help other developers discover the required variables, include an **example** file:

```txt
protocol/
├── protocol.aimd
├── model.py
├── assigner.py
├── .env          (ignored after upload)
└── .env.example  (retained)
```

```env
API_KEY=your_api_key
DATABASE_URL=your_database_url
```

The platform keeps `.env.example`, so collaborators know which keys to define.

## Do Not Use the `dotenv` Library

In local projects you might load `.env` via `python-dotenv`:

```python
from dotenv import load_dotenv
import os

load_dotenv()
API_KEY = os.getenv("API_KEY")
```

**This is forbidden on Airalogy**—protocols using `dotenv` will be rejected.
Rely on the platform’s automatic injection and fetch values directly:

```python
import os

API_KEY = os.getenv("API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
```

### Local Testing Options

1. **Shell variables**

   ```bash
   export API_KEY=your_api_key
   export DATABASE_URL=your_database_url
   ```

   Then call `os.getenv()` inside Python.

2. **Temporary `dotenv`**
   Use `python-dotenv` during local development, **but remove** any `dotenv` import before uploading.

By following these guidelines you keep secrets safe while ensuring your protocol runs smoothly both locally and on the Airalogy platform.
