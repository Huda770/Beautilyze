"""SQLite storage and validation for anonymous Beautilyze profiles."""

import json
import re
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path


AGE_GROUPS = (
    'Under 18',
    '18-24',
    '25-34',
    '35-44',
    '45 and above',
    'Prefer not to say',
)

LEGACY_AGE_GROUPS = ('14-18', '19-24', '25-36', '37-45', '45+')
OLDER_CLIENT_AGE_GROUPS = ('19-25', '26-35', '36-45')

USER_ID_PATTERN = re.compile(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-'
    r'[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
)


def initialize_profile_table(database_path: str | Path) -> None:
    """Create the profile table without changing existing product records."""
    with closing(sqlite3.connect(database_path)) as connection:
        with connection:
            connection.execute(
                '''
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
                    age_group TEXT NOT NULL,
                    preferred_categories TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                '''
            )


def is_valid_user_id(user_id: object) -> bool:
    return isinstance(user_id, str) and USER_ID_PATTERN.fullmatch(user_id) is not None


def validate_age_group(age_group: object, allow_legacy: bool = True) -> str:
    if age_group is None:
        return 'Prefer not to say'
    allowed = AGE_GROUPS
    if allow_legacy:
        allowed += LEGACY_AGE_GROUPS + OLDER_CLIENT_AGE_GROUPS
    if not isinstance(age_group, str) or age_group not in allowed:
        raise ValueError('Choose one of the available age groups.')
    return age_group


def validate_categories(categories: object, supported_categories) -> list[str]:
    if categories is None:
        return []
    if not isinstance(categories, list):
        raise ValueError('Preferred product categories must be a list.')
    if len(categories) > len(supported_categories):
        raise ValueError('Too many product categories were selected.')
    if any(not isinstance(category, str) for category in categories):
        raise ValueError('Each product category must be text.')
    unsupported = [category for category in categories if category not in supported_categories]
    if unsupported:
        raise ValueError('One or more product categories are not available.')
    return list(dict.fromkeys(categories))


def get_profile(user_id: str, database_path: str | Path, supported_categories=None) -> dict:
    """Return a saved profile, or safe defaults for a new install."""
    with closing(sqlite3.connect(database_path)) as connection:
        row = connection.execute(
            'SELECT age_group, preferred_categories FROM user_profiles WHERE user_id = ?',
            (user_id,),
        ).fetchone()

    if row is None:
        return {
            'user_id': user_id,
            'age_group': 'Prefer not to say',
            'preferred_categories': [],
            'saved': False,
        }

    try:
        categories = json.loads(row[1])
    except (TypeError, ValueError):
        categories = []
    if not isinstance(categories, list):
        categories = []
    if supported_categories is not None:
        categories = [
            category for category in categories
            if isinstance(category, str) and category in supported_categories
        ]
    else:
        categories = [category for category in categories if isinstance(category, str)]
    categories = list(dict.fromkeys(categories))

    return {
        'user_id': user_id,
        'age_group': row[0] if row[0] in AGE_GROUPS + LEGACY_AGE_GROUPS else 'Prefer not to say',
        'preferred_categories': categories,
        'saved': True,
    }


def save_profile(
    user_id: str,
    payload: object,
    supported_categories,
    database_path: str | Path,
) -> dict:
    if not is_valid_user_id(user_id):
        raise ValueError('A valid app install ID is required.')
    if not isinstance(payload, dict):
        raise ValueError('Send profile preferences as a JSON object.')

    age_group = validate_age_group(payload.get('age_group'), allow_legacy=False)
    categories = validate_categories(payload.get('preferred_categories'), supported_categories)
    timestamp = datetime.now(timezone.utc).isoformat(timespec='seconds')

    with closing(sqlite3.connect(database_path)) as connection:
        with connection:
            connection.execute(
                '''
                INSERT INTO user_profiles (
                    user_id, age_group, preferred_categories, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    age_group = excluded.age_group,
                    preferred_categories = excluded.preferred_categories,
                    updated_at = excluded.updated_at
                ''',
                (user_id, age_group, json.dumps(categories), timestamp, timestamp),
            )

    return get_profile(user_id, database_path, supported_categories)
