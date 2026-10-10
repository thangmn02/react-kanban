import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec=importlib.util.spec_from_file_location("lead_pulse",Path(__file__).with_name("lead-pulse.py"))
lead=importlib.util.module_from_spec(spec);spec.loader.exec_module(lead)


class LeadPulseTests(unittest.TestCase):
    def test_silence_and_ambiguous_sources_abstain(self):
        self.assertEqual(lead.select_passages([[.2,.2,.2,.2],[.6,.6,.1,.1]]),[4,4])
        result=lead.analyze_sources({name:np.zeros(44100) for name in lead.SOURCES},44100,
                                    lambda *_:self.fail("silent input must not invoke pitch extraction"))
        self.assertEqual(result["events"],[])

    def test_articulation_does_not_require_pitch_and_rejects_brief_noise(self):
        rate=44100;signal=np.zeros(rate*2)
        for onset in (.2,.7,1.2):
            t=np.arange(round(.22*rate))/rate
            vowel=.1*(np.sin(2*np.pi*160*t)+.5*np.sin(2*np.pi*960*t))*np.minimum(1,t/.01)
            signal[round(onset*rate):round(onset*rate)+len(vowel)]+=vowel
        candidates=lead.vocal_attacks(lead.features(signal,rate))
        self.assertGreaterEqual(len(candidates),2)
        self.assertTrue(all(event["kind"]=="vocal-articulation" and "pitch" not in event for event in candidates))
        noise=np.zeros(rate*2);noise[10000:10441]=np.random.default_rng(0).normal(0,.1,441)
        self.assertEqual(lead.vocal_attacks(lead.features(noise,rate)),[])

    def test_source_transition_preserves_one_stream_and_input_identity(self):
        rate=44100;t=np.arange(rate*8)/rate
        piano=.1*np.sin(2*np.pi*440*t)*(t<4)
        guitar=.1*np.sin(2*np.pi*660*t)*(t>=4)
        stems={name:np.zeros(len(t)) for name in lead.SOURCES};stems.update(piano=piano,guitar=guitar)
        def pitch(audio,_):
            if np.max(np.abs(audio[:rate]))>.01:
                return [{"start":.2,"end":3.8,"pitch":69,"confidence":.9}]
            return [{"start":4.2,"end":7.8,"pitch":76,"confidence":.9}]
        result=lead.analyze_sources(stems,rate,pitch)
        self.assertEqual([n["source"] for n in result["events"]],["piano","guitar"])
        self.assertEqual(result["events"][0]["end"],3.8)
        self.assertTrue(all(len(n["inputSha256"])==64 for n in result["events"]))


if __name__=="__main__":unittest.main()
