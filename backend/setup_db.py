"""Rebuild the products table in skincare.db from products.py (accounts are left untouched)."""

import sqlite3
from contextlib import closing
from pathlib import Path

from products import PRODUCTS_TABLE_SQL, insert_catalogue

DATABASE_PATH = Path(__file__).resolve().parent / 'skincare.db'

with closing(sqlite3.connect(DATABASE_PATH)) as connection, connection:
    connection.execute(PRODUCTS_TABLE_SQL)
    connection.execute('DELETE FROM products')
    insert_catalogue(connection)

print("Database created and populated successfully.")
