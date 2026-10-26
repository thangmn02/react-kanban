export interface BassOwner {captureId:string;sourceId:string;sourceGeneration:number;synchronizationEpoch:string}
export interface BassSourceEvent extends BassOwner {band:'bass';audioTime:number;sourceFrame:number;version:'bass-source-clock-v1';readyAt:number}
export interface BassSourceFrame {frame:number;endpointSample:number;audioTime:number;events:Omit<BassSourceEvent,keyof BassOwner|'readyAt'>[]}
export interface BassSourcePacket {kind:'result';ownership:BassOwner;sequence:number;frames:BassSourceFrame[];workerReceivedAt:number;workerFinishedAt:number;receivedAt:number;inFlight:number}
export function createBassSourceRuntime(options:{context:AudioContext;source:AudioNode;ownership:BassOwner;signal?:AbortSignal;
  windowStartSample?:number;windowEndSample?:number;onEvent:(event:BassSourceEvent)=>void;onDiagnostic?:(packet:BassSourcePacket)=>void;
  onFailure?:(reason:string)=>void;createWorker?:()=>Worker;createNode?:()=>AudioWorkletNode}):Promise<{stop:()=>void}|null>;
