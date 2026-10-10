"""Input bounds and demand checks; model-quality evidence uses real holdouts."""
import importlib.util
from pathlib import Path
import sys
import hashlib
from datetime import datetime, timezone, timedelta
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location("range_analysis", Path(__file__).with_name("range-analysis.py"))
module = importlib.util.module_from_spec(spec)
sys.modules["range_analysis"] = module
spec.loader.exec_module(module)


def job():
    return {"analysisVersion": module.VERSION, "duration": 7200, "requestedRange": {"start": 2040, "end": 2340},
            "asset": {"provider": "youtube", "id": "abcdefghijk"}, "jobId": "10000000-0000-4000-8000-000000000001"}


class RangeTests(unittest.TestCase):
    def test_lead_jobs_require_explicit_worker_flag(self):
        value={**job(),"analysisVersion":module.LEAD_VERSION}
        with patch.dict(module.os.environ,{"BEAT_LEAD_PIPELINE":"false"}):
            with self.assertRaises(ValueError):module.validate_job(value)
        with patch.dict(module.os.environ,{"BEAT_LEAD_PIPELINE":"true"}):
            self.assertEqual(module.validate_job(value),(2035,2345))

    def test_missing_registered_input_is_explicitly_unavailable(self):
        class Cache:
            def request(self, path):
                raise HTTPError('https://cache.example', 400, 'Bucket not found', {}, None)
        with tempfile.TemporaryDirectory() as directory, patch.dict(module.os.environ, {"BEAT_FIXTURE_DIRECTORY": ""}):
            with self.assertRaisesRegex(ValueError, 'input_unavailable'):
                module.AuthorizedAudioInput(Cache()).resolve(job(), Path(directory))

    def test_direct_seek_only_requests_small_context(self):
        self.assertEqual(module.validate_job(job()), (2035, 2345))
        for beginning, end in [(0, 7200), (float("nan"), 2340), (2039, 2340), (2040, float("inf"))]:
            value = job()
            value["requestedRange"] = {"start": beginning, "end": end}
            with self.assertRaises(ValueError):
                module.validate_job(value)

    def test_expired_demand_never_resolves_audio_or_imports_models(self):
        class Cache:
            def rpc(self, name, body):
                return job()
            def active(self, record):
                return False
            def finish_failure(self, identity, reason):
                self.reason = reason
        cache = Cache()
        with patch.object(module, "analyze_audio") as analyze:
            result = module.run_range("job", cache, object())
        self.assertEqual(cache.reason, "demand_expired")
        self.assertEqual(result["reason"], "demand_expired")
        analyze.assert_not_called()

    def test_fixture_input_reads_only_requested_samples_and_keeps_absolute_clock(self):
        import hashlib
        import numpy as np
        import soundfile as sf
        value = job()
        value["requestedRange"] = {"start": 30, "end": 60}
        value["duration"] = 90
        with tempfile.TemporaryDirectory() as location:
            directory = Path(location)
            key = hashlib.sha256(b"youtube:abcdefghijk").hexdigest()
            sf.write(str(directory / (key + ".wav")), np.zeros(90*8000), 8000)
            with patch.dict(module.os.environ, {"BEAT_FIXTURE_DIRECTORY": location}):
                audio, offset, seconds = module.AuthorizedAudioInput(None).resolve(value, directory)
            self.assertEqual(offset, 25)
            self.assertAlmostEqual(seconds, 40)
            self.assertEqual(sf.info(str(audio)).samplerate, 44100)

    def test_registered_input_uses_job_owned_private_object_and_cleans_after_failure(self):
        key = hashlib.sha256(b'youtube:abcdefghijk').hexdigest()
        value = job(); value['requestedRange'] = {'start': 30, 'end': 60}
        path = key + '/1760000000000-20000000-0000-4000-8000-000000000001.wav'
        manifest = {'start': 25, 'end': 60, 'inputPath': path, 'jobId': value['jobId'], 'playbackRate': 1,
                    'expiresAt': (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()}
        class Cache:
            origin = 'https://cache.example'; key = 'server-only'
            calls = []
            def request(self, location, body=None, method=None):
                self.calls.append((location, body, method))
                return manifest
        cache = Cache(); resolver = module.AuthorizedAudioInput(cache)
        with tempfile.TemporaryDirectory() as directory, patch.dict(module.os.environ, {'BEAT_FIXTURE_DIRECTORY': ''}), patch.object(module, 'urlopen', side_effect=OSError('disconnected')):
            with self.assertRaises(OSError): resolver.resolve(value, Path(directory))
        resolver.cleanup()
        self.assertTrue(cache.calls[0][0].endswith(value['jobId'] + '.json'))
        self.assertEqual(cache.calls[-1][1]['prefixes'], [path, key + '/' + value['jobId'] + '.json'])

    def test_expired_or_wrong_owner_manifest_never_downloads_raw_audio(self):
        value = job(); value['requestedRange'] = {'start': 0, 'end': 30}
        class Cache:
            def request(self, location):
                return {'start': 0, 'end': 30, 'inputPath': 'untrusted.wav', 'playbackRate': 1,
                        'jobId': 'other-owner', 'expiresAt': datetime.now(timezone.utc).isoformat()}
        with tempfile.TemporaryDirectory() as directory, patch.dict(module.os.environ, {'BEAT_FIXTURE_DIRECTORY': ''}), patch.object(module, 'urlopen') as download:
            with self.assertRaisesRegex(ValueError, 'input_unavailable'):
                module.AuthorizedAudioInput(Cache()).resolve(value, Path(directory))
        download.assert_not_called()


if __name__ == "__main__":
    unittest.main()
