# IronTrack Backend Import Structure

This backend uses **absolute imports** with the package name `irontrack` for clarity and maintainability.

## Why Absolute Imports with Package Name?

Using absolute imports with an explicit package name prevents naming conflicts and makes the code crystal clear.

✅ **Good** (absolute with package name):
```python
from irontrack.auth import get_current_user
from irontrack.database import get_db
from irontrack import models, schemas
```

## Import Patterns

All modules use `from irontrack.module import X` style:

```python
# irontrack/models.py
from irontrack.database import Base

# irontrack/main.py
from irontrack.database import engine, Base, get_db
from irontrack.routers import auth, exercises, templates, instances
from irontrack import models

# irontrack/routers/auth.py
from irontrack.database import get_db
from irontrack import models, schemas
from irontrack.auth import get_password_hash
```

## Running the Application

```bash
uvicorn irontrack.main:app --reload
```

## Benefits

1. **Crystal clear**: Always obvious which package you're importing from
2. **No ambiguity**: `from irontrack.auth` is unambiguous
3. **IDE support**: Better autocomplete and refactoring
4. **Grep-friendly**: Easy to find all uses of a module

