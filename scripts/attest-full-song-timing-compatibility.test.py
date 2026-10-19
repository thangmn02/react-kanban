import copy
import importlib.util
import unittest

spec = importlib.util.spec_from_file_location('timing_compatibility', 'scripts/attest-full-song-timing-compatibility.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TimingCompatibilityTests(unittest.TestCase):
    def contracts(self):
        old = {'identities': {'A': {'contract': {'modelSha256': 'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a',
               'codeSha256': {p: pair[0] for p, pair in module.TIMING_SOURCES.items()}, 'thresholds': [.22, .24]}},
               'B': {'contract': {'modelSha256': '785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db'}}}, 'dependencies': {'example': '1'}}
        old['identities']['A']['fingerprint'] = module.digest(old['identities']['A']['contract'])
        current = copy.deepcopy(old)
        current['identities']['A']['contract']['codeSha256'] = {p: pair[1] for p, pair in module.TIMING_SOURCES.items()}
        current['identities']['A']['fingerprint'] = module.digest(current['identities']['A']['contract'])
        return old, current

    def test_only_pinned_timing_revisions_are_compatible(self):
        old, current = self.contracts()
        module.check_compatibility(old, current)
        for mutate in [lambda x: x['dependencies'].update(example='2'),
                       lambda x: x['identities']['A']['contract'].update(thresholds=[.1, .1]),
                       lambda x: x['identities']['B']['contract'].update(modelSha256='0' * 64)]:
            changed = copy.deepcopy(current)
            mutate(changed)
            changed['identities']['A']['fingerprint'] = module.digest(changed['identities']['A']['contract'])
            with self.assertRaises(ValueError):
                module.check_compatibility(old, changed)

    def test_unreviewed_source_revision_is_rejected(self):
        old, current = self.contracts()
        current['identities']['A']['contract']['codeSha256'][next(iter(module.TIMING_SOURCES))] = '0' * 64
        current['identities']['A']['fingerprint'] = module.digest(current['identities']['A']['contract'])
        with self.assertRaises(ValueError):
            module.check_compatibility(old, current)


if __name__ == '__main__':
    unittest.main()
