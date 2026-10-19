import copy
import importlib.util
import unittest

spec = importlib.util.spec_from_file_location('early_comparison', 'scripts/compare-early-percussion-decisions.py')
comparison = importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparison)


class EarlyDecisionScreens(unittest.TestCase):
    def test_timing_compatibility_cannot_admit_changed_dependency_or_threshold(self):
        old = {'contract': {'codeSha256': {p: before for p, (before, _) in comparison.compatibility.TIMING_SOURCES.items()},
                            'thresholds': [.22, .24], 'dependencies': {'example': '1'}}}
        old['fingerprint'] = comparison.evidence.digest(old['contract'])
        current = copy.deepcopy(old)
        current['contract']['codeSha256'] = {p: after for p, (_, after) in comparison.compatibility.TIMING_SOURCES.items()}
        comparison.accept_timing_only(old, current)
        for key, value in [('thresholds', [.1, .1]), ('dependencies', {'example': '2'})]:
            changed = copy.deepcopy(current)
            changed['contract'][key] = value
            with self.assertRaises(AssertionError):
                comparison.accept_timing_only(old, changed)

    def test_natural_regression_screen_rejects_damage_in_each_class(self):
        for cls in ['kick', 'snare', 'hat']:
            base = {'variant': 'L0', 'kind': 'independent-natural-reference', 'domain': 'full-mix', 'labelMode': 'instrument',
                    'classes': {c: {'f1': .9, 'precision': .9, 'recall': .9, 'denseRecall': .9, 'overlapRecall': .9}
                                for c in ['kick', 'snare', 'hat']}}
            changed = copy.deepcopy(base)
            changed['variant'] = 'L1-gap0'
            changed['classes'][cls]['f1'] = .87
            result = comparison.screens({'summary': [base, changed], 'scored': []}, [], ['L0', 'L1-gap0'])
            self.assertFalse(result['L1-gap0']['eligibleForRuntime'])
            self.assertIn('full-mix/' + cls + '/f1 regression', result['L1-gap0']['reasons'])


if __name__ == '__main__':
    unittest.main()
