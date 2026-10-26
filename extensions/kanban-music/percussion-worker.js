import { PercussionClassifier } from './percussion-classifier.js';
import { CausalPercussionClassifier } from './causal-percussion-classifier.js';
import { EarlyPercussionClassifier } from './early-percussion-classifier.js';
import {PrecisionEvidenceRing,precisionConfiguration,precisionDecision} from './semantic-precision-guards.js';
import {ADTOF_CLASS_NAMES,labelProvenance,mappedPercussionKind,validateHatLabelMode} from './percussion-label-contract.js';
let session, config, ort, running = false, stopped = false, queue = [], frames = [], count = 0, lastTime;
let classifier = new PercussionClassifier();
let evidenceRing;
let labelShadow;
let diagnosticRecordingId,baseDiagnostics;
async function drain() {
  if (running || !session || stopped) return;
  running = true;
  try {
    while (queue.length && !stopped) {
      const block = queue.shift();
      for (let i = 0; i < block.times.length; i++) {
        const time = block.times[i];
        if (lastTime !== undefined && Math.abs(time - lastTime - .01) > .005) {
          frames = []; count = 0; classifier.reset();
        }
        lastTime = time;
        frames.push({ data: block.data.slice(i * config.bins, (i + 1) * config.bins), time,
          ...(config.telemetry || diagnosticRecordingId ? { availableAudioTime: block.availableAudioTime } : {}) });
        if (frames.length > config.windowFrames) frames.shift();
        if (++count % config.stepFrames) continue;
        const input = new Float32Array(config.windowFrames * config.bins);
        const offset = config.windowFrames - frames.length;
        for (let j = 0; j < frames.length; j++) input.set(frames[j].data, (offset + j) * config.bins);
        const began = performance.now();
        const inferenceStartedAt = config.diagnostics || config.telemetry ? Date.now() : undefined;
        const output = await session.run({ [config.input]: new ort.Tensor('float32', input,
          [1, config.windowFrames, config.bins, 1]) });
        if (stopped) return;
        const inferenceEndedAt = config.diagnostics || config.telemetry ? Date.now() : undefined;
        const scores = output[config.output].data;
        const events = [],guardDecisions=[],preGuardEvents=[],labelCandidates=[];
        const from = config.windowFrames - config.rightContext - config.stepFrames;
        const diagnostics = [];
        for (let j = from; j < from + config.stepFrames; j++) {
          const source = frames[j - offset];
          if (source) {
            const classes = config.scoreClasses || 5;
            const values = Array.from(scores.slice(j * classes, (j + 1) * classes));
            const timing = config.telemetry || diagnosticRecordingId ? {
              peakFeatureAvailableAudioTime: source.availableAudioTime,
              modelInputAudioTime: time, modelInputAvailableAudioTime: block.availableAudioTime,
              featurePostedAt: block.postedAt, workerReceivedAt: block.receivedAt,
              inferenceStartedAt, inferenceEndedAt,
            } : undefined;
            const decision = classifier.push(values, source.time, timing);
            if(config.hatLabelMapping!=='off'){
              labelCandidates.push(...(decision.labelCandidates||[]).map(record=>labelProvenance(record,config,classifier.labelMapping)));
              if(labelShadow){const alternate=labelShadow.push(values,source.time,timing);
                labelCandidates.push(...(alternate.labelCandidates||[]).map(record=>labelProvenance(record,config,'M1')));}
            }
            const accepted = [];
            for(const event of decision.events) {
              if(config.semanticPrecisionGuards.mode==='off'){accepted.push(event);continue;}
              const beganGuard=performance.now(),evidence=evidenceRing.lookup(event.audioTime,config.ownership);
              const guard=precisionDecision(event,evidence,config.semanticPrecisionGuards);
              preGuardEvents.push(event);
              guardDecisions.push({eventId:`${event.band}:${event.audioTime}`,ownership:config.ownership,modelSha256:config.sha256,
                rawScores:event.scores,confidence:event.confidence,audioTime:event.audioTime,classIndex:event.classIndex,
                evidence,guard,computeMs:performance.now()-beganGuard,addedLookaheadSeconds:0});
              if(guard.accept)accepted.push(event);
            }
            if (config.telemetry || diagnosticRecordingId) for (const event of accepted) event.timing = {
              ...event.timing, decisionAudioTime: source.time, decisionAt: Date.now(),
            };
            events.push(...accepted);
            if (config.diagnostics) diagnostics.push({ audioTime: source.time, scores: values, decisions:diagnosticRecordingId&&classifier.count>=3
              ?[...(decision.decisions||[]),{classIndex:2,audioTime:classifier.frames.find(f=>f.audioTime===decision.decisions?.[0]?.audioTime)?.audioTime,
                activation:classifier.scoreAt(2,classifier.count-3),novelty:classifier.noveltyAt(2,classifier.count-3),threshold:classifier.thresholds[2],thresholdApplied:false,peak:false,action:'unmapped-class'}].sort((a,b)=>a.classIndex-b.classIndex)
              :decision.decisions,
              ...(config.hatLabelMapping!=='off'?{heads:values.map((score,index)=>labelProvenance({
                audioTime:source.time,originalClassIndex:index,originalClassName:ADTOF_CLASS_NAMES[index],rawClassScore:score,
                rawScores:values,threshold:classifier.thresholds?.[index],peakNovelty:null,
                postprocessingDecision:'raw-score-frame',
                mappedSemanticKind:mappedPercussionKind(index,classifier.labelMapping),
                finalEmissionDecision:'frame-observation'},config,classifier.labelMapping))}:{}),
              ...(config.hatLabelMapping!=='off'?{postprocessingHeads:(decision.decisions||[]).map(d=>labelProvenance({
                audioTime:d.audioTime,originalClassIndex:d.classIndex,originalClassName:ADTOF_CLASS_NAMES[d.classIndex],
                rawClassScore:d.activation,rawScores:classifier.frames.find(frame=>frame.audioTime===d.audioTime)?.scores,
                peakNovelty:d.novelty,threshold:d.threshold,postprocessingDecision:d.action,
                mappedSemanticKind:mappedPercussionKind(d.classIndex,classifier.labelMapping),
                finalEmissionDecision:d.peak?'peak-awaiting-group':'not-candidate'},config,classifier.labelMapping))}:{}),
              ...(diagnosticRecordingId?{noveltyAudioTime:decision.decisions?.[0]?.audioTime,
                peakNovelty:Array.from({length:5},(_,index)=>decision.decisions?.find(d=>d.classIndex===index)?.novelty
                  ??(classifier.count>=3?classifier.noveltyAt(index,classifier.count-3):null)),
                captureCandidates:decision.labelCandidates||[]}:{}),
              ...(config.semanticPrecisionGuards.mode!=='off'?{ownership:config.ownership,modelSha256:config.sha256,
                evidence:evidenceRing.lookup(source.time,config.ownership)}:{}),
              events: accepted.map(event => ({ ...event, decisionAudioTime: source.time })) });
          }
        }
        self.postMessage({ kind: 'result', ownership:config.ownership, events, outcome: events.length ? 'percussion' : 'non-percussion/abstain',
          ...(diagnosticRecordingId?{diagnosticRecordingId}:{}),
          ...(config.hatLabelMapping!=='off'?{labelCandidates}:{}),
          ...(config.semanticPrecisionGuards.mode!=='off'?{guardDecisions,preGuardEvents}:{}),
          durationMs: performance.now() - began, queueDepth: queue.length, processedAudioTime: time,
          ...(config.telemetry || diagnosticRecordingId ? { timing: {
            featurePostedAt: block.postedAt, workerReceivedAt: block.receivedAt,
            inferenceStartedAt, inferenceEndedAt, modelInputAudioTime: time,
            modelInputAvailableAudioTime: block.availableAudioTime, featureComputeMs: block.featureComputeMs,
          } } : {}),
          ...(config.diagnostics ? { diagnostics, postedAt: block.postedAt, workerReceivedAt: block.receivedAt,
            availableAudioTime: block.availableAudioTime, inferenceStartedAt, inferenceEndedAt } : {}) });
      }
    }
  } catch { self.postMessage({ kind: 'failed',ownership:config?.ownership,...(diagnosticRecordingId?{diagnosticRecordingId}:{}) }); stopped = true; }
  finally { running = false; }
}
self.onmessage = async ({ data }) => {
  if (data.kind === 'init') {
    try {
      config = data.config;
      baseDiagnostics=config.diagnostics===true;
      config.semanticPrecisionGuards=precisionConfiguration(config.semanticPrecisionGuards);
      config.hatLabelMapping=validateHatLabelMode(config.hatLabelMapping);
      evidenceRing=new PrecisionEvidenceRing(config.ownership);
      classifier = config.classifier === 'causal' ? new CausalPercussionClassifier()
        : config.classifier === 'early-finalization' ? new EarlyPercussionClassifier(config.thresholds, { diagnostics: config.diagnostics === true })
        : new PercussionClassifier(config.thresholds, { onsetGuided: ['onset-guided','local-prominence'].includes(config.classifier),
          localProminence:config.classifier==='local-prominence',diagnostics:config.diagnostics===true });
      classifier.labelMapping=config.hatLabelMapping==='M1'?'M1':'M0';
      labelShadow=config.hatLabelMapping==='shadow'?new classifier.constructor(config.thresholds,{
        onsetGuided:['onset-guided','local-prominence'].includes(config.classifier),localProminence:config.classifier==='local-prominence',diagnostics:true,labelMapping:'M1'}):undefined;
      // Keep ORT's loader intact and emit its exact assets in production builds.
      const runtimeUrl = new URL('./vendor/percussion/ort.wasm.min.mjs', import.meta.url).href;
      ort = await import(/* @vite-ignore */ runtimeUrl);
      ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = {
        mjs: new URL('./vendor/percussion/ort-wasm-simd-threaded.mjs', import.meta.url).href,
        wasm: new URL('./vendor/percussion/ort-wasm-simd-threaded.wasm', import.meta.url).href,
      };
      session = await ort.InferenceSession.create(data.model, { executionProviders: ['wasm'] });
      self.postMessage({ kind: 'ready',ownership:config.ownership }); void drain();
    } catch { self.postMessage({ kind: 'failed',ownership:config?.ownership }); stopped = true; }
  }
  if(data.kind==='diagnostic-capture'&&!stopped&&config&&(!config.ownership||['captureId','sourceId','sourceGeneration','synchronizationEpoch'].every(key=>data.ownership?.[key]===config.ownership[key]))){
    if(data.enabled===true&&typeof data.recordingId==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(data.recordingId)){
      diagnosticRecordingId=data.recordingId;config.diagnostics=true;classifier.diagnostics=true;
      const state={};for(const key of ['frames','base','count','pending','lastTime'])state[key]=classifier[key];
      self.postMessage({kind:'diagnostic-start',diagnosticRecordingId,ownership:config.ownership,
        classifierState:JSON.parse(JSON.stringify(state)),classifier:config.classifier,thresholds:classifier.thresholds,
        onsetGuided:classifier.onsetGuided,localProminence:classifier.localProminence,labelMapping:classifier.labelMapping,
        modelSha256:config.sha256,modelId:config.id,at:Date.now()});
    }else if(data.recordingId===diagnosticRecordingId){
      self.postMessage({kind:'diagnostic-stop',diagnosticRecordingId,ownership:config.ownership,at:Date.now()});
      diagnosticRecordingId=undefined;config.diagnostics=baseDiagnostics;classifier.diagnostics=baseDiagnostics;
    }
  }
  if (data.kind === 'frames' && !stopped && data.times?.length === config?.stepFrames
    && (!config.ownership || ['captureId','sourceId','sourceGeneration','synchronizationEpoch'].every(key=>data.ownership?.[key]===config.ownership[key]))
    && data.data?.length === data.times.length * config.bins) {
    if (queue.length >= 3) { queue.shift(); evidenceRing.clear();self.postMessage({ kind: 'backlog',ownership:config.ownership,...(diagnosticRecordingId?{diagnosticRecordingId}:{}) }); }
    if(config.semanticPrecisionGuards.mode!=='off')evidenceRing.add(data.evidence,data.ownership);
    queue.push({ ...data, ...(config.diagnostics || config.telemetry ? { receivedAt: Date.now() } : {}) }); void drain();
  }
};
