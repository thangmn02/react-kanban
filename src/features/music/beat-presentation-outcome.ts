/** Software observation contract; none of these outcomes proves physical scanout. */
export type PresentationOutcome = 'FRAME_OBSERVED' | 'ANIMATION_STARTED' | 'ELIGIBLE_TRUNCATED_AT_SOURCE_END'
  | 'CANCELLED_BEFORE_PRESENTATION' | 'NO_DISPLAY_OPPORTUNITY' | 'UNEXPLAINED_PRESENTATION_LOSS';
export interface PresentationObservation {
  semanticEventId: string;
  deadline: number;
  admittedAt?: number;
  committedAt?: number;
  animationStartedAt?: number;
  observedFrameAt?: number;
  expiresAt: number;
  frameOpportunities: readonly number[];
  boundary?: { kind: 'source-end' | 'pause' | 'seek' | 'source-switch' | 'capture-reset' | 'worker-cancel'; at: number };
  explicitCancellation?: boolean;
}
export function classifyPresentation(value: PresentationObservation): { outcome: PresentationOutcome; onTime: boolean | null; physicalVerified: false } {
  const {boundary}=value;
  const beforeBoundary=(at:number)=>!boundary||at<boundary.at;
  const onTime=value.admittedAt===undefined||!Number.isFinite(value.deadline)?null:value.admittedAt<=value.deadline;
  const result=(outcome:PresentationOutcome)=>({outcome,onTime,physicalVerified:false as const});
  if(value.observedFrameAt!==undefined&&value.observedFrameAt>=value.deadline&&value.observedFrameAt<value.expiresAt&&beforeBoundary(value.observedFrameAt))return result('FRAME_OBSERVED');
  if(value.animationStartedAt!==undefined&&value.animationStartedAt<value.expiresAt&&beforeBoundary(value.animationStartedAt))return result('ANIMATION_STARTED');
  if(value.explicitCancellation&&(value.committedAt===undefined||boundary&&value.committedAt>=boundary.at))return result('CANCELLED_BEFORE_PRESENTATION');
  const opportunities=value.committedAt===undefined?[]:value.frameOpportunities.filter(at=>at>value.committedAt!&&at<value.expiresAt&&beforeBoundary(at));
  if(boundary?.kind==='source-end'&&value.committedAt!==undefined&&value.committedAt<boundary.at&&boundary.at<value.expiresAt&&!opportunities.length)return result('ELIGIBLE_TRUNCATED_AT_SOURCE_END');
  if(value.explicitCancellation&&boundary&&value.committedAt!==undefined&&boundary.at<value.expiresAt)return result('CANCELLED_BEFORE_PRESENTATION');
  if(value.committedAt!==undefined&&!opportunities.length)return result('NO_DISPLAY_OPPORTUNITY');
  return result('UNEXPLAINED_PRESENTATION_LOSS');
}
