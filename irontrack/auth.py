import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from irontrack import models
from irontrack.database import get_db

# Secret key for JWT - in production, use environment variable
SECRET_KEY = "your-secret-key-here-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 43200  # 30 days

security = HTTPBearer()

# Password hashing using PBKDF2 (built into Python standard library)
ITERATIONS = 100_000  # OWASP recommended minimum

def get_password_hash(password: str) -> str:
    """
    Hash password using PBKDF2-SHA256 with random salt.
    Returns: salt$hash (both in hex format)
    """
    salt = secrets.token_bytes(32)  # 32 bytes = 256 bits
    hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, ITERATIONS)
    # Store salt and hash together as hex strings separated by $
    return f"{salt.hex()}${hash_bytes.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password against stored hash.
    hashed_password format: salt$hash (both in hex)
    """
    try:
        salt_hex, hash_hex = hashed_password.split('$')
        salt = bytes.fromhex(salt_hex)
        stored_hash = bytes.fromhex(hash_hex)

        # Hash the provided password with the stored salt
        new_hash = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt, ITERATIONS)

        # Constant-time comparison to prevent timing attacks
        return secrets.compare_digest(new_hash, stored_hash)
    except (ValueError, AttributeError):
        return False

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user
