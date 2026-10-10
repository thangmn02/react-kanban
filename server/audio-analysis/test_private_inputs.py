"""Raw input retention, independent of models and output cache."""
import importlib.util
from pathlib import Path
from datetime import datetime, timezone
import unittest

spec = importlib.util.spec_from_file_location('private_inputs', Path(__file__).with_name('private-inputs.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PrivateInputTests(unittest.TestCase):
    def test_expiry_removes_only_old_objects_from_private_input_bucket(self):
        calls = []
        folder = 'a' * 64
        def storage(path, body, method='POST'):
            calls.append((path, body, method))
            if body.get('prefix') == '': return [{'name': folder}, {'name': 'unexpected'}]
            if method == 'DELETE': return []
            return [{'id': 'old', 'name': 'old.wav', 'updated_at': '2026-10-07T10:00:00Z'},
                    {'id': 'fresh', 'name': 'new.wav', 'updated_at': '2026-10-07T11:59:00Z'},
                    {'name': 'directory'}]
        result = module.cleanup_expired_inputs('https://cache.example', 'server-only', datetime(2026, 10, 7, 12, tzinfo=timezone.utc), storage)
        self.assertEqual(result['deleted'], 1)
        self.assertEqual(calls[-1], ('object/beat-audio-inputs', {'prefixes': [folder + '/old.wav']}, 'DELETE'))
        self.assertTrue(all('beat-audio-inputs' in call[0] for call in calls))

    def test_empty_bucket_and_invalid_origin(self):
        self.assertEqual(module.cleanup_expired_inputs('https://cache.example', 'key', request=lambda *a: []), {'deleted': 0, 'scanned': 0, 'bounded': False})
        with self.assertRaises(ValueError): module.cleanup_expired_inputs('http://cache.example', 'key')


if __name__ == '__main__': unittest.main()
