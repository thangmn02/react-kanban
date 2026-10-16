import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('scoring',Path(__file__).with_name('score-beat-v2-round.py'))
scoring=importlib.util.module_from_spec(spec);spec.loader.exec_module(scoring)

class Matching(unittest.TestCase):
    def test_one_prediction_cannot_recover_two_rapid_hits(self):
        pairs,tolerance=scoring.match([1,1.02],[1.01],.05)
        self.assertEqual(pairs,[])
        self.assertAlmostEqual(tolerance[0],.005)

    def test_nearest_valid_prediction_and_quarter_gap_are_preserved(self):
        pairs,_=scoring.match([1,1.12],[.99,1.001,1.12],.2)
        self.assertEqual([(p['referenceIndex'],p['predictionIndex']) for p in pairs],[(0,1),(1,2)])

    def test_simultaneous_classes_match_independently(self):
        item={'scoreEligible':True,'referenceStatus':'deterministic-synthetic-reference','kind':'controlled-acoustic',
          'id':'overlap','duration':2,'partition':'locked-holdout','domain':'drum-only',
          'references':[{'time':1,'row':c} for c in ['kick','snare','hat']]}
        record={'lane':'test','events':[{'time':1,'instrument':c,'displayRow':c} for c in ['kick','snare','hat']]}
        result=scoring.score(item,record)
        for c in ['kick','snare','hat']:
            self.assertEqual(result['classes'][c]['tp'],1)
            self.assertEqual(result['classes'][c]['overlapRecall'],1)

    def test_provisional_labels_are_never_scored(self):
        with self.assertRaises(AssertionError):
            scoring.score({'scoreEligible':True,'referenceStatus':'provisional-human-reference'}, {})

    def test_shared_row_collapses_only_exact_coincident_reference_classes(self):
        item={'scoreEligible':True,'referenceStatus':'deterministic-synthetic-reference','kind':'controlled-acoustic',
          'id':'coincident','duration':2,'partition':'locked-holdout','domain':'drum-only',
          'references':[{'time':1,'row':c} for c in ['hat','cymbal']]}
        record={'lane':'test','events':[{'time':1,'instrument':c,'displayRow':'hat'} for c in ['hat','cymbal']]}
        result=scoring.score(item,record,'displayRow')['classes']['hat']
        self.assertEqual(result['tp'],1)
        self.assertEqual(result['fpAgainstReference'],1)
        self.assertEqual(result['exactCoincidentReferenceEventsCollapsed'],1)

if __name__=='__main__':unittest.main()
