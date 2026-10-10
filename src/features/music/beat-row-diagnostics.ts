import { beatTelemetry, type BeatTrace } from '../../../extensions/kanban-music/beat-telemetry.js';
import type { EventRow } from './event-track';

export const semanticRows: EventRow[] = ['kick', 'snare', 'hat', 'bass', 'melody'];
const listeners = new Set<() => void>();
const diagnosticParams = new URLSearchParams(location.search);
export const fourRowBaseline = diagnosticParams.get('musicFourRows') === '1';
let semanticOnly = fourRowBaseline || diagnosticParams.get('musicSemanticOnly') === '1';
export const subscribeSemanticMode = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getSemanticMode = () => semanticOnly;
export interface CellFlash {
  eventId: string; traceId: string; type: string; source: string;
  targetPlaybackTime: number | null; actualRenderTime: number; row: number | null; cell: number | null;
  presentation: 'semantic-hit' | 'decorative-cell' | 'decorative-shape' | 'decorative-global';
  semantic: boolean; origin: string; stage: 'commit' | 'animation'; mode: 'normal' | 'semantic-only';
  captureId?: string;
  parentId?: string;
}
let startTime = 0, endTime = 0, overflow = 0;
let playbackRange: { start: number; end: number } | undefined;
const flashes: CellFlash[] = [];
const commits = new WeakMap<Element, string>();

export function recordCellFlash(element: HTMLElement, stage: CellFlash['stage']) {
  const now = Date.now();
  if (now < startTime || now >= endTime) return;
  const trace = element.dataset.beatTrace;
  const playbackTime = element.dataset.targetPlaybackTime ? Number(element.dataset.targetPlaybackTime) : null;
  if (playbackRange && (playbackTime === null || playbackTime < playbackRange.start || playbackTime >= playbackRange.end)) return;
  if (!trace || stage === 'commit' && commits.get(element) === trace) return;
  if (stage === 'commit') commits.set(element, trace);
  if (flashes.length >= 20000) { overflow++; return; }
  const global = element.dataset.presentation === 'decorative-global' && element.dataset.semantic === 'false';
  const row = global ? null : Number(element.dataset.beatRow), cell = global ? null : Number(element.dataset.beatCell);
  if (!global && !(row! >= 1 && row! <= 5 && cell! >= 1 && cell! <= 8)) return;
  flashes.push({ eventId: element.dataset.eventId || trace, traceId: trace,
    type: element.dataset.eventType || 'generic', source: element.dataset.eventSource || 'unknown',
    targetPlaybackTime: playbackTime,
    actualRenderTime: now, row, cell, semantic: element.dataset.semantic === 'true',
    presentation: global ? 'decorative-global' : element.dataset.semantic === 'true' ? 'semantic-hit'
      : element.dataset.presentation === 'decorative-shape' ? 'decorative-shape' : 'decorative-cell',
    origin: element.dataset.detectorOrigin || 'unknown', stage,
    mode: element.closest('.semantic-only') ? 'semantic-only' : 'normal', captureId: element.dataset.captureId,
    parentId: element.dataset.parentId });
}

export function flashAttributes(trace: BeatTrace | undefined, row?: number, cell?: number) {
  const semantic = trace?.source === 'onset' && trace.type !== 'generic';
  return { 'data-beat-trace': trace?.id, 'data-beat-row': row === undefined ? undefined : row + 1, 'data-beat-cell': cell === undefined ? undefined : cell + 1,
    'data-presentation': semantic ? 'semantic-hit' : 'decorative-cell',
    'data-event-id': trace?.eventId || trace?.id, 'data-event-type': trace?.type === 'melodic' ? 'melody' : trace?.type,
    'data-event-source': semantic ? trace?.eventSource === 'cache' ? 'server-cache' : 'local' : trace?.source,
    'data-target-playback-time': trace?.targetPlaybackTime, 'data-semantic': semantic,
    'data-detector-origin': trace?.origin || (semantic ? trace?.eventSource === 'cache' ? 'event-track-cache' : 'local-detector' : 'visual-decoration'),
    'data-capture-id': trace?.captureId };
}

export const beatRowDiagnostics = {
  semanticOnly(value = true) {
    semanticOnly = value; if (value) beatTelemetry.enable();
    listeners.forEach(listener => listener());
  },
  start(seconds = 30, playbackStart?: number) {
    beatTelemetry.enable(); flashes.length = 0; overflow = 0;
    const duration = Number.isFinite(seconds) ? Math.max(1, Math.min(30, seconds)) : 30;
    playbackRange = Number.isFinite(playbackStart) && playbackStart! >= 0 ? { start: playbackStart!, end: playbackStart! + duration } : undefined;
    // A media-range recording allows bounded startup/buffering grace without
    // misclassifying its last events as missed detector output.
    startTime = Date.now(); endTime = startTime + (duration + (playbackRange ? 10 : 0)) * 1000;
  },
  stop() { endTime = Math.min(endTime, Date.now()); },
  snapshot(mode?: CellFlash['mode']) {
    const rows = Object.fromEntries(semanticRows.map(row => [row, [] as CellFlash[]])) as Record<EventRow, CellFlash[]>;
    const seen = new Set<string>();
    for (const flash of flashes) {
      if (mode && flash.mode !== mode) continue;
      if (!flash.semantic || flash.stage !== 'commit' || !semanticRows.includes(flash.type as EventRow)) continue;
      // Multiple cells/animations of one attack are not additional detections.
      const key = `${flash.mode}:${flash.captureId}:${flash.type}:${flash.eventId}`;
      if (seen.has(key)) continue; seen.add(key); rows[flash.type as EventRow].push({ ...flash });
    }
    const coincidence = [];
    for (let i = 0; i < semanticRows.length; i++) for (let j = i + 1; j < semanticRows.length; j++) {
      const a = rows[semanticRows[i]].filter(e => e.targetPlaybackTime !== null);
      const b = rows[semanticRows[j]].filter(e => e.targetPlaybackTime !== null);
      const matches = (left: CellFlash[], right: CellFlash[]) => left.filter(e => right.some(other =>
        Math.abs(e.targetPlaybackTime! - other.targetPlaybackTime!) <= .05)).length;
      coincidence.push({ rows: [semanticRows[i], semanticRows[j]], windowMs: 50, counts: [a.length, b.length],
        matched: [matches(a, b), matches(b, a)] });
    }
    return { startTime, endTime, playbackRange: playbackRange && { ...playbackRange }, overflow, complete: Date.now() >= endTime,
      timestamps: Object.fromEntries(semanticRows.map(row => [row, rows[row].map(e => e.targetPlaybackTime)])),
      rows, coincidence, flashes: flashes.filter(e => !mode || e.mode === mode).map(e => ({ ...e })) };
  },
};
if (semanticOnly || import.meta.env.DEV && diagnosticParams.has('musicDebug')) beatTelemetry.enable();
Object.assign(window, { __koraBeatRows: beatRowDiagnostics });
