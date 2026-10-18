import importlib.util,sys,unittest
sys.dont_write_bytecode=True
import numpy as np
spec=importlib.util.spec_from_file_location('hat_core','scripts/hat-recovery-core.py');core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)

class HatDiagnostics(unittest.TestCase):
    def test_interval_is_half_open_and_keeps_cymbal_separate(self):
        events=[{'sourceTime':t,'instrument':c} for t,c in [(25.999,'hat'),(26,'hat'),(43.999,'cymbal'),(44,'hat')]]
        self.assertEqual(core.count_interval(events,26,44),{'kick':0,'snare':0,'hat':1,'cymbal':1,'grouped-percussion':0})

    def test_published_rising_edges_are_not_frame_counts_or_peaks(self):
        p=np.zeros((8,3));p[:,2]=[.9,.2,.5,.6,.9,.6,.2,.8]
        self.assertEqual(core.cnn_edges(p),[round(3*core.CNN_STEP,4),round(7*core.CNN_STEP,4)])
        self.assertEqual(core.accepted_run(p,3)['frameCount'],3)

    def test_threshold_changes_can_split_a_continuous_run(self):
        p=np.zeros((6,3));p[:,2]=[0,.9,.6,.9,.6,0]
        self.assertEqual(len(core.cnn_edges(p,.5)),1);self.assertEqual(len(core.cnn_edges(p,.7)),2)

    def test_hybrid_routes_exact_frozen_classes_and_preserves_simultaneity(self):
        event=lambda c,i:{'id':i,'instrument':c,'sourceTime':1}
        a=[event('kick','ak'),event('snare','as'),event('cymbal','ac'),event('hat','ah')]
        b=[event('hat','bh'),event('hat','bh'),event('snare','bs')]
        h=core.hypothetical_hybrid(a,b)
        self.assertEqual({e['id'] for e in h},{'ak','as','bh'});self.assertEqual(len(h),3)
        self.assertTrue(all(e['sourceTime']==1 for e in h));self.assertEqual(a[0],event('kick','ak'))

    def test_early_onset_is_assigned_to_its_matched_reference_cycle(self):
        def match(refs,preds,cap):return ([{'referenceIndex':0,'predictionIndex':0,'errorSeconds':.01}], [cap])
        previous=core.cycle_metrics([1],[.99],0,1,match);current=core.cycle_metrics([1],[.99],1,2,match)
        self.assertEqual(previous['fpAgainstReference'],0);self.assertEqual(current['tp'],1)
        self.assertEqual(current['acceptedMatchedTimes'],[.99])

    def test_snare_veto_is_a_score_check_without_time_or_spacing_changes(self):
        p=np.array([[0,.99,.6],[0,.95,.96],[0,.6,.95]])
        self.assertFalse(core.snare_dominance_keep(p,0));self.assertTrue(core.snare_dominance_keep(p,core.CNN_STEP))
        self.assertTrue(core.snare_dominance_keep(p,2*core.CNN_STEP))

if __name__=='__main__':unittest.main()
