export class BeatDetector {
 constructor(sampleRate:number,fftSize?:number,options?:Record<string,unknown>);
 analyze(spectrum:Float32Array,now:number):{hits:string[];audible:boolean;envelope:number};
}
