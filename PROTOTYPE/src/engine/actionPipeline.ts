// Stub for actionPipeline
export type Action = {
  worldId: string;
  playerId: string;
  type: string;
  payload: any;
};

export function processAction(action: Action, state: any) {
  return state;
}