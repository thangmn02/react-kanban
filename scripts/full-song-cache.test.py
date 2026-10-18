import importlib.util,json,tempfile,unittest,sys
from pathlib import Path
from unittest.mock import patch
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('full_song','scripts/prepare-full-song.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class CacheContracts(unittest.TestCase):
    def test_exact_identity_reuses_success_and_mismatches_do_not(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'result.json';raw=Path(folder)/'raw.json';raw.write_text('original raw evidence')
            record={'cacheKey':'key','sourceSha256':'source','pcmSha256':'pcm','events':[],'eventsSha256':module.digest([]),'rawSha256':module.sha(raw)};p.write_text(json.dumps(record))
            self.assertIsNotNone(module.valid_cache(p,raw,'key','source','pcm'))
            for args in [('other','source','pcm'),('key','other','pcm'),('key','source','other')]:self.assertIsNone(module.valid_cache(p,raw,*args))
            raw.write_text('changed');self.assertIsNone(module.valid_cache(p,raw,'key','source','pcm'))
    def test_damaged_or_missing_lane_is_a_recoverable_cache_miss(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'result.json';raw=Path(folder)/'raw.json'
            for content in ['{','null','{}','[]']:
                p.write_text(content)
                self.assertIsNone(module.valid_cache(p,raw,'key','source','pcm'))
            p.unlink();self.assertIsNone(module.valid_cache(p,raw,'key','source','pcm'))
    def test_numerical_contract_excludes_persistence_format_identity(self):
        _,contract=module.contracts();self.assertNotIn('scripts/prepare-full-song.py',contract['executionSourceSha256']);self.assertIn('scripts/full-song-numerics.py',contract['executionSourceSha256']);self.assertEqual(contract['preparationContractVersion'],1);self.assertEqual(contract['separation']['overlap'],.25)
    def test_separator_cache_checks_seed_frames_contract_and_content(self):
        numeric=module.module('full_song_numerics','scripts/full-song-numerics.py')
        with tempfile.TemporaryDirectory() as folder:
            stem=Path(folder)/'drums.wav';receipt=Path(folder)/'drums.json';stem.write_bytes(b'fixture');valid={'sha256':module.sha(stem),'contract':{'model':'frozen'},'seed':123,'frames':100}
            receipt.write_text(json.dumps(valid));self.assertIsNotNone(numeric.valid_separator(stem,receipt,{'model':'frozen'},123,100))
            for value in [None,[],{},dict(valid,seed=124),dict(valid,frames=99),dict(valid,contract={'model':'other'})]:
                receipt.write_text(json.dumps(value));self.assertIsNone(numeric.valid_separator(stem,receipt,{'model':'frozen'},123,100))
            receipt.write_text('{');self.assertIsNone(numeric.valid_separator(stem,receipt,{'model':'frozen'},123,100))
    def test_mono_flac_resampling_uses_one_measured_canonical_origin(self):
        import numpy as np
        import soundfile as sf
        numeric=module.module('full_song_numerics','scripts/full-song-numerics.py');_,contract=module.contracts()
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);source=root/'input.flac';target=root/'prepared';target.mkdir()
            sf.write(source,np.sin(np.arange(96000)*2*np.pi*220/48000).astype(np.float32)*.1,48000)
            y,sr,duration,pcm,wav,canonical,identity=numeric.canonical_audio(source,target,'input.flac',module.sha(source),contract,module.digest(contract),module.write)
            self.assertEqual(sr,44100);self.assertEqual(len(y),88200);self.assertEqual(duration,2);self.assertEqual(y.shape[1],2);np.testing.assert_array_equal(y[:,0],y[:,1]);self.assertEqual(identity['decodedPcmSha256'],pcm);self.assertEqual(module.sha(canonical),wav);self.assertTrue(identity['transforms']['resampled']);self.assertTrue(identity['transforms']['monoDuplicated']);self.assertEqual(identity['transforms']['addedPaddingSamples'],0);self.assertLessEqual(len(module.read(target/'waveform.json')['overview']),2048)
    def test_damaged_source_metadata_is_archived_before_numerical_preparation(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);path=root/'source.json'
            with patch.object(module.time,'time_ns',return_value=1):
                for value in ['{','null','[]','{}',json.dumps({'decodedPcmSha256':'missing-other-hash'})]:
                    path.write_text(value);module.recover_source_metadata(root);self.assertFalse(path.exists())
            self.assertEqual(len(list(root.glob('source-invalid-*.json'))),5)
if __name__=='__main__':unittest.main()
