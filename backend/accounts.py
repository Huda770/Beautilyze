"""Email and password authentication backed by the existing SQLite database."""

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from functools import wraps
import hashlib
import re
import secrets
import sqlite3
import threading

from flask import Blueprint, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash


# Account settings and the shared SQLite connection/schema helpers.
AGE_GROUPS = {"14-18", "19-25", "26-35", "36-45", "45+"}
SESSION_DAYS = 30
LOGIN_FAILURE_LIMIT = 10
LOGIN_FAILURE_WINDOW = timedelta(minutes=15)
EMAIL_PATTERN = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
# Compared against when an email is unknown so login timing does not reveal which emails exist.
DUMMY_PASSWORD_HASH = generate_password_hash(secrets.token_urlsafe(16))


@contextmanager
def connect(database):
    """Open a connection that commits on success, rolls back on error and always closes."""
    connection = sqlite3.connect(database)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        with connection:
            yield connection
    finally:
        connection.close()


def initialize_accounts_database(database):
    with connect(database) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                age_group TEXT NOT NULL DEFAULT '19-25',
                created_at TEXT NOT NULL
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        connection.execute("CREATE INDEX IF NOT EXISTS auth_sessions_user_id ON auth_sessions(user_id)")


# Small pure helpers for time, token hashing, request bodies and response shapes.
def utc_now():
    return datetime.now(timezone.utc)


def token_digest(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def json_object():
    payload = request.get_json(silent=True)
    return payload if isinstance(payload, dict) else {}


def credentials_from(payload):
    email, password = payload.get("email", ""), payload.get("password", "")
    if not isinstance(email, str) or not isinstance(password, str):
        return None, None
    return email.strip(), password


def public_user(user):
    return {"id": user["id"], "email": user["email"], "age_group": user["age_group"]}


def fetch_public_user(connection, user_id):
    return connection.execute("SELECT id, email, age_group FROM users WHERE id = ?", (user_id,)).fetchone()


# Brute-force protection: recent failed sign-ins counted per client address and per email.
class LoginThrottle:
    """In-memory and per process, so limits reset when the server restarts."""

    MAX_TRACKED_KEYS = 10_000

    def __init__(self, limit=LOGIN_FAILURE_LIMIT, window=LOGIN_FAILURE_WINDOW):
        self.limit, self.window = limit, window
        self.failures = {}
        self.lock = threading.Lock()

    def _prune(self, now):
        self.failures = {
            key: recent for key, times in self.failures.items()
            if (recent := [t for t in times if now - t < self.window])
        }

    def blocked(self, keys):
        now = utc_now()
        with self.lock:
            return any(
                sum(now - t < self.window for t in self.failures.get(key, ())) >= self.limit
                for key in keys
            )

    def record_failure(self, keys):
        now = utc_now()
        with self.lock:
            if len(self.failures) >= self.MAX_TRACKED_KEYS:
                self._prune(now)
            for key in keys:
                self.failures.setdefault(key, []).append(now)

    def reset(self, key):
        with self.lock:
            self.failures.pop(key, None)


# The /auth blueprint: session issuing, the auth guard and its routes.
def create_auth_blueprint(database):
    auth = Blueprint("auth", __name__)
    throttle = LoginThrottle()

    def issue_session(user_id):
        token = secrets.token_urlsafe(32)
        now = utc_now()
        with connect(database) as connection:
            # Expired sessions are otherwise removed only when someone presents them.
            connection.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (now.isoformat(),))
            connection.execute(
                "INSERT INTO auth_sessions(token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                (token_digest(token), user_id, (now + timedelta(days=SESSION_DAYS)).isoformat(), now.isoformat()),
            )
        return token

    def require_session(handler):
        @wraps(handler)
        def wrapped(*args, **kwargs):
            scheme, _, token = request.headers.get("Authorization", "").partition(" ")
            if scheme.lower() != "bearer" or not token:
                return jsonify({"error": "Sign in to continue."}), 401
            digest = token_digest(token)
            with connect(database) as connection:
                row = connection.execute("""
                    SELECT users.id, users.email, users.age_group, auth_sessions.expires_at
                    FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
                    WHERE auth_sessions.token_hash = ?
                """, (digest,)).fetchone()
                if row and datetime.fromisoformat(row["expires_at"]) <= utc_now():
                    connection.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (digest,))
                    row = None
            if not row:
                return jsonify({"error": "Your session has expired. Please sign in again."}), 401
            g.account = row
            g.token_hash = digest
            return handler(*args, **kwargs)
        return wrapped

    @auth.post("/auth/register")
    def register():
        email, password = credentials_from(json_object())
        if email is None:
            return jsonify({"error": "Enter a valid email and password."}), 400
        email = email.lower()
        if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
            return jsonify({"error": "Enter a valid email address."}), 400
        if len(password) < 10 or len(password) > 1024:
            return jsonify({"error": "Use a password between 10 and 1024 characters."}), 400
        try:
            with connect(database) as connection:
                cursor = connection.execute(
                    "INSERT INTO users(email, password_hash, created_at) VALUES (?, ?, ?)",
                    (email, generate_password_hash(password), utc_now().isoformat()),
                )
                user = fetch_public_user(connection, cursor.lastrowid)
        except sqlite3.IntegrityError:
            return jsonify({"error": "An account with that email already exists. Try signing in."}), 409
        return jsonify({"user": public_user(user), "token": issue_session(user["id"])}), 201

    @auth.post("/auth/login")
    def login():
        email, password = credentials_from(json_object())
        if email is None:
            return jsonify({"error": "Enter your email and password."}), 400
        email_key = ("email", email.lower())
        throttle_keys = (("address", request.remote_addr), email_key)
        if throttle.blocked(throttle_keys):
            return jsonify({"error": "Too many sign-in attempts. Please wait 15 minutes and try again."}), 429
        with connect(database) as connection:
            user = connection.execute(
                "SELECT id, email, age_group, password_hash FROM users WHERE email = ? COLLATE NOCASE",
                (email,),
            ).fetchone()
        password_ok = check_password_hash(user["password_hash"] if user else DUMMY_PASSWORD_HASH, password)
        if not user or not password_ok:
            throttle.record_failure(throttle_keys)
            return jsonify({"error": "Email or password is incorrect."}), 401
        # Only the email's counter is cleared, so one valid account cannot unlock a guessing address.
        throttle.reset(email_key)
        return jsonify({"user": public_user(user), "token": issue_session(user["id"])}), 200

    @auth.get("/auth/me")
    @require_session
    def me():
        return jsonify({"user": public_user(g.account)})

    @auth.put("/auth/me")
    @require_session
    def update_me():
        age_group = json_object().get("age_group")
        if not isinstance(age_group, str) or age_group not in AGE_GROUPS:
            return jsonify({"error": "Choose a valid age range."}), 400
        with connect(database) as connection:
            connection.execute("UPDATE users SET age_group = ? WHERE id = ?", (age_group, g.account["id"]))
            user = fetch_public_user(connection, g.account["id"])
        return jsonify({"user": public_user(user)})

    @auth.post("/auth/logout")
    @require_session
    def logout():
        with connect(database) as connection:
            connection.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (g.token_hash,))
        return jsonify({"status": "signed_out"})

    return auth
