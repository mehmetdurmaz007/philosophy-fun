import type { AnswerRecord, CategoricalScore, ContinuousScore, FormId, MethodScore, QuestionnaireData, QuestionnaireItem, ScoreStatus, UserScores } from './types'

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const roundHalfUp = (x: number) => Math.floor(x + 0.5)

export const CONTINUUM_PROFILE_KEYS: Record<string, { layer: 'W' | 'R'; key: string }> = {
  W_MORAL_OBJECTIVITY: { layer: 'W', key: 'moral_objectivity' },
  W_RELATIONAL_SELF: { layer: 'W', key: 'relational_self' },
  W_MORAL_GENERALISM: { layer: 'W', key: 'moral_generalism' },
  W_SUBSTANCE_PROCESS: { layer: 'W', key: 'substance_process' },
  W_EXPERIENCE_APRIORI: { layer: 'W', key: 'experience_apriori' },
  W_AESTHETIC_RESPONSE: { layer: 'W', key: 'aesthetic_response' },
  R_MENTAL_PHYSICALISM: { layer: 'R', key: 'mental_physicalism' },
  R_SCIENTIFIC_REALISM: { layer: 'R', key: 'scientific_realism' },
  R_REPRESENTATION_PRACTICE: { layer: 'R', key: 'representation_practice' }
}

export const CATEGORY_PROFILE_KEYS: Record<string, string> = {
  P_NORMATIVE_ETHICS: 'normative_ethics',
  P_FREE_WILL: 'free_will',
  P_PERSONAL_IDENTITY: 'personal_identity',
  P_ULTIMATE_REALITY: 'ultimate_reality'
}

function substantive(a?: AnswerRecord): a is AnswerRecord & { value: number } {
  return Boolean(a && a.missing === 'ANSWERED' && a.value !== null)
}

function continuumStatus(items: QuestionnaireItem[], answered: QuestionnaireItem[]): ScoreStatus {
  if (!items.length) return 'INSUFFICIENT'
  const ratio = answered.length / items.length
  const poleCounts = new Map<string, number>()
  for (const i of answered) poleCounts.set(i.key, (poleCounts.get(i.key) ?? 0) + 1)
  const poles = [...new Set(items.map(i => i.key))]
  const represented = poles.every(p => (poleCounts.get(p) ?? 0) >= 1)
  const twoEach = items.length < 6 || poles.every(p => (poleCounts.get(p) ?? 0) >= 2)
  if (ratio >= .75 && represented && twoEach) return 'SCORABLE'
  if (ratio >= .50 && represented) return 'PROVISIONAL'
  return 'INSUFFICIENT'
}

function categoryStatus(answered: number, administered: number): ScoreStatus {
  if (!administered) return 'INSUFFICIENT'
  const ratio = answered / administered
  if (ratio >= .75) return 'SCORABLE'
  if (ratio >= .50) return 'PROVISIONAL'
  return 'INSUFFICIENT'
}

function methodStatus(form: FormId, answered: number, administered: number): ScoreStatus {
  if (!administered) return 'INSUFFICIENT'
  if (form === 'QUICK') return answered === 2 ? 'SCORABLE' : answered === 1 ? 'PROVISIONAL' : 'INSUFFICIENT'
  if (form === 'STANDARD') return answered === 3 ? 'SCORABLE' : answered >= 2 ? 'PROVISIONAL' : 'INSUFFICIENT'
  return answered >= 3 ? 'SCORABLE' : answered >= 2 ? 'PROVISIONAL' : 'INSUFFICIENT'
}

export function scoreSession(q: QuestionnaireData, administered: QuestionnaireItem[], answers: Record<string, AnswerRecord>, form: FormId): UserScores {
  const continuous: Record<string, ContinuousScore> = {}
  const categorical: Record<string, CategoricalScore> = {}
  const methods: Record<string, MethodScore> = {}

  const contGroups = new Map<string, QuestionnaireItem[]>()
  const catGroups = new Map<string, QuestionnaireItem[]>()
  for (const item of administered) {
    if (item.layer === 'broad_continuum' || item.layer === 'restricted_continuum') {
      contGroups.set(item.construct_id, [...(contGroups.get(item.construct_id) ?? []), item])
    } else if (item.layer === 'categorical_affinity' || item.layer === 'advanced_categorical_affinity') {
      catGroups.set(item.construct_id, [...(catGroups.get(item.construct_id) ?? []), item])
    }
  }

  for (const [constructId, items] of contGroups) {
    const orientation = q.continuum_orientation[constructId]
    if (!orientation) continue
    const answeredItems = items.filter(i => substantive(answers[i.item_id]))
    const values = answeredItems.map(i => {
      const r = answers[i.item_id].value as number
      return i.key === orientation.high_pole ? r : 100 - r
    })
    const status = continuumStatus(items, answeredItems)
    continuous[constructId] = {
      kind: 'continuous', constructId, name: items[0].construct_name,
      score: values.length ? roundHalfUp(mean(values)) : null,
      status, answered: values.length, administered: items.length,
      highPole: orientation.high_pole, lowPole: orientation.low_pole,
      highLabel: orientation.high_label, lowLabel: orientation.low_label
    }
  }

  for (const [constructId, items] of catGroups) {
    const cats = [...new Set(items.map(i => i.category))]
    const categoryScores: CategoricalScore['categories'] = {}
    for (const cat of cats) {
      const subset = items.filter(i => i.category === cat)
      const vals = subset.flatMap(i => substantive(answers[i.item_id]) ? [answers[i.item_id].value as number] : [])
      categoryScores[cat] = {
        score: vals.length ? roundHalfUp(mean(vals)) : null,
        status: categoryStatus(vals.length, subset.length),
        answered: vals.length,
        administered: subset.length
      }
    }
    const totalAnswered = items.filter(i => substantive(answers[i.item_id])).length
    const comparisonReady = Object.values(categoryScores).every(x => x.status !== 'INSUFFICIENT') && totalAnswered / items.length >= .75
    categorical[constructId] = {
      kind: 'categorical', constructId, name: items[0].construct_name,
      categories: categoryScores, comparisonReady, answered: totalAnswered, administered: items.length
    }
  }

  const methodItems = administered.filter(i => i.layer === 'method_profile')
  for (const method of [...new Set(methodItems.map(i => i.method))]) {
    const subset = methodItems.filter(i => i.method === method)
    const vals = subset.flatMap(i => substantive(answers[i.item_id]) ? [answers[i.item_id].value as number] : [])
    methods[method] = {
      method,
      score: vals.length ? roundHalfUp(mean(vals)) : null,
      status: methodStatus(form, vals.length, subset.length),
      answered: vals.length,
      administered: subset.length
    }
  }

  return { continuous, categorical, methods }
}
