"""Focused artifact rejection tests; live authentication is verified separately."""
import hashlib
import json
import runpy
import tempfile
import unittest
from pathlib import Path

H = runpy.run_path(str(Path(__file__).with_name('deploy-lead-audio-test.py')))


class PackagingTest(unittest.TestCase):
    def setUp(self):
        H['WORK'].mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=H['WORK'])
        self.addCleanup(self.temp.cleanup)
        self.package = Path(self.temp.name)
        self.directory = self.package / '.netlify/edge-functions-dist'
        self.directory.mkdir(parents=True)
        self.source = self.package / 'netlify/edge-functions/auth.js'
        self.source.parent.mkdir(parents=True)
        self.source.write_text('test-only source')
        (self.package / 'netlify.toml').write_text('test-only config')
        self.data = b'unit-test artifact'
        self.digest = hashlib.sha256(self.data).hexdigest()
        self.bundle = self.directory / (self.digest + '.eszip')
        self.bundle.write_bytes(self.data)
        self.manifest = {'bundles': [{'asset': self.bundle.name, 'format': 'eszip2'}],
                         'routes': [{'function': 'auth', 'path': '/*', 'pattern': '^(?:/(.*))/?$', 'excluded_patterns': []}],
                         'post_cache_routes': [], 'function_config': {'auth': {'on_error': 'fail'}}}
        self.write_proof()

    def write_proof(self):
        path = self.directory / 'manifest.json'
        path.write_text(json.dumps(self.manifest))
        proof = {'cliVersion': H['CLI_VERSION'], 'bundleSha256': self.digest,
                 'manifestSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                 'inputs': {p: hashlib.sha256((self.package / p).read_bytes()).hexdigest()
                            for p in ['netlify.toml', 'netlify/edge-functions/auth.js']}}
        (self.package / '.netlify/edge-build-proof.json').write_text(json.dumps(proof))

    def test_matching_artifact_is_accepted(self):
        self.assertEqual(H['validate_compiled_edge'](self.package)['route'], '/*')

    def test_missing_bundle_is_rejected(self):
        self.bundle.unlink()
        with self.assertRaises(OSError): H['validate_compiled_edge'](self.package)

    def test_changed_bundle_is_rejected(self):
        self.bundle.write_bytes(b'corrupted')
        with self.assertRaises(RuntimeError): H['validate_compiled_edge'](self.package)

    def test_changed_source_requires_rebuild(self):
        self.source.write_text('changed')
        with self.assertRaises(RuntimeError): H['validate_compiled_edge'](self.package)

    def test_missing_build_proof_is_rejected(self):
        (self.package / '.netlify/edge-build-proof.json').unlink()
        with self.assertRaises(RuntimeError): H['validate_compiled_edge'](self.package)

    def test_excluded_routes_and_fail_open_are_rejected(self):
        for change in ['excluded', 'cache', 'bypass', 'wrong-function', 'wrong-path']:
            with self.subTest(change=change):
                saved = json.loads(json.dumps(self.manifest))
                if change == 'excluded': self.manifest['routes'][0]['excluded_patterns'] = ['private']
                if change == 'cache': self.manifest['post_cache_routes'] = self.manifest['routes']
                if change == 'bypass': self.manifest['function_config']['auth']['on_error'] = 'bypass'
                if change == 'wrong-function': self.manifest['routes'][0]['function'] = 'other'
                if change == 'wrong-path': self.manifest['routes'][0]['path'] = '/probe.txt'
                self.write_proof()
                with self.assertRaises(RuntimeError): H['validate_compiled_edge'](self.package)
                self.manifest = saved


if __name__ == '__main__':
    unittest.main()
