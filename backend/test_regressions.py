"""Regression tests for age-group mapping, auth edge cases and /predict input handling."""

import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from flask import Flask

import accounts
import app as backend_app
import recommend


# Every age range the mobile app and account API offer must reach RecLogic.csv rows.
class AgeGroupMappingTests(unittest.TestCase):
    def test_every_account_age_group_maps_to_dataset_rows(self):
        dataset_groups = set(recommend.df['Age_Group'].unique())
        for age_group in accounts.AGE_GROUPS:
            self.assertIn(recommend.AGE_GROUP_TO_DATASET[age_group], dataset_groups, age_group)
            self.assertTrue(recommend.get_ideal_ingredients('Oily', ['Acne'], age_group), age_group)

    def test_prefer_not_to_say_skips_age_filtering(self):
        self.assertIsNone(recommend.AGE_GROUP_TO_DATASET['Prefer not to say'])
        self.assertTrue(recommend.get_ideal_ingredients('Oily', ['Acne'], 'Prefer not to say'))


# Auth routes on an isolated database.
class AccountTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        database = Path(self.temp_dir.name) / 'accounts.db'
        accounts.initialize_accounts_database(database)
        flask_app = Flask(__name__)
        flask_app.register_blueprint(accounts.create_auth_blueprint(database))
        self.client = flask_app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def register(self, email='person@example.com', password='long enough password'):
        return self.client.post('/auth/register', json={'email': email, 'password': password})

    def test_register_login_update_and_logout(self):
        created = self.register(email=' Person@Example.com ')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json['user']['email'], 'person@example.com')
        self.assertEqual(self.register().status_code, 409)

        login = self.client.post('/auth/login', json={'email': 'PERSON@example.com', 'password': 'long enough password'})
        self.assertEqual(login.status_code, 200)
        headers = {'Authorization': f"Bearer {login.json['token']}"}

        updated = self.client.put('/auth/me', json={'age_group': '26-35'}, headers=headers)
        self.assertEqual(updated.json['user']['age_group'], '26-35')
        self.assertEqual(self.client.post('/auth/logout', headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/auth/me', headers=headers).status_code, 401)
        # Logging out one session leaves the other one active.
        other = {'Authorization': f"Bearer {created.json['token']}"}
        self.assertEqual(self.client.get('/auth/me', headers=other).status_code, 200)

    def test_wrong_password_and_unknown_email_get_the_same_answer(self):
        self.register()
        wrong = self.client.post('/auth/login', json={'email': 'person@example.com', 'password': 'not the password'})
        unknown = self.client.post('/auth/login', json={'email': 'nobody@example.com', 'password': 'not the password'})
        self.assertEqual((wrong.status_code, wrong.json), (unknown.status_code, unknown.json))

    def test_non_object_json_bodies_are_rejected_not_crashing(self):
        self.assertEqual(self.client.post('/auth/register', json=['email']).status_code, 400)
        self.assertEqual(self.client.post('/auth/login', json=['email']).status_code, 401)
        token = self.register().json['token']
        response = self.client.put('/auth/me', json={'age_group': ['26-35']}, headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(response.status_code, 400)

    def test_missing_or_malformed_authorization(self):
        self.assertEqual(self.client.get('/auth/me').status_code, 401)
        self.assertEqual(self.client.get('/auth/me', headers={'Authorization': 'Bearer unknown'}).status_code, 401)
        self.assertEqual(self.client.get('/auth/me', headers={'Authorization': 'Basic abc'}).status_code, 401)


# /predict request handling that does not need a real face or model.
class PredictInputTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = backend_app.app.test_client()

    @staticmethod
    def image():
        from PIL import Image
        content = io.BytesIO()
        Image.new('RGB', (64, 64), 'white').save(content, format='PNG')
        content.seek(0)
        return (content, 'face.png')

    def post(self, **fields):
        return self.client.post('/predict', data={'image': self.image(), **fields}, content_type='multipart/form-data')

    def test_invalid_options_are_rejected_before_face_detection(self):
        with patch.object(backend_app, 'contains_face') as detector:
            response = self.post(concerns='not json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json['error'], 'Invalid analysis options.')
        detector.assert_not_called()

    def test_invalid_ingredient_lists_and_categories(self):
        concerns = json.dumps(['Acne'])
        self.assertEqual(self.post(concerns=concerns, sensitivities=json.dumps([1])).json['error'], 'Invalid ingredient preferences format.')
        self.assertEqual(self.post(concerns=concerns, categories=json.dumps(['face mask'])).status_code, 400)
        self.assertEqual(self.post(concerns=json.dumps(['No Skin Concerns', 'Acne'])).status_code, 400)

    def test_face_detection_errors_do_not_leak_details(self):
        with patch.object(backend_app, 'contains_face', side_effect=ValueError('internal detail')):
            response = self.post(concerns=json.dumps(['Acne']))
        self.assertEqual(response.status_code, 422)
        self.assertNotIn('internal detail', response.json['error'])

    def test_oversized_upload_returns_json_413(self):
        with patch.dict(backend_app.app.config, {'MAX_CONTENT_LENGTH': 100}):
            response = self.post(concerns=json.dumps(['Acne']))
        self.assertEqual(response.status_code, 413)
        self.assertIn('too large', response.json['error'])


if __name__ == '__main__':
    unittest.main()
