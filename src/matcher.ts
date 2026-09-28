import type { ComponentMatch, PhilosopherMatch, PhilosopherProfile, Tradition, TraditionInterval, TraditionMatch, TraditionProfileShape, UserScores } from './types'
import { CATEGORY_PROFILE_KEYS, CONTINUUM_PROFILE_KEYS } from './scoring'

const PRIORS = { W: 65.47, P: 66.18, M: 68.70 }
const TRAD_PRIORS = { W: 85.49, P: 76.95, M: 80.50 }
const statusFactor = (s: string) => s === 'SCORABLE' ? 1 : s === 'PROVISIONAL' ? .6 : 0
const clamp = (x: number, lo=0, hi=100) => Math.max(lo, Math.min(hi, x))

function finalize(rawNumer: number, rawDenom: number, evidenceNumer: number, evidenceDenom: number, prior: number, compared: number, thinCutoff: number): ComponentMatch {
  const raw = rawDenom > 0 ? rawNumer / rawDenom : null
  const evidence = evidenceDenom > 0 ? clamp(evidenceNumer / evidenceDenom, 0, 1) : 0
  const adjusted = raw === null ? prior : prior + Math.sqrt(evidence) * (raw - prior)
  return { raw, adjusted, evidence, compared, thin: compared < thinCutoff }
}

export function matchPhilosopher(user: UserScores, p: PhilosopherProfile): PhilosopherMatch {
  let wn=0, wd=0, wen=0, wed=0, wc=0
  for (const [cid, us] of Object.entries(user.continuous)) {
    if (us.score === null || us.status === 'INSUFFICIENT') continue
    const map = CONTINUUM_PROFILE_KEYS[cid]
    if (!map) continue
    const base = map.layer === 'R' ? .75 : 1
    const uf = statusFactor(us.status)
    wed += base * uf
    const ps = p[map.layer][map.key]
    if (!ps || ps.status === 'NA' || ps.status === 'UNKNOWN' || ps.central_estimate === null) continue
    const pc = ps.confidence ?? .5
    const w = base * uf * pc
    wn += w * (100 - Math.abs(us.score - ps.central_estimate)); wd += w
    wen += w
    wc++
  }
  const W = finalize(wn,wd,wen,wed,PRIORS.W,wc,3)

  let pn=0,pd=0,pen=0,ped=0,pcnt=0
  for (const [cid, us] of Object.entries(user.categorical)) {
    const key = CATEGORY_PROFILE_KEYS[cid]
    if (!key || !us.comparisonReady) continue
    let userFactor=1
    for (const uv of Object.values(us.categories)) if (uv.score !== null && uv.status !== 'INSUFFICIENT') userFactor = Math.min(userFactor, statusFactor(uv.status))
    ped += userFactor
    const ps = p.P[key]
    if (!ps || ps.status === 'NA' || ps.status === 'UNKNOWN' || !ps.affinities) continue
    const sims:number[]=[]
    for (const [cat, uv] of Object.entries(us.categories)) {
      const pv = ps.affinities[cat]
      if (uv.score === null || uv.status === 'INSUFFICIENT' || pv === null || pv === undefined) continue
      sims.push(100 - Math.abs(uv.score - pv))
    }
    if (!sims.length) continue
    const w = (ps.confidence ?? .5) * userFactor
    pn += w * (sims.reduce((a,b)=>a+b,0)/sims.length); pd += w
    pen += w
    pcnt++
  }
  const P = finalize(pn,pd,pen,ped,PRIORS.P,pcnt,2)

  let mn=0,md=0,men=0,med=0,mc=0
  for (const [method, us] of Object.entries(user.methods)) {
    if (us.score === null || us.status === 'INSUFFICIENT') continue
    const uf = statusFactor(us.status)
    med += uf
    const ps = p.M[method]
    if (!ps || ps.status === 'NA' || ps.status === 'UNKNOWN' || ps.score === null) continue
    const w = uf * (ps.confidence ?? .5)
    mn += w * (100 - Math.abs(us.score - ps.score)); md += w
    men += w
    mc++
  }
  const M = finalize(mn,md,men,med,PRIORS.M,mc,6)
  return { id:p.id, name:p.name, label:p.profile_label, period:p.period, W,P,M, rankingIndex:(W.adjusted+P.adjusted+M.adjusted)/3 }
}

export function rankPhilosophers(user: UserScores, profiles: PhilosopherProfile[]) {
  return profiles.map(p => matchPhilosopher(user,p)).sort((a,b)=>b.rankingIndex-a.rankingIndex)
}

function intervalSim(u:number, i:TraditionInterval) {
  if (!i.core_range) return null
  const [l,h]=i.core_range
  if (u>=l && u<=h) return 100
  return Math.max(0, 100 - (u<l ? l-u : u-h))
}
function specificity(breadth:number|null|undefined) { return Math.max(.20, 1 - (breadth ?? 100)/120) }

function matchTradShape(user:UserScores, shape:TraditionProfileShape) {
  let wn=0,wd=0,wen=0,wed=0,wc=0
  for (const [cid,us] of Object.entries(user.continuous)) {
    if (us.score===null || us.status==='INSUFFICIENT') continue
    const map=CONTINUUM_PROFILE_KEYS[cid]; if(!map) continue
    const uf=statusFactor(us.status), base=map.layer==='R'?.75:1
    wed+=uf*base
    const ti=shape[map.layer][map.key]; if(!ti || ti.status==='NA'||ti.status==='UNKNOWN'||!ti.core_range) continue
    const s=intervalSim(us.score,ti); if(s===null) continue
    const conf=ti.confidence??.5
    const rw=uf*conf*base
    wn+=rw*s; wd+=rw
    wen+=rw*specificity(ti.breadth)
    wc++
  }
  const W=finalize(wn,wd,wen,wed,TRAD_PRIORS.W,wc,3)

  let pn=0,pd=0,pen=0,ped=0,pc=0
  for (const [cid,us] of Object.entries(user.categorical)) {
    const key=CATEGORY_PROFILE_KEYS[cid]; if(!key||!us.comparisonReady) continue
    let uf=1
    for(const uv of Object.values(us.categories)) if(uv.score!==null&&uv.status!=='INSUFFICIENT') uf=Math.min(uf,statusFactor(uv.status))
    ped+=uf
    const tp=shape.P[key]; if(!tp||tp.status==='NA'||tp.status==='UNKNOWN'||!tp.categories) continue
    const sims:number[]=[]; const qs:number[]=[]
    for (const [cat,uv] of Object.entries(us.categories)) {
      const ti=tp.categories[cat]; if(!ti||uv.score===null||uv.status==='INSUFFICIENT') continue
      const [l,h]=ti.core_range
      const s=uv.score>=l&&uv.score<=h?100:Math.max(0,100-(uv.score<l?l-uv.score:uv.score-h))
      sims.push(s); qs.push(specificity(ti.breadth))
    }
    if(!sims.length) continue
    const conf=tp.confidence??.5, w=conf*uf
    pn+=w*(sims.reduce((a,b)=>a+b,0)/sims.length); pd+=w
    pen+=w*(qs.reduce((a,b)=>a+b,0)/qs.length)
    pc++
  }
  const P=finalize(pn,pd,pen,ped,TRAD_PRIORS.P,pc,2)

  let mn=0,md=0,men=0,med=0,mc=0
  for(const [method,us] of Object.entries(user.methods)){
    if(us.score===null||us.status==='INSUFFICIENT') continue
    const uf=statusFactor(us.status)
    med+=uf
    const ti=shape.M[method]; if(!ti||ti.status==='NA'||ti.status==='UNKNOWN'||!ti.core_range) continue
    const s=intervalSim(us.score,ti); if(s===null) continue
    const conf=ti.confidence??.5, w=uf*conf
    mn+=w*s; md+=w; men+=w*specificity(ti.breadth); mc++
  }
  const M=finalize(mn,md,men,med,TRAD_PRIORS.M,mc,6)
  return {W,P,M, ranking:(W.adjusted+P.adjusted+M.adjusted)/3}
}

export function matchTradition(user:UserScores,t:Tradition):TraditionMatch{
  const common=matchTradShape(user,t)
  let ranking=common.ranking, closestStrand:string|undefined
  if(t.structure==='MULTISTRAND'&&t.strands?.length){
    const strandScores=t.strands.map(s=>({name:s.name,match:matchTradShape(user,s)})).sort((a,b)=>b.match.ranking-a.match.ranking)
    if(strandScores[0]){ closestStrand=strandScores[0].name; ranking=.45*common.ranking+.55*strandScores[0].match.ranking }
  }
  return {id:t.id,name:t.name,family:t.family,scopeNote:t.scope_note,W:common.W,P:common.P,M:common.M,rankingIndex:ranking,closestStrand,breadth:t.breadth_summary.mean_interval_width}
}
export function rankTraditions(user:UserScores,traditions:Tradition[]){return traditions.map(t=>matchTradition(user,t)).sort((a,b)=>b.rankingIndex-a.rankingIndex)}
