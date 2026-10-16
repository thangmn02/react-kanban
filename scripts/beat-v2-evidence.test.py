import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

spec=importlib.util.spec_from_file_location('evidence',Path(__file__).with_name('beat-v2-evidence.py'))
e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)

class Evidence(unittest.TestCase):
    def setUp(self):
        self.item={'id':'test','sha256':'input'}
        self.contract={'fingerprint':'pipeline'}
        self.record={'id':'test','inputSha256':'input','evidenceIdentity':self.contract,'rawOutputSha256':'expected'}

    def test_changed_pipeline_fails_closed(self):
        with self.assertRaises(AssertionError):e.validate(self.record,self.item,{'fingerprint':'other'})

    def test_changed_torchaudio_build_invalidates_cached_results(self):
        original=e.identity('BASE')
        version=e.importlib.metadata.version
        with patch.object(e.importlib.metadata,'version',side_effect=lambda name:'changed-build' if name=='torchaudio' else version(name)):
            changed=e.identity('BASE')
        self.assertNotEqual(original['fingerprint'],changed['fingerprint'])
        record={**self.record,'evidenceIdentity':original,'rawOutputSha256':None}
        with self.assertRaises(AssertionError):e.validate(record,self.item,changed)

    def test_missing_declared_raw_output_fails_closed(self):
        with self.assertRaises(AssertionError):e.validate(self.record,self.item,self.contract)

    def test_changed_raw_output_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            raw=Path(folder)/'model.npz';raw.write_bytes(b'actual')
            with self.assertRaises(AssertionError):e.validate(self.record,self.item,self.contract,raw)
            self.record['rawOutputSha256']=e.sha(raw)
            e.validate(self.record,self.item,self.contract,raw)

    def test_changed_baseline_trace_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            trace=Path(folder)/'trace.json';trace.write_text('original')
            self.record.update(rawOutputSha256=None,reusedEvidence={'trace':str(trace)},reusedTraceSha256=e.sha(trace))
            e.validate(self.record,self.item,self.contract)
            trace.write_text('changed')
            with self.assertRaises(AssertionError):e.validate(self.record,self.item,self.contract)

    def test_container_alias_requires_both_canonical_and_pcm_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            before=e.ROOT;e.ROOT=Path(folder)
            try:
                (e.ROOT/'decoded-pcm-aliases.json').write_text(json.dumps({'test':{
                  'executedContainerSha256':'old','canonicalContainerSha256':'new','decodedPcmSha256':'pcm'}}))
                item={'id':'test','sha256':'new','decodedPcmSha256':'pcm'}
                self.assertTrue(e.equivalent_input('old',item))
                self.assertFalse(e.equivalent_input('old',{**item,'decodedPcmSha256':'changed'}))
                self.assertFalse(e.equivalent_input('old',{**item,'sha256':'other'}))
            finally:e.ROOT=before

if __name__=='__main__':unittest.main()
