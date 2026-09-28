export type FormId = 'QUICK' | 'STANDARD' | 'COMPLETE' | 'ADVANCED'
export type Layer = 'broad_continuum' | 'restricted_continuum' | 'categorical_affinity' | 'advanced_categorical_affinity' | 'method_profile'
export type MissingState = 'ANSWERED' | 'USER_UNSURE' | 'NO_RESPONSE'
export type ScoreStatus = 'SCORABLE' | 'PROVISIONAL' | 'INSUFFICIENT'
export type ProfileStatus = 'SETTLED' | 'CONTESTED' | 'UNKNOWN' | 'NA'

export interface QuestionnaireItem {
  item_id: string
  construct_id: string
  construct_name: string
  layer: Layer
  text: string
  key: string
  category: string
  method: string
  facet: string
  quick_core: boolean
  standard_core: boolean
  complete_core: boolean
  advanced_core: boolean
  optional_from: string
}

export interface OptionalModule {
  available_from: FormId
  default_in: FormId[]
  item_count: number
  reason: string
}

export interface QuestionnaireData {
  questionnaire_version: string
  forms: Record<FormId, { core_item_count: number; purpose: string; estimated_scope: string; result_limits: string }>
  optional_modules: Record<string, OptionalModule>
  continuum_orientation: Record<string, { high_label: string; high_pole: string; low_label: string; low_pole: string }>
  items: QuestionnaireItem[]
}

export interface AnswerRecord {
  itemId: string
  value: number | null
  missing: MissingState
  answeredAt: string
}

export interface SessionState {
  version: 1
  form: FormId
  modules: string[]
  seed: string
  order: string[]
  cursor: number
  answers: Record<string, AnswerRecord>
  startedAt: string
}

export interface ContinuousScore {
  kind: 'continuous'
  constructId: string
  name: string
  score: number | null
  status: ScoreStatus
  answered: number
  administered: number
  highPole: string
  lowPole: string
  highLabel: string
  lowLabel: string
}

export interface CategoryScore {
  score: number | null
  status: ScoreStatus
  answered: number
  administered: number
}

export interface CategoricalScore {
  kind: 'categorical'
  constructId: string
  name: string
  categories: Record<string, CategoryScore>
  comparisonReady: boolean
  answered: number
  administered: number
}

export interface MethodScore {
  method: string
  score: number | null
  status: ScoreStatus
  answered: number
  administered: number
}

export interface UserScores {
  continuous: Record<string, ContinuousScore>
  categorical: Record<string, CategoricalScore>
  methods: Record<string, MethodScore>
}

export interface ProfileContinuous {
  status: ProfileStatus
  central_estimate: number | null
  plausible_range?: [number, number] | null
  confidence: number | null
  rationale?: string
}

export interface ProfileCategorical {
  status: ProfileStatus
  affinities: Record<string, number | null> | null
  confidence: number | null
  rationale?: string
}

export interface ProfileMethod {
  score: number | null
  status: ProfileStatus
  confidence: number | null
  rationale?: string
}

export interface PhilosopherProfile {
  id: string
  name: string
  profile_label: string
  period: string
  W: Record<string, ProfileContinuous>
  R: Record<string, ProfileContinuous>
  P: Record<string, ProfileCategorical>
  M: Record<string, ProfileMethod>
}

export interface PhilosopherData { profiles: PhilosopherProfile[] }

export interface TraditionInterval {
  status: ProfileStatus
  center: number | null
  core_range: [number, number] | null
  breadth: number | null
  confidence: number | null
}
export interface TraditionCategorical {
  status: ProfileStatus
  categories: Record<string, { center: number; core_range: [number, number]; breadth: number }> | null
  confidence: number | null
  mean_breadth?: number | null
}
export interface TraditionProfileShape {
  W: Record<string, TraditionInterval>
  R: Record<string, TraditionInterval>
  P: Record<string, TraditionCategorical>
  M: Record<string, TraditionInterval>
}
export interface TraditionStrand extends TraditionProfileShape { id: string; name: string; members: string[] }
export interface Tradition extends TraditionProfileShape {
  id: string
  name: string
  family: string
  scope_note: string
  structure: 'DISTRIBUTION' | 'MULTISTRAND'
  strands: TraditionStrand[]
  breadth_summary: { mean_interval_width: number; scored_interval_count: number }
}
export interface TraditionData { traditions: Tradition[] }

export interface ComponentMatch {
  raw: number | null
  adjusted: number
  evidence: number
  compared: number
  thin: boolean
}
export interface PhilosopherMatch {
  id: string
  name: string
  label: string
  period: string
  W: ComponentMatch
  P: ComponentMatch
  M: ComponentMatch
  rankingIndex: number
}
export interface TraditionMatch {
  id: string
  name: string
  family: string
  scopeNote: string
  W: ComponentMatch
  P: ComponentMatch
  M: ComponentMatch
  rankingIndex: number
  closestStrand?: string
  breadth: number
}
