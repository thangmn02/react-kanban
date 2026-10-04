use serde_json::{json, Value};
use std::collections::VecDeque;

// Same confidence gates and 6-second horizon as the browser detector. All
// estimation stays on the capture thread, even when WebView rendering pauses.
pub struct Tempo {
    samples: VecDeque<(f64, f64)>,
    estimated: f64,
    low: Option<f64>,
    pub locked: bool,
    pub bpm: Option<f64>,
    pub confidence: f64,
    anchor: f64,
    last_tick: i64,
    candidate: Option<(f64, f64)>,
}
impl Default for Tempo {
    fn default() -> Self {
        Self {
            samples: VecDeque::new(),
            estimated: -1000.,
            low: None,
            locked: false,
            bpm: None,
            confidence: 0.,
            anchor: 0.,
            last_tick: -1,
            candidate: None,
        }
    }
}
impl Tempo {
    pub fn analyze(&mut self, envelope: f32, now: f64) -> (bool, Option<Value>) {
        self.samples
            .push_back((now, (envelope as f64).clamp(0., 8.)));
        while self.samples.front().is_some_and(|(t, _)| *t < now - 6000.) {
            self.samples.pop_front();
        }
        let updated = now - self.estimated >= 500.;
        if updated {
            self.estimated = now;
            self.estimate(now);
        }
        let mut tick = None;
        if self.locked {
            let n = ((now - self.anchor) / (30000. / self.bpm.unwrap())).floor() as i64;
            if n > self.last_tick && n >= 0 {
                self.last_tick = n;
                let step = n % 8;
                let mut bands = vec!["hat"];
                if step % 2 == 0 {
                    bands.push("kick");
                }
                if step == 2 || step == 6 {
                    bands.push("snare");
                }
                tick = Some(json!({"step":step,"bands":bands}));
            }
        }
        (updated, tick)
    }
    fn weaken(&mut self, now: f64) {
        self.candidate = None;
        let since = *self.low.get_or_insert(now);
        if self.locked && now - since > 4000. {
            self.locked = false;
            self.bpm = None;
            self.last_tick = -1;
        }
    }
    fn estimate(&mut self, now: f64) {
        let s = &self.samples;
        if s.len() < 240 || now - s[0].0 < 4800. {
            return;
        }
        let mean = s.iter().map(|(_, v)| *v).sum::<f64>() / s.len() as f64;
        if s.iter().map(|(_, v)| (v - mean).powi(2)).sum::<f64>() / (s.len() as f64) < 0.002 {
            self.confidence = 0.;
            self.weaken(now);
            return;
        }
        let frame_ms = (s.back().unwrap().0 - s[0].0) / (s.len() - 1) as f64;
        let mut scores = vec![];
        for bpm in 60..=180 {
            let lag = (60000. / bpm as f64 / frame_ms).round() as usize;
            if lag < 2 || lag >= s.len() / 2 {
                continue;
            }
            let (mut pair, mut left, mut right) = (0., 0., 0.);
            for i in lag..s.len() {
                let a = s[i].1 - mean;
                let b = s[i - lag].1 - mean;
                pair += a * b;
                left += a * a;
                right += b * b;
            }
            scores.push((pair / (left * right).sqrt().max(1e-12), lag));
        }
        scores.sort_by(|a, b| b.0.total_cmp(&a.0).then(a.1.cmp(&b.1)));
        let Some(&(peak, lag)) = scores.first() else {
            self.weaken(now);
            return;
        };
        let background = scores
            .iter()
            .filter(|(_, l)| l.abs_diff(lag) > 2)
            .map(|(c, _)| c.max(0.))
            .sum::<f64>()
            / scores.len().saturating_sub(5).max(1) as f64;
        self.confidence = ((peak - background) * 1.2).clamp(0., 1.);
        let bpm = (60000. / (lag as f64 * frame_ms)).clamp(60., 180.);
        if peak < 0.48
            || self.confidence < 0.42
            || self.locked && (bpm - self.bpm.unwrap()).abs() > 6.
        {
            self.weaken(now);
            return;
        }
        self.low = None;
        if self.locked {
            let phase = (now - self.anchor) / (30000. / self.bpm.unwrap());
            self.bpm = Some(self.bpm.unwrap() * 0.8 + bpm * 0.2);
            self.anchor = now - phase * (30000. / self.bpm.unwrap());
        } else {
            if self.candidate.is_none_or(|(old, _)| (old - bpm).abs() > 6.) {
                self.candidate = Some((bpm, now));
                return;
            }
            if now - self.candidate.unwrap().1 < 1000. {
                return;
            }
            self.locked = true;
            self.bpm = Some(bpm);
            self.anchor = s
                .iter()
                .rev()
                .take(lag)
                .max_by(|a, b| a.1.total_cmp(&b.1))
                .unwrap()
                .0;
            self.last_tick = ((now - self.anchor) / (30000. / bpm)).floor() as i64 - 1;
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn calm_and_free_tempo_never_lock() {
        let mut tempo = Tempo::default();
        for i in 0..1000 {
            assert!(tempo.analyze(0., i as f64 * 16.67).1.is_none());
        }
        assert!(!tempo.locked);
    }
    #[test]
    fn regular_envelope_locks_and_silence_releases_it() {
        let mut tempo = Tempo::default();
        for i in 0..1000 {
            tempo.analyze(if i % 30 < 2 { 2. } else { 0. }, i as f64 * (1000. / 60.));
        }
        assert!(tempo.locked);
        assert!((tempo.bpm.unwrap() - 120.).abs() < 3.);
        for i in 1000..1900 {
            tempo.analyze(0., i as f64 * (1000. / 60.));
        }
        assert!(!tempo.locked);
    }
}
