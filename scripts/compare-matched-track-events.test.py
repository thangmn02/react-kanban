import importlib.util
import unittest

spec=importlib.util.spec_from_file_location('matched_events','scripts/compare-matched-track-events.py')
comparison=importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparison)
score_spec=importlib.util.spec_from_file_location('matched_score','scripts/score-beat-v2-round.py')
score=importlib.util.module_from_spec(score_spec)
score_spec.loader.exec_module(score)


class MatchedEvents(unittest.TestCase):
    def test_cymbal_is_associated_with_hat_only_in_the_explicit_display_row_view(self):
        cymbal={'id':'a','time':1.,'instrument':'cymbal'}
        hat={'id':'b','time':1.001,'instrument':'hat'}
        instruments=comparison.associate([cymbal],[hat],score.match)
        self.assertEqual(instruments['hat']['shared'],0)
        display=comparison.associate([{**cymbal,'originInstrument':'cymbal','instrument':'hat'}],[hat],score.match)
        self.assertEqual(display['hat']['shared'],1)
        self.assertEqual(display['cymbal']['shared'],0)

    def test_dense_association_remains_one_to_one_and_does_not_claim_accuracy(self):
        left=[{'id':'a','time':1.,'instrument':'hat'},{'id':'b','time':1.02,'instrument':'hat'}]
        right=[{'id':'c','time':1.001,'instrument':'hat'}]
        result=comparison.associate(left,right,score.match)['hat']
        self.assertEqual(result['shared'],1)
        self.assertEqual([e['id'] for e in result['leftOnly']],['b'])
        self.assertNotIn('precision',result)

    def test_spacing_and_overlap_do_not_turn_simultaneous_classes_into_repeated_hats(self):
        events=[{'id':'a','time':1.,'instrument':'hat'},{'id':'b','time':1.,'instrument':'snare'},
                {'id':'c','time':1.03,'instrument':'hat'}]
        result=comparison.class_summary(events)
        self.assertEqual(result['hat']['count'],2)
        self.assertEqual(result['hat']['rapidEvents125ms'],2)
        self.assertEqual(result['hat']['overlappingOtherClass20ms'],1)
        self.assertAlmostEqual(result['hat']['medianSpacingMs'],30.)


if __name__=='__main__':
    unittest.main()
