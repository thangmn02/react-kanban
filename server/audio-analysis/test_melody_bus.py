"""Conservative activity fallback contracts, not main-lead ground truth."""
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock

import numpy as np

spec = importlib.util.spec_from_file_location("melody_bus", Path(__file__).with_name("melody-bus.py"))
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


def notes(times=(.4, 1, 1.6), frequency=880, duration=2.5, rate=16000):
    audio = np.zeros(round(duration * rate), dtype=np.float32)
    for start in times:
        samples = np.arange(round(.18 * rate)) / rate
        value = .2 * np.sin(2 * np.pi * frequency * samples) * np.exp(-samples * 20)
        index = round(start * rate)
        audio[index:index + len(value)] += value[:len(audio) - index]
    return audio


class MelodyBusTests(unittest.TestCase):
    def detector(self, **kwargs):
        return module.SpectralMelodyBusDetector(module.MelodyBusConfig(**kwargs))

    def test_silence_and_excluded_stems_cannot_create_melody_events(self):
        detector = self.detector()
        self.assertEqual(detector.detect({'piano': np.zeros(40000)}, 16000), [])
        self.assertEqual(detector.detect({'drums': notes(), 'bass': notes()}, 16000), [])

    def test_real_attacks_produce_bounded_absolute_music_events(self):
        events = self.detector().detect({'piano': notes()}, 16000, offset=30, output_range=(30.5, 32))
        self.assertEqual(len(events), 2)
        for event, expected in zip(events, (31, 31.6)):
            self.assertLess(abs(event['playbackTime'] - expected), .08)
            self.assertEqual(event['type'], 'melody')
            self.assertEqual(event['source'], 'server-cache')
            self.assertLessEqual(event['confidence'], .55)
            self.assertGreater(event['duration'], 0)

    def test_constant_sustain_and_small_amplitude_wobble_are_not_note_retriggers(self):
        rate = 16000
        t = np.arange(rate * 3) / rate
        envelope = np.minimum(t / .2, 1) * (1 + .01 * np.sin(2 * np.pi * 5 * t))
        events = self.detector().detect({'guitar': .2 * np.sin(2 * np.pi * 700 * t) * envelope}, rate)
        self.assertTrue(all(event['playbackTime'] < .4 for event in events))
        self.assertLessEqual(len(events), 1)

    def test_dense_retriggers_obey_spacing_and_frequency_band_is_configurable(self):
        audio = notes(times=(.4, .48, .56, 1, 1.6))
        events = self.detector(min_spacing=.3).detect({'vocals': audio}, 16000)
        self.assertTrue(events)
        self.assertTrue(all(b['playbackTime'] - a['playbackTime'] >= .3 for a, b in zip(events, events[1:])))
        self.assertEqual(self.detector(low_hz=3000, high_hz=6000, novelty_floor=.5).detect({'piano': notes()}, 16000), [])

    def test_normalization_preserves_events_under_uniform_gain(self):
        detector = self.detector()
        a = detector.detect({'piano': notes(), 'other': notes(frequency=1200) * .2}, 16000)
        self.assertTrue(a)
        for gain in (.2, .4, 2):
            b = detector.detect({'piano': notes() * gain, 'other': notes(frequency=1200) * .2 * gain}, 16000)
            self.assertEqual([e['playbackTime'] for e in a], [e['playbackTime'] for e in b])

    def test_invalid_or_unbounded_inputs_fail_before_analysis(self):
        for config in ({'low_hz': 5000, 'high_hz': 1000}, {'threshold_mad': float('nan')}, {'min_spacing': 0}):
            with self.assertRaises(ValueError):
                self.detector(**config).detect({'piano': notes()}, 16000)
        for stems in ({'piano': np.array([float('nan')])}, {'piano': notes(), 'guitar': np.zeros(100)},
                      {'piano': np.zeros(16000 * 311)}):
            with self.assertRaises(ValueError):
                self.detector().detect(stems, 16000)

    def test_short_spacing_clips_holds_and_context_never_publishes_outside_core(self):
        events = self.detector(min_spacing=.1).detect({'other': notes(times=(.4,.54,.68,1))},16000,
                                                     offset=60,output_range=(60.45,61.4))
        self.assertGreaterEqual(len(events),2)
        self.assertTrue(all(60.45<=event['playbackTime']<61.4 for event in events))
        self.assertTrue(all(a['playbackTime']+a['duration']<=b['playbackTime']+1e-9 for a,b in zip(events,events[1:])))

    def test_default_and_confident_selector_do_not_invoke_fallback(self):
        detector = Mock()
        accepted = [{'eventId': 'accepted'}]
        fallback = module.ExperimentalMelodyFallback(detector)
        self.assertIs(fallback.choose(accepted, {'confidence': .2}, {}, 16000)['events'], accepted)
        fallback = module.ExperimentalMelodyFallback(detector, enabled=True)
        self.assertIs(fallback.choose(accepted, {'confidence': .6}, {}, 16000)['events'], accepted)
        detector.detect.assert_not_called()
        with self.assertRaises(ValueError):
            module.ExperimentalMelodyFallback(detector, enabled='false')

    def test_opt_in_low_confidence_uses_candidates_and_empty_bus_preserves_lead(self):
        detector = Mock()
        accepted, candidates = [{'eventId': 'accepted'}], [{'eventId': 'experimental'}]
        detector.detect.return_value = candidates
        fallback = module.ExperimentalMelodyFallback(detector, enabled=True)
        result = fallback.choose(accepted, {'confidence': .4}, {}, 16000)
        self.assertEqual(result['path'], 'experimental-melody-bus')
        self.assertIs(result['events'], candidates)
        detector.detect.return_value = []
        self.assertIs(fallback.choose(accepted, {'confidence': .4}, {}, 16000)['events'], accepted)


if __name__ == '__main__':
    unittest.main()
