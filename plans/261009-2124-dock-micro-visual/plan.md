# Dock micro-visual redesign

Stopped: the user rejected the visual direction and requested P0 restoration.
Prototype source/captures are preserved; its mount is removed from the real dock.
See [restoration plan](../261009-2200-focus-dock-restoration/plan.md).

The user rejected the full-page music showcase. Remove its hero, scene layout,
concept cards and token showcase. Reuse only activity adaptation, bounded orbital
arrival logic and Motion values. The previous plan is superseded.

Outcome: two small working visual modes in the actual Focus dock, beneath the
existing timer controls. Keep normal Beat Grid, detectors, Lead and capture intact.

Concept comparison: Groove Steps / Pocket Turntable for Vinyl; Halo Relay /
Twin Comets for Orbit. Select Groove Steps and Halo Relay for small-size clarity.

- [ ] Remove the standalone showcase and add a dev-only opt-in dock module.
- [ ] Implement compact choreography, existing live activity and labeled preview.
- [ ] Check constrained widths, timer access, motion, pause, silence and cleanup.
- [ ] Measure frame intervals and cost, capture real dock screenshots, report.

No dependencies, backend, deployment or production feature activation. Live input
must use the dock's existing controller, with no competing capture subscription.
Visual quality remains subject to user review; browser timing is not a weak-device
or Desktop production certification.
