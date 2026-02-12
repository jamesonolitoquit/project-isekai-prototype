export class CJ {
  constructor(public worldId: string) {}

  recordMutation(
    tickBefore: number,
    tickAfter: number,
    action: any,
    preSummary: any,
    events: any[],
    postSummary: any
  ): void {
    // stub: no-op for now
  }

  getRecent(n?: number): any[] {
    return [];
  }
}

export function summarizeStateMinimal(state: any) {
  return {};
}

export default CJ;