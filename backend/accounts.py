"""Email and password authentication backed by the existing SQLite database."""

from datetime import datetime, timedelta, timezone
from functools import wraps
import hashlib
import re
import secrets
import sqlite3

from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash


AGE_GROUPS = {"14-18", "19-25", "26-35", "36-45", "45+"}
SESSION_DAYS = 30


def connect(database):
    connection = sqlite3.connect(database)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


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


def utc_now():
    return datetime.now(timezone.utc)


def token_digest(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def public_user(user):
    return {"id": user["id"], "email": user["email"], "age_group": user["age_group"]}


def create_auth_blueprint(database):
    auth = Blueprint("auth", __name__)

    def issue_session(user_id):
        token = secrets.token_urlsafe(32)
        now = utc_now()
        with connect(database) as connection:
            connection.execute(
                "INSERT INTO auth_sessions(token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                (token_digest(token), user_id, (now + timedelta(days=SESSION_DAYS)).isoformat(), now.isoformat()),
            )
        return token

    def require_session(handler):
        @wraps(handler)
        def wrapped(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            scheme, _, token = header.partition(" ")
            if scheme.lower() != "bearer" or not token:
                return jsonify({"error": "Sign in to continue."}), 401
            with connect(database) as connection:
                row = connection.execute("""
                    SELECT users.id, users.email, users.age_group, auth_sessions.token_hash, auth_sessions.expires_at
                    FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
                    WHERE auth_sessions.token_hash = ?
                """, (token_digest(token),)).fetchone()
                if not row:
                    return jsonify({"error": "Your session has expired. Please sign in again."}), 401
                if datetime.fromisoformat(row["expires_at"]) <= utc_now():
                    connection.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (row["token_hash"],))
                    return jsonify({"error": "Your session has expired. Please sign in again."}), 401
                g.account = row
            return handler(*args, **kwargs)
        return wrapped

    @auth.post("/auth/register")
    def register():
        payload = request.get_json(silent=True) or {}
        email = payload.get("email", "")
        password = payload.get("password", "")
        if not isinstance(email, str) or not isinstance(password, str):
            return jsonify({"error": "Enter a valid email and password."}), 400
        email = email.strip().lower()
        if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            return jsonify({"error": "Enter a valid email address."}), 400
        if len(password) < 10 or len(password) > 1024:
            return jsonify({"error": "Use a password between 10 and 1024 characters."}), 400
        now = utc_now().isoformat()
        try:
            with connect(database) as connection:
                cursor = connection.execute(
                    "INSERT INTO users(email, password_hash, created_at) VALUES (?, ?, ?)",
                    (email, generate_password_hash(password), now),
                )
                user_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            return jsonify({"error": "An account with that email already exists. Try signing in."}), 409
        with connect(database) as connection:
            user = connection.execute("SELECT id, email, age_group FROM users WHERE id = ?", (user_id,)).fetchone()
        return jsonify({"user": public_user(user), "token": issue_session(user_id)}), 201

    @auth.post("/auth/login")
    def login():
        payload = request.get_json(silent=True) or {}
        email = payload.get("email", "")
        password = payload.get("password", "")
        if not isinstance(email, str) or not isinstance(password, str):
            return jsonify({"error": "Enter your email and password."}), 400
        with connect(database) as connection:
            user = connection.execute(
                "SELECT id, email, age_group, password_hash FROM users WHERE email = ? COLLATE NOCASE",
                (email.strip(),),
            ).fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Email or password is incorrect."}), 401
        return jsonify({"user": public_user(user), "token": issue_session(user["id"])}), 200

    @auth.get("/auth/me")
    @require_session
    def me():
        return jsonify({"user": public_user(g.account)})

    @auth.put("/auth/me")
    @require_session
    def update_me():
        payload = request.get_json(silent=True) or {}
        age_group = payload.get("age_group")
        if age_group not in AGE_GROUPS:
            return jsonify({"error": "Choose a valid age range."}), 400
        with connect(database) as connection:
            connection.execute("UPDATE users SET age_group = ? WHERE id = ?", (age_group, g.account["id"]))
            user = connection.execute("SELECT id, email, age_group FROM users WHERE id = ?", (g.account["id"],)).fetchone()
        return jsonify({"user": public_user(user)})

    @auth.post("/auth/logout")
    @require_session
    def logout():
        token = request.headers.get("Authorization", "").partition(" ")[2]
        with connect(database) as connection:
            connection.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (token_digest(token),))
        return jsonify({"status": "signed_out"})

    return auth
