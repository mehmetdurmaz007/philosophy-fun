import { describe, expect, it } from 'vitest'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { DATA_FILES } from '../src/data'
import { FORM_ORDER, availableItems, formRank } from '../src/forms'
import { administrationGroup, interleavedOrder } from '../src/order'
import { scoreSession } from '../src/scoring'
import { rankPhilosophers, rankTraditions } from '../src/matcher'
import type { AnswerRecord, QuestionnaireData, PhilosopherData, TraditionData } from '../src/types'

function read<T>(files:readonly string[]):T{
  const b64=files.map(file=>readFileSync(`public/data/runtime/${file}`,'utf8')).join('')
  return JSON.parse(gunzipSync(Buffer.from(b64,'base64')).toString('utf8')) as T
}

const q=read<QuestionnaireData>(DATA_FILES.questionnaire)
const philosophers=read<PhilosopherData>(DATA_FILES.philosophers)
const traditions=read<TraditionData>(DATA_FILES.traditions)

function defaults(form:(typeof FORM_ORDER)[number]){
  return Object.entries(q.optional_modules).filter(([,m])=>m.default_in.includes(form)).map(([id])=>id)
}

function answersFor(form:(typeof FORM_ORDER)[number], mode:'neutral'|'high'|'low'|'unsure'|'pattern'){
  const items=availableItems(q,form,defaults(form))
  const answers:Record<string,AnswerRecord>={}
  items.forEach((item,index)=>{
    if(mode==='unsure'){
      answers[item.item_id]={itemId:item.item_id,value:null,missing:'USER_UNSURE',answeredAt:''}
      return
    }
    let value:number=50
    if(mode==='pattern') value=[0,25,50,75,100][index%5]
    if(mode==='high'&&(item.layer==='broad_continuum'||item.layer==='restricted_continuum')){
      const o=q.continuum_orientation[item.construct_id]
      value=item.key===o.high_pole?100:0
    }
    if(mode==='low'&&(item.layer==='broad_continuum'||item.layer==='restricted_continuum')){
      const o=q.continuum_orientation[item.construct_id]
      value=item.key===o.high_pole?0:100
    }
    answers[item.item_id]={itemId:item.item_id,value,missing:'ANSWERED',answeredAt:''}
  })
  return {items,answers}
}

describe('synthetic alpha QA',()=>{
  it('builds each default form to its frozen advertised size',()=>{
    for(const form of FORM_ORDER){
      const items=availableItems(q,form,defaults(form))
      expect(items).toHaveLength(q.forms[form].core_item_count)
      expect(new Set(items.map(i=>i.item_id)).size).toBe(items.length)
    }
  })

  it('does not allow specialist modules below their declared availability',()=>{
    for(const [id,module] of Object.entries(q.optional_modules)){
      for(const form of FORM_ORDER){
        if(formRank(form)>=formRank(module.available_from)) continue
        expect(availableItems(q,form,[id]).some(i=>i.construct_id===id)).toBe(false)
      }
    }
  })

  it('uses deterministic seeded interleaving without losing items',()=>{
    const items=availableItems(q,'QUICK',defaults('QUICK'))
    const a=interleavedOrder(items,'synthetic-seed')
    const b=interleavedOrder(items,'synthetic-seed')
    const c=interleavedOrder(items,'different-seed')
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    expect(new Set(a)).toEqual(new Set(items.map(i=>i.item_id)))
    const map=new Map(items.map(i=>[i.item_id,i]))
    for(let i=1;i<a.length;i++){
      const current=map.get(a[i]); const previous=map.get(a[i-1])
      expect(current&&previous?administrationGroup(current):'').not.toBe(current&&previous?administrationGroup(previous):'')
    }
  })

  it('keeps a fully neutral respondent at the genuine midpoint',()=>{
    const {items,answers}=answersFor('COMPLETE','neutral')
    const scores=scoreSession(q,items,answers,'COMPLETE')
    for(const s of Object.values(scores.continuous)) expect(s.score).toBe(50)
    for(const d of Object.values(scores.categorical)){
      expect(d.comparisonReady).toBe(true)
      for(const c of Object.values(d.categories)) expect(c.score).toBe(50)
    }
    for(const m of Object.values(scores.methods)) expect(m.score).toBe(50)
  })

  it('honors continuum key direction at both extremes',()=>{
    for(const mode of ['high','low'] as const){
      const {items,answers}=answersFor('ADVANCED',mode)
      const scores=scoreSession(q,items,answers,'ADVANCED')
      for(const s of Object.values(scores.continuous)) expect(s.score).toBe(mode==='high'?100:0)
    }
  })

  it('never converts an all-unsure respondent into neutral evidence or arbitrary comparable matches',()=>{
    const {items,answers}=answersFor('COMPLETE','unsure')
    const scores=scoreSession(q,items,answers,'COMPLETE')
    for(const s of Object.values(scores.continuous)){expect(s.score).toBeNull();expect(s.status).toBe('INSUFFICIENT')}
    for(const d of Object.values(scores.categorical)){
      expect(d.comparisonReady).toBe(false)
      for(const c of Object.values(d.categories)){expect(c.score).toBeNull();expect(c.status).toBe('INSUFFICIENT')}
    }
    for(const m of Object.values(scores.methods)){expect(m.score).toBeNull();expect(m.status).toBe('INSUFFICIENT')}
    const pm=rankPhilosophers(scores,philosophers.profiles)
    const tm=rankTraditions(scores,traditions.traditions)
    expect(pm.every(m=>m.W.compared+m.P.compared+m.M.compared===0)).toBe(true)
    expect(tm.every(m=>m.W.compared+m.P.compared+m.M.compared===0)).toBe(true)
  })

  it('keeps patterned scores, evidence and match outputs inside their valid bounds',()=>{
    const {items,answers}=answersFor('ADVANCED','pattern')
    const scores=scoreSession(q,items,answers,'ADVANCED')
    for(const s of Object.values(scores.continuous)) if(s.score!==null) expect(s.score).toBeGreaterThanOrEqual(0)
    for(const s of Object.values(scores.continuous)) if(s.score!==null) expect(s.score).toBeLessThanOrEqual(100)
    const matches=[...rankPhilosophers(scores,philosophers.profiles).slice(0,20),...rankTraditions(scores,traditions.traditions).slice(0,20)]
    for(const m of matches){
      expect(Number.isFinite(m.rankingIndex)).toBe(true)
      for(const c of [m.W,m.R,m.P,m.M]){
        expect(c.adjusted).toBeGreaterThanOrEqual(0); expect(c.adjusted).toBeLessThanOrEqual(100)
        expect(c.evidence).toBeGreaterThanOrEqual(0); expect(c.evidence).toBeLessThanOrEqual(1)
        if(c.raw!==null){expect(c.raw).toBeGreaterThanOrEqual(0);expect(c.raw).toBeLessThanOrEqual(100)}
      }
    }
  })
})
