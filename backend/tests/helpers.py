import os

BASE_URL = (
    os.environ.get("NEXT_PUBLIC_API_URL")
    or os.environ.get("REACT_APP_BACKEND_URL")
    or "http://localhost:8001"
).rstrip("/")

ADMIN_EMAIL = os.environ.get("HYPD_TEST_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("HYPD_TEST_ADMIN_PASSWORD", "")

