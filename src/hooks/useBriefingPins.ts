import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createBriefingPin,
  deleteBriefingPin,
  fetchBriefingPins,
  subscribeToBriefingPins,
} from '../services/briefing.service';
import type { BriefingPin, CreateBriefingPinInput } from '../types/briefing.type';

export function useBriefingPins(workspaceId: string | null | undefined) {
  const [pins, setPins] = useState<BriefingPin[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const loadPins = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!workspaceId) {
      setPins([]);
      setIsLoading(false);
      return;
    }
    try {
      const nextPins = await fetchBriefingPins(workspaceId);
      if (version === requestVersion.current) {
        setPins(nextPins);
        setError(null);
      }
    } catch (reason) {
      if (version === requestVersion.current) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    setPins([]);
    setError(null);
    setIsLoading(Boolean(workspaceId));
    void loadPins();
    if (!workspaceId) return;
    const unsubscribe = subscribeToBriefingPins(workspaceId, () => { void loadPins(); });
    return () => {
      requestVersion.current += 1;
      unsubscribe();
    };
  }, [loadPins, workspaceId]);

  const createPin = useCallback(async (input: CreateBriefingPinInput) => {
    const pin = await createBriefingPin(input);
    requestVersion.current += 1;
    setPins((current) => [pin, ...current.filter((item) => item.id !== pin.id)]);
    setError(null);
    setIsLoading(false);
    return pin;
  }, []);

  const removePin = useCallback(async (pinId: string) => {
    await deleteBriefingPin(pinId);
    requestVersion.current += 1;
    setPins((current) => current.filter((pin) => pin.id !== pinId));
  }, []);

  return { pins, isLoading, error, createPin, removePin, reloadPins: loadPins };
}
