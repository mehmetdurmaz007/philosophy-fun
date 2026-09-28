import type { ComponentMatch, PhilosopherMatch, PhilosopherProfile, Tradition, TraditionInterval, TraditionMatch, TraditionProfileShape, UserScores } from './types'
import { CATEGORY_PROFILE_KEYS, CONTINUUM_PROFILE_KEYS } from './scoring'

const PRIORS = { W: 65.47, R: 65.00, P: 66.18, M: 68.70 }
const TRAD_PRIORS = { W: 85.49, R: 80.00, P: 76.95, M: 80.50 }
const statusFactor = (s: string) => s === 'SCORABLE' ? 1 : s === 'PROVISIONAL' ? .6 : 0
const clamp = (x: number, lo=0, hi=100) => Math.max(lo, Math.min(hi, x))

export const RETRIEVAL_WEIGHTINGS = [
  {W:1/3,P:1/3,M:1/3},
  {W:.50,P:.25,M:.25},
  {W:.25,P:.50,M:.25},
  {W:.25,P:.25,M:.50},
  {W:.60,P:.20,M:.20},
  {W:.20,P:.60,M:.20},
  {W:.20,P:.20,M:.60}
] as const

export function sensitivityRank<T extends {id:string;W:ComponentMatch;P:ComponentMatch;M:ComponentMatch;rankingIndex:number}>(matches:T[]):T[]{
  if(matches.length<=1)return matches
  const totals=new Map<string,number>(matches.map(m=>[m.id,0]))
  for(const weights of RETRIEVAL_WEIGHTINGS){
    const scored=matches.map(m=>({m,score:weights.W*m.W.adjusted+weights.P*m.P.adjusted+weights.M*m.M.adjusted})).sort((a,b)=>b.score-a.score||a.m.id.localeCompare(b.m.id))
    let i=0
    while(i<scored.length){
      let j=i+1
      while(j<scored.length&&Math.abs(scored[j].score-scored[i].score)<1e-9)j++
      const averageRank=(i+j-1)/2
      const percentile=scored.length===1?100:100*(scored.length-1-averageRank)/(scored.length-1)
      for(let k=i;k<j;k++)totals.set(scored[k].m.id,(totals.get(scored[k].m.id)??0)+percentile)
      i=j
    }
  }
  const ranked=matches.map(m=>({...m,rankingIndex:(totals.get(m.id)??0)/RETRIEVAL_WEIGHTINGS.length}))
  return ranked.sort((a,b)=>b.rankingIndex-a.rankingIndex||((b.W.evidence+b.P.evidence+b.M.evidence)-(a.W.evidence+a.P.evidence+a.M.evidence))||a.id.localeCompare(b.id))
}

function finalize(rawNumer:number, rawDenom:number, evidenceNumer:number, evidenceDenom:number, prior:number, compared:number, thinCutoff:number):ComponentMatch{
  const raw=rawDenom>0?rawNumer/rawDenom:null
  const evidence=evidenceDenom>0?clamp(evidenceNumer/evidenceDenom,0,1):0
  const adjusted=raw===null?prior:prior+Math.sqrt(evidence)*(raw-prior)
  return {raw,adjusted,evidence,compared,thin:compared<thinCutoff}
}

function centeredCosineSimilarity(a:number[],b:number[]){
  if(a.length!==b.length||a.length<2)return null
  const am=a.reduce((x,y)=>x+y,0)/a.length
  const bm=b.reduce((x,y)=>x+y,0)/b.length
  const ac=a.map(x=>x-am), bc=b.map(x=>x-bm)
  const an=Math.sqrt(ac.reduce((x,y)=>x+y*y,0))
  const bn=Math.sqrt(bc.reduce((x,y)=>x+y*y,0))
  if(an===0||bn===0)return null
  const cosine=ac.reduce((sum,x,i)=>sum+x*bc[i],0)/(an*bn)
  return clamp((cosine+1)*50)
}

function matchPhilosopherContinuous(user:UserScores,p:PhilosopherProfile,layer:'W'|'R',prior:number,thinCutoff:number){
  let n=0,d=0,en=0,ed=0,c=0
  for(const [cid,us] of Object.entries(user.continuous)){
    if(us.score===null||us.status==='INSUFFICIENT') continue
    const map=CONTINUUM_PROFILE_KEYS[cid]
    if(!map||map.layer!==layer) continue
    const uf=statusFactor(us.status)
    ed+=uf
    const ps=p[layer][map.key]
    if(!ps||ps.status==='NA'||ps.status==='UNKNOWN'||ps.central_estimate===null) continue
    const w=uf*(ps.confidence??.5)
    n+=w*(100-Math.abs(us.score-ps.central_estimate)); d+=w; en+=w; c++
  }
  return finalize(n,d,en,ed,prior,c,thinCutoff)
}

export function matchPhilosopher(user:UserScores,p:PhilosopherProfile):PhilosopherMatch{
  const W=matchPhilosopherContinuous(user,p,'W',PRIORS.W,3)
  const R=matchPhilosopherContinuous(user,p,'R',PRIORS.R,2)

  let pn=0,pd=0,pen=0,ped=0,pcnt=0
  for(const [cid,us] of Object.entries(user.categorical)){
    const key=CATEGORY_PROFILE_KEYS[cid]
    if(!key||!us.comparisonReady) continue
    let uf=1
    for(const uv of Object.values(us.categories)) if(uv.score!==null&&uv.status!=='INSUFFICIENT') uf=Math.min(uf,statusFactor(uv.status))
    ped+=uf
    const ps=p.P[key]
    if(!ps||ps.status==='NA'||ps.status==='UNKNOWN'||!ps.affinities) continue
    const uvec:number[]=[]; const pvec:number[]=[]
    for(const [cat,uv] of Object.entries(us.categories)){
      const pv=ps.affinities[cat]
      if(uv.score===null||uv.status==='INSUFFICIENT'||pv===null||pv===undefined) continue
      uvec.push(uv.score); pvec.push(pv)
    }
    const sim=centeredCosineSimilarity(uvec,pvec)
    if(sim===null) continue
    const w=(ps.confidence??.5)*uf
    pn+=w*sim; pd+=w; pen+=w; pcnt++
  }
  const P=finalize(pn,pd,pen,ped,PRIORS.P,pcnt,2)

  let mn=0,md=0,men=0,med=0,mc=0
  for(const [method,us] of Object.entries(user.methods)){
    if(us.score===null||us.status==='INSUFFICIENT') continue
    const uf=statusFactor(us.status)
    med+=uf
    const ps=p.M[method]
    if(!ps||ps.status==='NA'||ps.status==='UNKNOWN'||ps.score===null) continue
    const w=uf*(ps.confidence??.5)
    mn+=w*(100-Math.abs(us.score-ps.score)); md+=w; men+=w; mc++
  }
  const M=finalize(mn,md,men,med,PRIORS.M,mc,6)

  // Retrieval ordering uses only the three common channels. Restricted continua remain separate.
  return {id:p.id,name:p.name,label:p.profile_label,period:p.period,W,R,P,M,rankingIndex:(W.adjusted+P.adjusted+M.adjusted)/3}
}

export function rankPhilosophers(user:UserScores,profiles:PhilosopherProfile[]){
  return sensitivityRank(profiles.map(p=>matchPhilosopher(user,p)))
}

function intervalSim(u:number,i:TraditionInterval){
  if(!i.core_range)return null
  const [l,h]=i.core_range
  if(u>=l&&u<=h)return 100
  return Math.max(0,100-(u<l?l-u:u-h))
}
function specificity(breadth:number|null|undefined){return Math.max(.20,1-(breadth??100)/120)}

function matchTradContinuous(user:UserScores,shape:TraditionProfileShape,layer:'W'|'R',prior:number,thinCutoff:number){
  let n=0,d=0,en=0,ed=0,c=0
  for(const [cid,us] of Object.entries(user.continuous)){
    if(us.score===null||us.status==='INSUFFICIENT') continue
    const map=CONTINUUM_PROFILE_KEYS[cid]
    if(!map||map.layer!==layer) continue
    const uf=statusFactor(us.status)
    ed+=uf
    const ti=shape[layer][map.key]
    if(!ti||ti.status==='NA'||ti.status==='UNKNOWN'||!ti.core_range) continue
    const sim=intervalSim(us.score,ti)
    if(sim===null)continue
    const w=uf*(ti.confidence??.5)
    n+=w*sim; d+=w; en+=w*specificity(ti.breadth); c++
  }
  return finalize(n,d,en,ed,prior,c,thinCutoff)
}

function matchTradShape(user:UserScores,shape:TraditionProfileShape){
  const W=matchTradContinuous(user,shape,'W',TRAD_PRIORS.W,3)
  const R=matchTradContinuous(user,shape,'R',TRAD_PRIORS.R,2)

  let pn=0,pd=0,pen=0,ped=0,pc=0
  for(const [cid,us] of Object.entries(user.categorical)){
    const key=CATEGORY_PROFILE_KEYS[cid]
    if(!key||!us.comparisonReady) continue
    let uf=1
    for(const uv of Object.values(us.categories)) if(uv.score!==null&&uv.status!=='INSUFFICIENT') uf=Math.min(uf,statusFactor(uv.status))
    ped+=uf
    const tp=shape.P[key]
    if(!tp||tp.status==='NA'||tp.status==='UNKNOWN'||!tp.categories) continue
    const sims:number[]=[]; const qs:number[]=[]
    for(const [cat,uv] of Object.entries(us.categories)){
      const ti=tp.categories[cat]
      if(!ti||uv.score===null||uv.status==='INSUFFICIENT') continue
      const [l,h]=ti.core_range
      const sim=uv.score>=l&&uv.score<=h?100:Math.max(0,100-(uv.score<l?l-uv.score:uv.score-h))
      sims.push(sim); qs.push(specificity(ti.breadth))
    }
    if(!sims.length)continue
    const w=(tp.confidence??.5)*uf
    pn+=w*(sims.reduce((a,b)=>a+b,0)/sims.length); pd+=w
    pen+=w*(qs.reduce((a,b)=>a+b,0)/qs.length); pc++
  }
  const P=finalize(pn,pd,pen,ped,TRAD_PRIORS.P,pc,2)

  let mn=0,md=0,men=0,med=0,mc=0
  for(const [method,us] of Object.entries(user.methods)){
    if(us.score===null||us.status==='INSUFFICIENT') continue
    const uf=statusFactor(us.status)
    med+=uf
    const ti=shape.M[method]
    if(!ti||ti.status==='NA'||ti.status==='UNKNOWN'||!ti.core_range) continue
    const sim=intervalSim(us.score,ti)
    if(sim===null)continue
    const w=uf*(ti.confidence??.5)
    mn+=w*sim; md+=w; men+=w*specificity(ti.breadth); mc++
  }
  const M=finalize(mn,md,men,med,TRAD_PRIORS.M,mc,6)
  return {W,R,P,M,ranking:(W.adjusted+P.adjusted+M.adjusted)/3}
}

export function matchTradition(user:UserScores,t:Tradition):TraditionMatch{
  const common=matchTradShape(user,t)
  let closestStrand:string|undefined
  if(t.structure==='MULTISTRAND'&&t.strands?.length){
    const strandScores=t.strands.map(s=>({name:s.name,match:matchTradShape(user,s)})).sort((a,b)=>b.match.ranking-a.match.ranking)
    if(strandScores[0])closestStrand=strandScores[0].name
  }
  return {id:t.id,name:t.name,family:t.family,scopeNote:t.scope_note,W:common.W,R:common.R,P:common.P,M:common.M,rankingIndex:common.ranking,closestStrand,breadth:t.breadth_summary.mean_interval_width}
}

export function rankTraditions(user:UserScores,traditions:Tradition[]){
  return sensitivityRank(traditions.map(t=>matchTradition(user,t)))
}
