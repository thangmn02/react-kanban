use rustfft::{num_complex::Complex, Fft, FftPlanner};
use std::{collections::VecDeque, sync::Arc};

pub const N: usize = 2048;
const BANDS: [(&str, f32, f32, f32); 4] = [
    ("kick", 45., 150., 1.),
    ("bass", 60., 250., 0.5),
    ("snare", 1500., 5000., 1.),
    ("hat", 6000., 12000., 0.25),
];
#[derive(Default)]
struct Band {
    average: f32,
    previous: f32,
    last_hit: Option<f64>,
    times: VecDeque<f64>,
}
pub struct Detector {
    fft: Arc<dyn Fft<f32>>,
    buffer: Vec<Complex<f32>>,
    scratch: Vec<Complex<f32>>,
    window: Vec<f32>,
    sample_rate: f32,
    bands: [Band; 4],
    first: Option<f64>,
    previous: Option<f64>,
}
pub struct Analysis {
    pub hits: Vec<&'static str>,
    pub audible: bool,
    pub envelope: f32,
}
impl Detector {
    pub fn new(sample_rate: f32) -> Self {
        let fft = FftPlanner::new().plan_fft_forward(N);
        let scratch = vec![Complex::default(); fft.get_inplace_scratch_len()];
        Self {
            fft,
            buffer: vec![Complex::default(); N],
            scratch,
            window: (0..N)
                .map(|i| 0.5 - 0.5 * (2. * std::f32::consts::PI * i as f32 / N as f32).cos())
                .collect(),
            sample_rate,
            bands: std::array::from_fn(|_| Band::default()),
            first: None,
            previous: None,
        }
    }
    pub fn analyze(&mut self, samples: &[f32], now: f64) -> Analysis {
        let first = *self.first.get_or_insert(now);
        let delta = self.previous.map_or(16.67, |p| (now - p).clamp(1., 100.));
        self.previous = Some(now);
        for i in 0..N {
            let value = samples
                .get(i)
                .copied()
                .filter(|v| v.is_finite())
                .unwrap_or(0.);
            self.buffer[i] = Complex::new(value * self.window[i], 0.);
        }
        self.fft
            .process_with_scratch(&mut self.buffer, &mut self.scratch);
        let mut result = Analysis {
            hits: vec![],
            audible: false,
            envelope: 0.,
        };
        let alpha = (1. - (-delta / 700.).exp()) as f32;
        for (i, (name, low, high, weight)) in BANDS.iter().enumerate() {
            let band = &mut self.bands[i];
            while band.times.front().is_some_and(|t| *t <= now - 2000.) {
                band.times.pop_front();
            }
            let threshold =
                1.6 * (1. + ((band.times.len() as f32 / 2. - 3.).max(0.) * 0.24).min(0.9));
            let start = (low * N as f32 / self.sample_rate).ceil().max(1.) as usize;
            let end = (high * N as f32 / self.sample_rate)
                .floor()
                .min((N / 2 - 1) as f32) as usize;
            let energy = if end >= start {
                self.buffer[start..=end]
                    .iter()
                    .map(|v| v.norm_sqr() / (N * N) as f32)
                    .sum::<f32>()
                    / (end - start + 1) as f32
            } else {
                0.
            };
            result.audible |= energy > 1e-7;
            result.envelope +=
                ((energy - band.previous).max(0.) / band.average.max(1e-6)).min(3.) * weight;
            if now - first >= 400.
                && energy > 1e-7
                && energy > band.average * threshold
                && energy > band.previous * 1.15
                && band.last_hit.is_none_or(|t| now - t >= 120.)
            {
                result.hits.push(*name);
                band.last_hit = Some(now);
                band.times.push_back(now);
            }
            band.average += alpha * (energy - band.average);
            band.previous = energy;
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn silence_and_constant_tone_never_manufacture_beats() {
        let mut detector = Detector::new(48000.);
        for frame in 0..120 {
            let a = detector.analyze(&[0.; N], frame as f64 * 16.67);
            assert!(!a.audible);
            assert!(a.hits.is_empty());
        }
        let tone: Vec<_> = (0..N)
            .map(|i| (2. * std::f32::consts::PI * 100. * i as f32 / 48000.).sin() * 0.5)
            .collect();
        detector = Detector::new(48000.);
        for frame in 0..180 {
            assert!(detector
                .analyze(&tone, frame as f64 * 16.67)
                .hits
                .is_empty());
        }
    }
    #[test]
    fn low_frequency_transients_hit_kick_not_hat() {
        let mut detector = Detector::new(48000.);
        for frame in 0..60 {
            detector.analyze(&[0.; N], frame as f64 * 16.67);
        }
        let tone: Vec<_> = (0..N)
            .map(|i| (2. * std::f32::consts::PI * 100. * i as f32 / 48000.).sin() * 0.8)
            .collect();
        let hit = detector.analyze(&tone, 1100.);
        assert!(hit.hits.contains(&"kick"));
        assert!(!hit.hits.contains(&"hat"));
    }
}
