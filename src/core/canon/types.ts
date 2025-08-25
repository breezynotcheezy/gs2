export type PaResult =
  | "strikeout"
  | "walk"
  | "gb"
  | "fb"
  | "ld"
  | "double"
  | "triple"
  | "hr"
  | "hbp"
  | "reached_on_error"
  | "fielder_choice";

export type PitchEvent = "ball" | "called_strike" | "swinging_strike" | "foul" | "in_play";

export type RunnerActionKind = "steal" | "steal_home" | "advance" | "score";

export interface RunnerAction {
  runner: string;
  action: RunnerActionKind;
  to: 1 | 2 | 3 | 4;
}

export interface PlateAppearanceCanonical {
  pa_result: PaResult;
  pitches: PitchEvent[];
  batter?: string | null;
  pitcher?: string | null;
  fielder_num?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | null;
  outs_added: 0 | 1 | 2 | 3;
  explicit_runner_actions: RunnerAction[];
  notes?: string[];
  confidence: number; // 0..1
}

export interface GameContext {
  inning: number;
  half: "top" | "bottom";
  outs: 0 | 1 | 2;
  bases: { 1?: string; 2?: string; 3?: string };
  score: { home: number; away: number };
  pitcher?: string | null;
  rosterAliases?: Record<string, string>;
  positionMap?: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, string>;
}
