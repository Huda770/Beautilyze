import sqlite3

# Connect to (or create) the database file
conn = sqlite3.connect('skincare.db')
cursor = conn.cursor()

# Create the products table
cursor.execute('''
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    skin_types TEXT NOT NULL,
    ingredients TEXT NOT NULL
)
''')

# Clear existing data (so re-running this script doesn't duplicate rows)
cursor.execute('DELETE FROM products')

# Import your existing product list
from products import products

for product in products:
    cursor.execute('''
        INSERT INTO products (name, category, skin_types, ingredients)
        VALUES (?, ?, ?, ?)
    ''', (
        product['name'],
        product['category'],
        ','.join(product['skin_types']),
        ','.join(product['ingredients'])
    ))

conn.commit()
conn.close()

print("Database created and populated successfully.")