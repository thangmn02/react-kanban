/** Reverse only recorder injection, model verification and tensor lifetime maintenance. */
export function restoreRuntimeMaintenance(file,source){
 let text=source.replaceAll('\r\n','\n');
 if(file.endsWith('/capture-engine.js'))text=text.replace('  createDiagnosticRecorder,\n','').replace('const telemetry =',"import {LiveDiagnosticRecorder} from './live-diagnostic-recorder.js';\nconst telemetry =").replace("||typeof createDiagnosticRecorder!=='function'",'').replace('recording=createDiagnosticRecorder(','recording=new LiveDiagnosticRecorder(');
 if(file.endsWith('/offscreen.js'))text=text.replace("import {LiveDiagnosticRecorder} from './live-diagnostic-recorder.js';\n",'').replace('  createDiagnosticRecorder: options => new LiveDiagnosticRecorder(options),\n','');
 if(file.endsWith('/percussion-worker.js'))text=text.replace("import {loadFrozenPercussionModel} from './model-assets.js';\n",'').replace("import {withOwnedInference} from './inference-resources.js';\n",'').replace('await withOwnedInference(session, { [config.input]: new ort.Tensor','const output = await session.run({ [config.input]: new ort.Tensor').replace('[1, config.windowFrames, config.bins, 1]) }, output => {','[1, config.windowFrames, config.bins, 1]) });').replace('        });\n      }\n    }\n  } catch','      }\n    }\n  } catch').replace('      const modelBytes=await loadFrozenPercussionModel(data.model,config);\n      session = await ort.InferenceSession.create(modelBytes,','      session = await ort.InferenceSession.create(data.model,');
 return text;
}
