import importlib.util
from pathlib import Path
import sys
import unittest
import numpy as np

SPEC = importlib.util.spec_from_file_location("f0_segmentation", Path(__file__).with_name("melody-f0-segmentation.py"))
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class SegmentationTests(unittest.TestCase):
    def run_frames(self, pitch, flags=None, probabilities=None, rms=None):
        size = len(pitch)
        clock = np.arange(size) * MODULE.Settings().hop / MODULE.Settings().sample_rate
        f0 = 440 * 2 ** ((np.asarray(pitch)-69)/12)
        return MODULE.segment(clock, f0, np.ones(size, bool) if flags is None else flags,
                              np.ones(size) if probabilities is None else probabilities,
                              np.ones(size) if rms is None else rms, clock[-1]+.01)

    def test_phrase_rest_stays_silent_even_with_same_pitch(self):
        flags = np.r_[np.ones(30, bool), np.zeros(12, bool), np.ones(30, bool)]
        result = self.run_frames(np.full(72, 64), flags)
        self.assertEqual(len(result["notes"]), 2)
        self.assertLess(result["notes"][0]["end"], result["notes"][1]["start"])
        self.assertTrue(all(f["pitch"] is None for f in result["frames"][30:42]))

    def test_stable_note_change_retains_attack_clock(self):
        result = self.run_frames(np.r_[np.full(30, 60), np.full(30, 64)])
        self.assertEqual([round(n["pitch"]) for n in result["notes"]], [60, 64])
        self.assertAlmostEqual(result["notes"][1]["start"], 30*220/22050)

    def test_vibrato_is_not_many_syllable_attacks(self):
        pitch = 64 + .25*np.sin(np.arange(100)*.3)
        self.assertEqual(len(self.run_frames(pitch)["notes"]), 1)

    def test_unvoiced_pitch_guesses_and_silence_are_not_notes(self):
        self.assertEqual(self.run_frames(np.full(50, 60), np.zeros(50, bool))["notes"], [])
        self.assertEqual(self.run_frames(np.full(50, 60), rms=np.zeros(50))["notes"], [])

    def test_low_probability_abstains_without_rescaling(self):
        self.assertEqual(self.run_frames(np.full(50, 60), probabilities=np.full(50, .09))["notes"], [])

    def test_envelope_reattack_requires_valley(self):
        rms = np.ones(100)
        rms[37:42] = .2
        result = self.run_frames(np.full(100, 60), rms=rms)
        self.assertEqual(len(result["notes"]), 2)
        self.assertEqual(result["notes"][1]["origin"], "envelope-reattack")

    def test_short_fragments_do_not_fill_rests(self):
        flags = np.r_[np.ones(4, bool), np.zeros(12, bool), np.ones(4, bool)]
        self.assertEqual(self.run_frames(np.full(20, 60), flags)["notes"], [])

    def test_clock_or_length_mismatch_is_rejected(self):
        with self.assertRaises(ValueError):
            MODULE.segment([0, .01], [440], [True], [1], [1], 1)
        with self.assertRaises(ValueError):
            MODULE.segment([.1, .05], [440, 440], [True, True], [1, 1], [1, 1], 1)


if __name__ == "__main__":
    unittest.main()
