export function getNativeInstrumentStatus(): string;
export function subscribeNativeInstrument(listener: () => void): () => void;
export function setNativeInstrumentEnabled(value: boolean): void;
