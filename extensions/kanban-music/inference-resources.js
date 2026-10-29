/** The caller transfers these feed tensors for one inference, including failure paths. */
export async function withOwnedInference(session,feeds,consume){
 let outputs;
 try{outputs=await session.run(feeds);return await consume(outputs);}
 finally{for(const tensor of new Set([...Object.values(feeds),...Object.values(outputs||{})]))tensor?.dispose();}
}
