"""Local contract tests; no model downloads, credentials or external calls."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
import app as service


class WardrobeApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(service.app)

    def test_health_and_missing_chat_configuration(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
            self.assertFalse(self.client.get('/api/health').json()['deepseek_configured'])
            self.assertEqual(self.client.post('/api/chat', json={"message": ""}).status_code, 400)
            self.assertEqual(self.client.post('/api/chat', json={"message": "今天怎么穿"}).status_code, 500)

    def test_weather_contract(self):
        forecast = {"city": "测试城市", "days": [{"highC": 22, "lowC": 16, "condition": "晴朗"}]}
        with patch.object(service, '_weather_days', return_value=forecast) as weather:
            result = self.client.get('/api/weather?days=1&latitude=20&longitude=110')
            self.assertEqual(result.json(), forecast)
            weather.assert_called_once_with('', 1, 20.0, 110.0)

    def test_upload_response_and_empty_inventory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(service, 'UPLOAD_DIR', root), patch.object(service, 'OUTPUT_DIR', root), patch.object(service, 'DB_PATH', root / 'wardrobe.db'):
                with patch.object(service, 'analyze_and_save', return_value={"name": "白衬衫", "cutout_path": str(root / 'shirt.png')}) as analyze:
                    response = self.client.post('/api/analyze', files={"file": ('shirt.png', b'fixture', 'image/png')})
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()['item']['image'], '/files/shirt.png')
                    self.assertEqual(response.json()['item']['name'], '白衬衫')
                    self.assertEqual(analyze.call_count, 1)
                self.assertEqual(self.client.get('/api/items').json(), [])

    def test_provider_failure_is_reported(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(service, 'UPLOAD_DIR', Path(directory)), patch.object(service, 'analyze_and_save', side_effect=RuntimeError('模型不可用')):
            result = self.client.post('/api/analyze', files={"file": ('shirt.png', b'fixture', 'image/png')})
            self.assertEqual(result.status_code, 502)
            self.assertIn('模型不可用', result.json()['detail'])


if __name__ == '__main__':
    unittest.main()
