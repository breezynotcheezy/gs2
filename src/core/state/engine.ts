// Finite-state engine (stub)
// Responsibilities for later:
// - Advance pitch count from pitches[] deterministically
// - Apply runner actions in sequence
// - Apply pa_result (outs, base pushes, forced advances on BB/HBP, scoring)
// - Guards and invariants
// - Snapshotting after each PA

export interface BaseState {
  inning: number;
  half: "top" | "bottom";
  outs: 0 | 1 | 2;
  bases: { 1?: string; 2?: string; 3?: string };
  score: { home: number; away: number };
}

export interface TransitionResult {
  next: BaseState;
  notes?: string[];
}

export function applyPlateAppearanceStub(state: BaseState) : TransitionResult {
  // Placeholder: returns same state for now
  return { next: { ...state } };
}
