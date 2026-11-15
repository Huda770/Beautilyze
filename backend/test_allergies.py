import unittest
import sqlite3
import tempfile
from pathlib import Path
from products import products
from unittest.mock import patch
import recommend

class IngredientExclusionTests(unittest.TestCase):
    def setUp(self):
        self.products = [
            dict(name='First', category='treatment', skin_types=['oily-skin'], ingredients=['Niacinamide (Vitamin B3)', 'Salicylic Acid']),
            dict(name='Alternative', category='treatment', skin_types=['oily-skin'], ingredients=['Azelaic Acid']),
            dict(name='Unknown', category='cleanser', skin_types=['oily-skin'], ingredients=[]),
        ]

    def routine(self, avoid):
        with patch.object(recommend, 'get_products', return_value=self.products):
            return recommend.build_routine('oily', ['General'], '19-25', allergies=avoid)

    def test_exclusion_selects_next_product(self):
        self.assertEqual(self.routine([' NIACINAMIDE '])['treatment']['name'], 'Alternative')

    def test_punctuation_and_spacing(self):
        self.assertEqual(self.routine(['salicylic-acid'])['treatment']['name'], 'Alternative')

    def test_all_products_excluded(self):
        self.assertEqual(self.routine(['niacinamide', 'azelaic acid']), {})

    def test_no_preferences_preserves_recommendations(self):
        self.assertEqual(self.routine([])['treatment']['name'], 'First')

    def test_unknown_ingredients_excluded_when_filtering(self):
        self.assertNotIn('cleanser', self.routine(['niacinamide']))

    def test_whole_phrase_prevents_substring_collisions(self):
        self.assertFalse(recommend.contains_avoided_ingredient(['Stearic Acid'], {'tea'}))

    def test_real_catalogue_excludes_recorded_ingredient(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(recommend, 'BASE_DIR', Path(folder)):
            with sqlite3.connect(Path(folder) / 'skincare.db') as connection:
                connection.execute('CREATE TABLE products (name TEXT, category TEXT, skin_types TEXT, ingredients TEXT)')
                connection.executemany('INSERT INTO products VALUES (?, ?, ?, ?)', [(p['name'], p['category'], ','.join(p['skin_types']), ','.join(p['ingredients'])) for p in products])
            connection.close()
            routine = recommend.build_routine('oily', ['General'], '19-25', allergies=['niacinamide'])
            self.assertTrue(routine)
            for product in routine.values():
                self.assertFalse(recommend.contains_avoided_ingredient(recommend.get_products_by_name(product['name'])['ingredients'], {'niacinamide'}))

if __name__ == '__main__':
    unittest.main()


