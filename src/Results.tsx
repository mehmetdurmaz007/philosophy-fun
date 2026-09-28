import type { CategoricalScore, FormId, UserScores } from './types'
import { rankPhilosophers, rankTraditions } from './matcher'

const fmt=(x:number|null)=>x===null?'—':Math.round(x).toString()
const pretty=(x:string)=>x.replaceAll('_',' ').toLowerCase()

function Meter({value}:{value:number|null}){return <div className="meter"><i style={{width:`${value??0}%`}}/></div>}
function badge(status:string){return <span className={`status ${status.toLowerCase()}`}>{status}</span>}

function strongAffinities(domain:CategoricalScore){
  if(!domain.comparisonReady)return []
  const scored=Object.entries(domain.categories).filter(([,v])=>v.score!==null&&v.status!=='INSUFFICIENT') as [string,{score:number;status:string;answered:number;administered:number}][]
  if(!scored.length)return []
  const max=Math.max(...scored.map(([,v])=>v.score))
  if(max<60)return []
  return scored.filter(([,v])=>v.score>=60&&max-v.score<=10).map(([k])=>pretty(k))
}

export default function Results({scores,philosopherMatches,traditionMatches,form,answered,total,onBack,onReset}:{scores:UserScores;philosopherMatches:ReturnType<typeof rankPhilosophers>;traditionMatches:ReturnType<typeof rankTraditions>;form:FormId;answered:number;total:number;onBack:()=>void;onReset:()=>void}){
  const broad=Object.values(scores.continuous).filter(s=>s.constructId.startsWith('W_'))
  const restricted=Object.values(scores.continuous).filter(s=>s.constructId.startsWith('R_'))
  const cats=Object.values(scores.categorical)
  const methods=Object.values(scores.methods)
  const hasPhilosopherEvidence=philosopherMatches.some(m=>m.W.compared+m.P.compared+m.M.compared>0)
  const hasTraditionEvidence=traditionMatches.some(m=>m.W.compared+m.P.compared+m.M.compared>0)
  return <main className="results-shell">
    <header className="results-header"><div><div className="eyebrow">{form} RESULTS · {answered}/{total} responses recorded</div><h1>Your philosophy map</h1><p>No overall match percentage is shown. Broad worldview, restricted continua, positions, and method remain separate.</p></div><div className="actions"><button onClick={onBack}>Return to questions</button><button onClick={()=>window.print()}>Print</button><button className="danger" onClick={onReset}>Start over</button></div></header>
    {form==='QUICK'&&<div className="notice">Quick matches are provisional: this form measures broad worldview + methods and does not administer categorical position domains.</div>}
    <section className="results-grid">
      <article className="result-card span2"><h2>Broad worldview continua</h2><div className="axis-list">{broad.map(s=><div className="axis" key={s.constructId}><div className="axis-row"><strong>{s.name}</strong><span>{fmt(s.score)} {badge(s.status)}</span></div><Meter value={s.score}/><div className="poles"><span>{s.lowLabel}</span><span>{s.highLabel}</span></div><small>{s.answered}/{s.administered} answered</small></div>)}</div></article>
      {restricted.length>0&&<article className="result-card span2"><h2>Restricted continua</h2><p className="muted">These dimensions are reported separately and do not enter the common worldview comparison.</p><div className="axis-list">{restricted.map(s=><div className="axis" key={s.constructId}><div className="axis-row"><strong>{s.name}</strong><span>{fmt(s.score)} {badge(s.status)}</span></div><Meter value={s.score}/><div className="poles"><span>{s.lowLabel}</span><span>{s.highLabel}</span></div><small>{s.answered}/{s.administered} answered</small></div>)}</div></article>}
      <article className="result-card"><h2>Methods</h2>{methods.map(m=><div className="mini" key={m.method}><div><span>{pretty(m.method)}</span><b>{fmt(m.score)}</b></div><Meter value={m.score}/><small>{m.answered}/{m.administered} answered · {m.status.toLowerCase()}</small></div>)}</article>
      <article className="result-card"><h2>Positions</h2>{cats.length===0?<p className="muted">Not administered on Quick.</p>:cats.map(d=>{const affinities=strongAffinities(d);return <div className="domain" key={d.constructId}><div className="domain-heading"><h3>{d.name}</h3>{d.comparisonReady?badge('SCORABLE'):<span className="status provisional">INCOMPLETE</span>}</div>{Object.entries(d.categories).map(([k,v])=><div className="mini" key={k}><div><span>{pretty(k)}</span><b>{fmt(v.score)}</b></div><Meter value={v.score}/></div>)}{d.comparisonReady?<p className="affinity-note">{affinities.length?<>Strong affinities: <strong>{affinities.join(', ')}</strong></>:<>No strong affinity reaches the pre-pilot threshold.</>}</p>:<p className="affinity-note muted">Complete enough of every category before interpreting leading affinities.</p>}</div>})}</article>
      <article className="result-card span2"><div className="card-heading"><div><h2>Closest philosophers</h2><p>Ordered by an evidence-adjusted retrieval index using broad worldview, positions, and methods. Restricted continua are shown separately and do not affect this ordering.</p></div></div>{hasPhilosopherEvidence?<div className="match-list">{philosopherMatches.map((m,i)=><MatchRow key={m.id} n={i+1} title={m.label} subtitle={m.period} W={m.W} R={m.R} P={m.P} M={m.M}/>)}</div>:<p className="empty-match">Not enough comparable evidence yet. Answer some worldview or method items before interpreting philosopher matches.</p>}</article>
      <article className="result-card span2"><div className="card-heading"><div><h2>Closest traditions</h2><p>Traditions are ranges, not single points. Broad traditions supply less ranking evidence than specific ones; restricted continua remain a separate channel.</p></div></div>{hasTraditionEvidence?<div className="match-list">{traditionMatches.map((m,i)=><MatchRow key={m.id} n={i+1} title={m.name} subtitle={`${m.family}${m.closestStrand?` · closest strand: ${m.closestStrand}`:''}`} W={m.W} R={m.R} P={m.P} M={m.M}/>)}</div>:<p className="empty-match">Not enough comparable evidence yet. Answer some worldview or method items before interpreting tradition matches.</p>}</article>
    </section>
    <footer className="fineprint">Alpha caveat: philosopher and tradition profiles are source-grounded but not expert-validated, and the questionnaire has not yet been psychometrically calibrated. Coverage and fit are intentionally shown as distinct concepts.</footer>
  </main>
}

function MatchRow({n,title,subtitle,W,R,P,M}:{key?:string;n:number;title:string;subtitle:string;W:{raw:number|null;compared:number;thin:boolean};R:{raw:number|null;compared:number;thin:boolean};P:{raw:number|null;compared:number;thin:boolean};M:{raw:number|null;compared:number;thin:boolean}}){
  const cell=(name:string,c:{raw:number|null;compared:number;thin:boolean},noun:string)=><div className={`match-cell ${c.thin?'thin':''}`}><span>{name}</span><b>{c.raw===null?'—':Math.round(c.raw)}</b><small>{c.compared} {noun} compared{c.thin?' · thin':''}</small></div>
  return <div className="match-row"><div className="rank">{n}</div><div className="match-title"><strong>{title}</strong><small>{subtitle}</small></div>{cell('Broad worldview',W,'broad')}{cell('Restricted',R,'restricted')}{cell('Positions',P,'domains')}{cell('Methods',M,'methods')}</div>
}
