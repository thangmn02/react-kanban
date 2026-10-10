"""Timestamp/contract checks, not musical accuracy or listening acceptance."""
import importlib.util
from pathlib import Path
import unittest

import essentia.standard as es
import numpy as np

spec = importlib.util.spec_from_file_location("analyzer", Path(__file__).with_name("analyze-melodia.py"))
analyzer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analyzer)


class MelodyBoundaries(unittest.TestCase):
    def test_real_api_defaults(self):
        extractor = es.PredominantPitchMelodia()
        for name, expected in {"sampleRate": 44100, "frameSize": 2048, "hopSize": 128, "guessUnvoiced": False}.items():
            self.assertEqual(extractor.paramValue(name), expected)
        segmentation = es.PitchContourSegmentation()
        self.assertEqual(segmentation.paramValue("hopSize"), 128)
        self.assertAlmostEqual(segmentation.paramValue("minDuration"), .1, places=7)

    def test_preserves_repeated_notes_across_explicit_rests(self):
        pitch = np.r_[np.zeros(100), np.full(200, 440), np.zeros(100), np.full(200, 440), np.zeros(100)].astype("float32")
        confidence = (pitch > 0).astype("float32") * .8
        signal = np.sin(2*np.pi*440*np.arange(len(pitch)*128)/44100).astype("float32")*.1
        onset, duration, midi = es.PitchContourSegmentation()(pitch, signal)
        notes, omitted = analyzer.normalize_notes(onset, duration, midi, pitch, confidence, len(signal)/44100)
        self.assertEqual(len(notes), 2)
        self.assertEqual(omitted, [])
        self.assertAlmostEqual(notes[0]["start"], 100*128/44100, places=6)
        self.assertGreater(notes[1]["start"], notes[0]["end"])
        self.assertTrue(all(abs(n["pitch"]-69) < .1 for n in notes))

    def test_never_interpolates_a_note_through_unvoiced_frames(self):
        notes, omitted = analyzer.normalize_notes([0], [.5], [60], np.r_[np.ones(80), np.zeros(40), np.ones(80)], np.ones(200)*.8, 1)
        self.assertEqual(notes, [])
        self.assertEqual(omitted[0]["reason"], "unvoiced-intersection")

    def test_short_same_pitch_attacks_are_not_merged_or_bpm_quantized(self):
        notes, omitted = analyzer.normalize_notes([.013, .131], [.05, .05], [69, 69], np.ones(200), np.ones(200)*.7, 1)
        self.assertEqual([n["start"] for n in notes], [.013, .131])
        self.assertEqual(omitted, [])

    def test_tail_and_zero_duration_are_explicit_omissions(self):
        notes, omitted = analyzer.normalize_notes([0, .3, 1.1], [0, .9, .1], [60]*3, np.ones(500), np.ones(500)*.8, 1)
        self.assertEqual(notes[0]["end"], 1)
        self.assertEqual(len(omitted), 2)

    def test_real_defaults_do_not_turn_small_vibrato_into_added_attacks(self):
        frames = 700
        pitch = (440*2**(.15*np.sin(2*np.pi*5*np.arange(frames)*128/44100)/12)).astype("float32")
        signal = np.sin(2*np.pi*np.cumsum(np.repeat(pitch, 128))/44100).astype("float32")*.1
        onset, duration, midi = es.PitchContourSegmentation()(pitch, signal)
        notes, _ = analyzer.normalize_notes(onset, duration, midi, pitch, np.ones(frames)*.8, len(signal)/44100)
        self.assertEqual(len(notes), 1)


if __name__ == "__main__":
    unittest.main()
