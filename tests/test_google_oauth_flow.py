import unittest
from unittest.mock import patch, MagicMock
from app import create_app
from app.models import db
from app.models.user import User
from app.models.patient import Patient

class TestGoogleOAuthFlow(unittest.TestCase):
    def setUp(self):
        self.app = create_app('admin', test_config={
            'TESTING': True,
            'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
            'GOOGLE_CLIENT_ID': 'test-google-client-id-12345.apps.googleusercontent.com',
            'GOOGLE_CLIENT_SECRET': 'test-google-client-secret-xyz987',
            'GOOGLE_REDIRECT_URI': 'http://localhost:5000/api/auth/google/callback',
            'WTF_CSRF_ENABLED': False,
            'SECRET_KEY': 'oauth-test-secret',
        })
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_oauth_status_enabled(self):
        res = self.client.get('/api/auth/oauth-status')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertTrue(data['google_enabled'])
        self.assertEqual(data['google_client_id'], 'test-google-client-id-12345.apps.googleusercontent.com')

    def test_oauth_initiation_redirect(self):
        res = self.client.get('/api/auth/google', follow_redirects=False)
        self.assertEqual(res.status_code, 302)
        location = res.headers.get('Location')
        self.assertIn('https://accounts.google.com/o/oauth2/v2/auth', location)
        self.assertIn('client_id=test-google-client-id-12345.apps.googleusercontent.com', location)
        self.assertIn('response_type=code', location)
        self.assertIn('state=', location)
        self.assertIn('redirect_uri=http%3A%2F%2Flocalhost%3A5000%2Fapi%2Fauth%2Fgoogle%2Fcallback', location)

    def test_oauth_cancelled_by_user(self):
        res = self.client.get('/api/auth/google/callback?error=access_denied', follow_redirects=False)
        self.assertEqual(res.status_code, 302)
        self.assertIn('/login?error=oauth_cancelled', res.headers.get('Location'))

    def test_oauth_state_mismatch_rejected(self):
        with self.client.session_transaction() as sess:
            sess['oauth_state'] = 'correct-state-token'
        res = self.client.get('/api/auth/google/callback?code=mock_code&state=wrong-state-token', follow_redirects=False)
        self.assertEqual(res.status_code, 302)
        self.assertIn('/login?error=oauth_state_invalid', res.headers.get('Location'))

    @patch('requests.post')
    @patch('requests.get')
    def test_oauth_successful_registration_and_login(self, mock_get, mock_post):
        # 1. Mock token response
        token_mock = MagicMock()
        token_mock.ok = True
        token_mock.json.return_value = {'access_token': 'mock-access-token-999'}
        mock_post.return_value = token_mock

        # 2. Mock userinfo response
        userinfo_mock = MagicMock()
        userinfo_mock.ok = True
        userinfo_mock.json.return_value = {
            'email': 'new.oauth.patient@gmail.com',
            'name': 'Google New Patient',
            'email_verified': True,
            'sub': 'google-uid-100200300'
        }
        mock_get.return_value = userinfo_mock

        # Set session state
        with self.client.session_transaction() as sess:
            sess['oauth_state'] = 'valid-test-state'
            sess['oauth_redirect_uri'] = 'http://localhost:5000/api/auth/google/callback'

        # Execute callback
        res = self.client.get('/api/auth/google/callback?code=valid_code_abc&state=valid-test-state', follow_redirects=False)
        self.assertEqual(res.status_code, 302)
        # Should redirect to patient dashboard
        self.assertEqual(res.headers.get('Location'), '/patient')

        # Verify user created in database with least privilege 'patient' role
        with self.app.app_context():
            user = User.query.filter_by(email='new.oauth.patient@gmail.com').first()
            self.assertIsNotNone(user)
            self.assertEqual(user.name, 'Google New Patient')
            self.assertEqual(user.role, 'patient')
            self.assertTrue(user.active)
            self.assertTrue(user.portal_id.startswith('CC-') or user.portal_id.startswith('PAT-'))

            # Verify Patient record created and linked
            patient = Patient.query.filter_by(email='new.oauth.patient@gmail.com').first()
            self.assertIsNotNone(patient)
            self.assertEqual(patient.full_name, 'Google New Patient')
            self.assertEqual(patient.portal_id, user.portal_id)

    @patch('requests.post')
    @patch('requests.get')
    def test_oauth_existing_user_login(self, mock_get, mock_post):
        # Create existing hepatologist
        with self.app.app_context():
            doc = User(
                name='Dr. Existing Doctor',
                email='doctor.google@careai.com',
                role='hepatologist',
                active=True,
                password_hash='dummy_hash'
            )
            db.session.add(doc)
            db.session.commit()

        token_mock = MagicMock()
        token_mock.ok = True
        token_mock.json.return_value = {'access_token': 'mock-access-token-doc'}
        mock_post.return_value = token_mock

        userinfo_mock = MagicMock()
        userinfo_mock.ok = True
        userinfo_mock.json.return_value = {
            'email': 'doctor.google@careai.com',
            'name': 'Dr. Existing Doctor',
            'email_verified': True,
        }
        mock_get.return_value = userinfo_mock

        with self.client.session_transaction() as sess:
            sess['oauth_state'] = 'doc-test-state'

        res = self.client.get('/api/auth/google/callback?code=doc_code&state=doc-test-state', follow_redirects=False)
        self.assertEqual(res.status_code, 302)
        # Existing doctor should be redirected to doctor dashboard
        self.assertEqual(res.headers.get('Location'), '/doctor')

if __name__ == '__main__':
    unittest.main()

