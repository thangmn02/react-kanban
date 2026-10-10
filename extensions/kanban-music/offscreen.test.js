import { afterEach, expect, it, vi } from 'vitest';
import { beatTelemetry } from './beat-telemetry.js';

vi.mock('./capture-engine.js', () => ({ createCaptureEngine: () => ({ start: vi.fn().mockResolvedValue(true), renew: () => true, stopCapture: vi.fn(), delaySeconds: 0 }) }));
afterEach(async () => { vi.unstubAllGlobals(); beatTelemetry.enable(false); (await import('./beat-telemetry.js')).beatTelemetry.enable(false); });

it('starts with only the runtime API available in an offscreen document and receives opt-in diagnostics through messages', async () => {
  vi.resetModules();
  let receive;
  vi.stubGlobal('chrome', { runtime: { id: 'companion', sendMessage: vi.fn().mockResolvedValue({ ok: true }),
    onMessage: { addListener: callback => { receive = callback; } } } });
  await expect(import('./offscreen.js')).resolves.toBeDefined();
  expect(receive).toBeTypeOf('function');
  const reply = vi.fn();
  expect(receive({ target: 'beat-offscreen', kind: 'start', streamId: 'stream', captureId: 'owner', telemetryEnabled: true },
    { id: 'companion' }, reply)).toBe(true);
  await vi.waitFor(() => expect(reply).toHaveBeenCalledWith(expect.objectContaining({ ok: true })));
  expect((await import('./beat-telemetry.js')).beatTelemetry.enabled).toBe(true);
  receive({ target: 'beat-offscreen', kind: 'lease', captureId: 'owner', telemetryEnabled: false },
    { id: 'companion' }, reply);
  expect((await import('./beat-telemetry.js')).beatTelemetry.enabled).toBe(false);
});
