import type {LearnerNextAction} from './academy-plan';
export type GuidanceContext={mode:'personal'|'shared';contentAvailable?:boolean;canLearn?:boolean;offlineSeed?:boolean};
export type GuidedAction=Omit<LearnerNextAction,'view'> & {view:LearnerNextAction['view']|'teams'};
export function refineNextUsefulStep(action:LearnerNextAction,context:GuidanceContext):{action:GuidedAction;help:string;secondary:{label:string;view:'support'|'studio'|'offline'}|null};
export function ownDraftSaveNotice(input:{local:Record<string,unknown>;saved:Record<string,unknown>;keys:string[];hasSavedDraft:boolean;pending?:boolean;accepted?:boolean;saveLabel:string}):{kind:'pending'|'unknown'|'new'|'matching'|'changed';message:string};
