import type { BeatEvent, MusicClock } from './mediaBridge';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';
import { parsePlaybackTiming, parsePlaybackClock, playbackPosition, clockAdvancing, clockDiscontinuity } from '../../../extensions/kanban-music/beat-timing.js';

const telemetry = beatTelemetry.at('beat-scheduler');
const position = playbackPosition;

interface ScheduledBeat {
  event: BeatEvent;
  target: number;
  order: number;
}

// One queue per selected subscription. Capture and playback lifecycle changes
// cancel its events; an event anchor bootstraps a newly acquired capture only.
export function createBeatScheduler(deliver: (event: BeatEvent) => void, recover: () => void) {
  let clock: MusicClock | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let order = 0;
  let lastRecovery = -Infinity;
  let resetAt = -Infinity;
  const queue: ScheduledBeat[] = [];

  const requestRecovery = () => {
    if (Date.now() - lastRecovery < 1000) return;
    lastRecovery = Date.now();
    recover();
  };

  const observe = (stage: string, event: BeatEvent, details: Record<string, unknown>) => {
    if (event.telemetry?.length) telemetry.mark(stage, event.telemetry, details);
    else telemetry.record(stage, undefined, details);
  };
  const drop = (event: BeatEvent, reason: string) => observe('EVENT_DROPPED', event, { reason });

  function reset(reason = 'schedule-reset', forgetClock = false) {
    clearTimeout(timer);
    timer = undefined;
    queue.splice(0).forEach(({ event }) => drop(event, reason));
    resetAt = Date.now();
    if (forgetClock) clock = undefined;
  }

  function arm() {
    clearTimeout(timer);
    timer = undefined;
    if (!queue.length || !clock || !clockAdvancing(clock)) return;

    const remaining = (queue[0].target - position(clock)) / clock.playbackRate * 1000
      + Math.max(0, clock.sampledAt - Date.now());
    timer = setTimeout(flush, Math.max(0, Math.min(remaining, 3501 - (Date.now() - clock.sampledAt))));
  }

  function flush() {
    timer = undefined;
    if (!clock || !clockAdvancing(clock)) {
      reset('not-playing');
      return;
    }
    if (Date.now() - clock.sampledAt > 3500) {
      reset('clock-stale');
      requestRecovery();
      return;
    }

    // At most one distinct target per task, so delayed React work cannot turn
    // an entire phrase into a single counter/DOM commit.
    const target = queue[0]?.target;
    while (queue[0] && queue[0].target === target && queue[0].target <= position(clock) + .00005) {
      const { event, target } = queue.shift()!;
      const offsetMs = (position(clock) - target) / clock.playbackRate * 1000;
      if (offsetMs > 5) observe('EVENT_LATE', event, { reason: 'schedule-late', offsetMs, targetPlaybackTime: target });
      if (offsetMs > 600) {
        drop(event, 'schedule-late');
        requestRecovery();
        continue;
      }

      // Keep the producer's earlier mapping in transport records; DOM/animation
      // offsets use the deadline from the latest authoritative media sample.
      deliver({
        ...event,
        telemetry: event.telemetry?.map(trace => ({
          ...trace,
          targetTime: clock!.sampledAt + (target - clock!.currentTime) / clock!.playbackRate * 1000,
          targetClock: 'epoch-ms',
          targetPlaybackTime: target,
        })),
      });
    }
    arm();
  }

  return {
    reset,
    cancelSemantic(key: string) {
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].event.semanticKey === key) drop(queue.splice(i, 1)[0].event, 'priority');
      arm();
    },
    cancelSource(source: BeatEvent['eventSource']) {
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].event.eventSource === source) drop(queue.splice(i, 1)[0].event, 'schedule-reset');
      arm();
    },
    cancelKind(kind: BeatEvent['kind']) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].event.kind === kind) {
          drop(queue.splice(i, 1)[0].event, 'schedule-reset');
        }
      }
      arm();
    },
    clock(next: MusicClock) {
      if (!parsePlaybackClock(next) || next.sampledAt > Date.now() + 8000) return false;
      if (clock && next.sampledAt < clock.sampledAt) return false;

      const discontinuity = clockDiscontinuity(clock, next);
      if (discontinuity || !clockAdvancing(next)) {
        reset(discontinuity ? 'track-changed' : next.buffering ? 'buffering' : 'not-playing');
      }
      clock = next;
      arm();
      return discontinuity;
    },
    enqueue(event: BeatEvent) {
      const timing = parsePlaybackTiming(event);
      if (!timing) {
        if (event.targetPlaybackTime !== undefined || event.playbackClock !== undefined) {
          drop(event, 'invalid');
          return;
        }
        if (clock && !clockAdvancing(clock)) {
          drop(event, 'not-playing');
          return;
        }
        deliver(event);
        return;
      }
      if (timing.playbackClock.sampledAt < resetAt) {
        drop(event, 'schedule-reset');
        return;
      }
      if (timing.playbackClock.sampledAt > Date.now() + 8000) {
        drop(event, 'invalid');
        return;
      }

      clock ??= timing.playbackClock;
      if (clock.generation !== undefined && timing.playbackClock.generation !== undefined
        && clock.generation !== timing.playbackClock.generation) {
        drop(event, 'schedule-reset');
        return;
      }
      if (!clockAdvancing(clock)) {
        drop(event, 'not-playing');
        return;
      }

      const aheadMs = (timing.targetPlaybackTime - position(clock)) / clock.playbackRate * 1000
        + Math.max(0, clock.sampledAt - Date.now());
      if (!Number.isFinite(aheadMs) || aheadMs > 8000) {
        drop(event, 'invalid');
        return;
      }
      if (Date.now() - clock.sampledAt > 3500) {
        drop(event, 'clock-stale');
        requestRecovery();
        return;
      }
      if (queue.length >= 2048) {
        const index = queue.reduce((oldest, value, i) => value.order < queue[oldest].order ? i : oldest, 0);
        drop(queue.splice(index, 1)[0].event, 'queue-full');
      }
      queue.push({ event, target: timing.targetPlaybackTime, order: order++ });
      queue.sort((a, b) => a.target - b.target || a.order - b.order);
      observe('EVENT_SCHEDULED', event, {
        targetPlaybackTime: timing.targetPlaybackTime,
        playbackTime: position(clock),
        delayMs: Math.max(0, aheadMs),
        queueDepth: queue.length,
      });
      arm();
    },
  };
}
