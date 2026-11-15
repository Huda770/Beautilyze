"""Focused regression tests for result explanations and saved preferences."""

import io
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

import torch
from PIL import Image

import app as backend_app
import recommend
from explanations import CONCERN_EXPLANATIONS, SKIN_TYPE_EXPLANATIONS, explanations_for
from profile_store import initialize_profile_table


TEST_USER_ID = '4e729f7a-7594-4f5c-9b0a-c065d2901211'


def read_one(database_path, query, parameters=()):
    with closing(sqlite3.connect(database_path)) as connection:
        return connection.execute(query, parameters).fetchone()


class FakeModel:
    def __init__(self, logits):
        self.logits = torch.tensor([logits], dtype=torch.float32)

    def __call__(self, _image_tensor):
        return self.logits


class FeatureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = backend_app.app.test_client()
        cls.original_database_path = backend_app.app.config.get('DATABASE_PATH')

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.database_path = Path(self.temp_dir.name) / 'test-profile.db'
        initialize_profile_table(self.database_path)
        backend_app.app.config['DATABASE_PATH'] = self.database_path

    def tearDown(self):
        backend_app.app.config['DATABASE_PATH'] = self.original_database_path
        self.temp_dir.cleanup()

    def test_profile_create_retrieve_update_and_restart_persistence(self):
        before = read_one(backend_app.DATABASE_PATH, 'SELECT COUNT(*) FROM products')[0]

        first_read = self.client.get(f'/profile/{TEST_USER_ID}')
        self.assertEqual(first_read.status_code, 200)
        self.assertFalse(first_read.json['saved'])
        self.assertEqual(first_read.json['age_group'], 'Prefer not to say')

        saved = self.client.put(f'/profile/{TEST_USER_ID}', json={
            'age_group': '25-34',
            'preferred_categories': ['cleanser', 'sunscreen', 'serum'],
        })
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json['preferred_categories'], ['cleanser', 'sunscreen', 'serum'])

        # A second GET represents a later app session; the server database retains the values.
        returned = self.client.get(f'/profile/{TEST_USER_ID}')
        self.assertTrue(returned.json['saved'])
        self.assertEqual(returned.json['age_group'], '25-34')
        self.assertEqual(returned.json['preferred_categories'], ['cleanser', 'sunscreen', 'serum'])

        updated = self.client.put(f'/profile/{TEST_USER_ID}', json={
            'age_group': 'Prefer not to say',
            'preferred_categories': ['treatment', 'moisturizer'],
        })
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json['preferred_categories'], ['treatment', 'moisturizer'])

        columns = read_one(self.database_path,
            'SELECT age_group, preferred_categories FROM user_profiles WHERE user_id = ?',
            (TEST_USER_ID,),
        )
        self.assertEqual(columns[0], 'Prefer not to say')
        self.assertEqual(json.loads(columns[1]), ['treatment', 'moisturizer'])
        after = read_one(backend_app.DATABASE_PATH, 'SELECT COUNT(*) FROM products')[0]
        self.assertEqual(before, after)

    def test_profile_input_validation(self):
        invalid_age = self.client.put(f'/profile/{TEST_USER_ID}', json={
            'age_group': 'exactly 21', 'preferred_categories': [],
        })
        invalid_category = self.client.put(f'/profile/{TEST_USER_ID}', json={
            'age_group': '18-24', 'preferred_categories': ['face mask'],
        })
        invalid_id = self.client.get('/profile/not-a-uuid')
        self.assertEqual(invalid_age.status_code, 400)
        self.assertEqual(invalid_category.status_code, 400)
        self.assertEqual(invalid_id.status_code, 400)

    def test_explanation_maps_cover_model_and_recommendation_concern_labels(self):
        self.assertEqual(set(SKIN_TYPE_EXPLANATIONS), set(backend_app.class_names))
        self.assertEqual(set(CONCERN_EXPLANATIONS), set(recommend.df['Concern'].unique()) | {'No Skin Concerns'})
        for skin_type in backend_app.class_names:
            self.assertTrue(explanations_for(skin_type, [])['skin_type'])
        for concern, explanation in CONCERN_EXPLANATIONS.items():
            self.assertTrue(explanation, concern)
            self.assertEqual(explanations_for('oily', [concern])['selected_concerns'][concern], explanation)

    def test_no_face_response_suggests_a_new_clear_image(self):
        image = self._image_upload()
        with patch.object(backend_app, 'contains_face', return_value=False):
            response = self.client.post('/predict', data={
                'image': image,
                'concerns': json.dumps(['Acne']),
            }, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 400)
        self.assertIn('upload another image', response.json['error'])
        self.assertIn('face clearly visible', response.json['error'])

    def test_predict_returns_explanations_for_every_model_type_and_concern(self):
        for class_index, skin_type in enumerate(backend_app.class_names):
            for concern in recommend.df['Concern'].unique():
                logits = [-2.0] * len(backend_app.class_names)
                logits[class_index] = 2.0
                response = self._predict(logits, [concern])
                self.assertEqual(response.status_code, 200, response.json)
                self.assertEqual(response.json['skin_type'], skin_type)
                self.assertEqual(response.json['explanations']['skin_type'], SKIN_TYPE_EXPLANATIONS[skin_type])
                self.assertEqual(response.json['explanations']['selected_concerns'][concern], CONCERN_EXPLANATIONS[concern])
                self.assertTrue(response.json['result_reliable'])

    def test_low_confidence_is_marked_as_uncertain(self):
        response = self._predict([0.0, 0.0, 0.0], ['Acne'])
        self.assertEqual(response.status_code, 200, response.json)
        self.assertFalse(response.json['result_reliable'])
        self.assertIn('uncertain', response.json['note'].lower())

    def test_predict_rejects_unavailable_skin_goals(self):
        response = self._predict([3.0, -2.0, -2.0], ['Texture Issues'])
        self.assertEqual(response.status_code, 400)
        self.assertIn('not supported', response.json['error'])

    def test_saved_preferences_are_used_for_recommendation_context(self):
        self.client.put(f'/profile/{TEST_USER_ID}', json={
            'age_group': '35-44',
            'preferred_categories': ['serum', 'sunscreen'],
        })
        logits = [3.0, -2.0, -2.0]
        with patch.object(backend_app, 'contains_face', return_value=True), \
             patch.object(backend_app, 'transform', return_value=torch.zeros((3, 224, 224))), \
             patch.object(backend_app, 'model', FakeModel(logits)), \
             patch.object(backend_app, 'build_routine', return_value={'serum': {'name': 'Test serum'}}) as build:
            response = self.client.post('/predict', data={
                'image': self._image_upload(),
                'user_id': TEST_USER_ID,
                'age_group': 'Under 18',
                'categories': json.dumps(['cleanser']),
                'concerns': json.dumps(['Acne']),
            }, content_type='multipart/form-data')

        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json['preferred_categories'], ['serum', 'sunscreen'])
        self.assertEqual(build.call_args.args[2], '35-44')
        self.assertEqual(build.call_args.kwargs['preferred_categories'], ['serum', 'sunscreen'])
        self.assertIsNone(build.call_args.kwargs['selected_categories'])

    def test_no_saved_preferences_keep_the_existing_general_recommendation_path(self):
        logits = [3.0, -2.0, -2.0]
        with patch.object(backend_app, 'contains_face', return_value=True), \
             patch.object(backend_app, 'transform', return_value=torch.zeros((3, 224, 224))), \
             patch.object(backend_app, 'model', FakeModel(logits)), \
             patch.object(backend_app, 'build_routine', return_value={}) as build:
            response = self.client.post('/predict', data={
                'image': self._image_upload(),
                'user_id': TEST_USER_ID,
                'age_group': 'Prefer not to say',
                'categories': json.dumps([]),
                'concerns': json.dumps(['Acne']),
            }, content_type='multipart/form-data')

        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json['preferred_categories'], [])
        self.assertEqual(build.call_args.args[2], '19-25')
        self.assertIsNone(build.call_args.kwargs['selected_categories'])
        self.assertEqual(build.call_args.kwargs['preferred_categories'], [])
        self.assertIn('No matching products', response.json['recommendation_note'])

    def test_category_preferences_prioritize_only_skin_suitable_products(self):
        catalogue = [
            {'name': 'Suitable moisturizer', 'category': 'moisturizer', 'skin_types': ['oily-skin'], 'ingredients': []},
            {'name': 'Suitable serum', 'category': 'serum', 'skin_types': ['oily-skin'], 'ingredients': []},
            {'name': 'Unsuitable sunscreen', 'category': 'sunscreen', 'skin_types': ['dry-skin'], 'ingredients': []},
            {'name': 'Suitable cleanser', 'category': 'cleanser', 'skin_types': ['oily-skin'], 'ingredients': []},
        ]
        with patch.object(recommend, 'get_products', return_value=catalogue):
            routine = recommend.build_routine(
                'oily', ['General'], 'Prefer not to say',
                preferred_categories=['serum', 'sunscreen'],
            )
        self.assertEqual(list(routine), ['serum', 'moisturizer', 'cleanser'])
        self.assertNotIn('sunscreen', routine)

    def _predict(self, logits, concerns):
        with patch.object(backend_app, 'contains_face', return_value=True), \
             patch.object(backend_app, 'transform', return_value=torch.zeros((3, 224, 224))), \
             patch.object(backend_app, 'model', FakeModel(logits)):
            return self.client.post('/predict', data={
                'image': self._image_upload(),
                'age_group': 'Under 18',
                'concerns': json.dumps(concerns),
            }, content_type='multipart/form-data')

    @staticmethod
    def _image_upload():
        image = Image.new('RGB', (200, 240), 'white')
        content = io.BytesIO()
        image.save(content, format='JPEG')
        content.seek(0)
        return (content, 'face.jpg')


if __name__ == '__main__':
    unittest.main()
