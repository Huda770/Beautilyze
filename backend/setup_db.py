"""Rebuild the products table in skincare.db from products.py (accounts are left untouched)."""

import sqlite3
from contextlib import closing
from products import PRODUCTS_TABLE_SQL, insert_catalogue
from recommend import DATABASE_PATH

with closing(sqlite3.connect(DATABASE_PATH)) as connection, connection:
    connection.execute(PRODUCTS_TABLE_SQL)
    connection.execute('DELETE FROM products')
    insert_catalogue(connection)

print("Database created and populated successfully.")
