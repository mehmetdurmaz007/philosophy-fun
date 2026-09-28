import type { FormId, UserScores } from './types'
import { rankPhilosophers, rankTraditions } from './matcher'

const fmt=(x:number|null)=>x===null?'—':Math.round(x).toString()

function Meter({value}:{value:number|null}){return <div className="meter"><i style={{width:`${value??0}%`}}/></div>}
function badge(status:string){return <span className={`status ${status.toLowerCase()}`}>{status}</span>}
export default function Results({scores,philosopherMatches,traditionMatches,form,answered,total,onBack,onReset}:{scores:UserScores;philosopherMatches:ReturnType<typeof rankPhilosophers>;traditionMatches:ReturnType<typeof rankTraditions>;form:FormId;answered:number;total:number;onBack:()=>void;onReset:()=>void}){
  const cont=Object.values(scores.continuous)
  const cats=Object.values(scores.categorical)
  const methods=Object.values(scores.methods)
  return <main className="results-shell">
    <header className="results-header"><div><div className="eyebrow">{form} RESULTS · {answered}/{total} answered</div><h1>Your philosophy map</h1><p>No overall match percentage is shown. Worldview, positions, and method are kept separate.</p></div><div className="actions"><button onClick={onBack}>Return to questions</button><button onClick={()=>window.print()}>Print</button><button className="danger" onClick={onReset}>Start over</button></div></header>
    {form==='QUICK'&&<div className="notice">Quick matches are provisional: this form measures broad worldview + methods and does not administer categorical position domains.</div>}
    <section className="results-grid">
      <article className="result-card span2"><h2>Worldview continua</h2><div className="axis-list">{cont.map(s=><div className="axis" key={s.constructId}><div className="axis-row"><strong>{s.name}</strong><span>{fmt(s.score)} {badge(s.status)}</span></div><Meter value={s.score}/><div className="poles"><span>{s.lowLabel}</span><span>{s.highLabel}</span></div><small>{s.answered}/{s.administered} answered</small></div>)}</div></article>
      <article className="result-card"><h2>Methods</h2>{methods.map(m=><div className="mini" key={m.method}><div><span>{m.method.replaceAll('_',' ').toLowerCase()}</span><b>{fmt(m.score)}</b></div><Meter value={m.score}/></div>)}</article>
      <article className="result-card"><h2>Positions</h2>{cats.length===0?<p className="muted">Not administered on Quick.</p>:cats.map(d=><div className="domain" key={d.constructId}><h3>{d.name}</h3>{Object.entries(d.categories).map(([k,v])=><div className="mini" key={k}><div><span>{k.replaceAll('_',' ').toLowerCase()}</span><b>{fmt(v.score)}</b></div><Meter value={v.score}/></div>)}</div>)}</article>
      <article className="result-card span2"><div className="card-heading"><div><h2>Closest philosophers</h2><p>Ordered by an evidence-adjusted retrieval index; the index itself is intentionally hidden.</p></div></div><div className="match-list">{philosopherMatches.map((m,i)=><MatchRow key={m.id} n={i+1} title={m.label} subtitle={m.period} W={m.W} P={m.P} M={m.M}/>)}</div></article>
      <article className="result-card span2"><div className="card-heading"><div><h2>Closest traditions</h2><p>Traditions are ranges, not single points. Broad traditions supply less ranking evidence than specific ones.</p></div></div><div className="match-list">{traditionMatches.map((m,i)=><MatchRow key={m.id} n={i+1} title={m.name} subtitle={`${m.family}${m.closestStrand?` · closest strand: ${m.closestStrand}`:''}`} W={m.W} P={m.P} M={m.M}/>)}</div></article>
    </section>
    <footer className="fineprint">Alpha caveat: philosopher and tradition profiles are source-grounded but not expert-validated, and the questionnaire has not yet been psychometrically calibrated.</footer>
  </main>
}
function MatchRow({n,title,subtitle,W,P,M}:{key?:string;n:number;title:string;subtitle:string;W:{raw:number|null;compared:number;thin:boolean};P:{raw:number|null;compared:number;thin:boolean};M:{raw:number|null;compared:number;thin:boolean}}){
  const cell=(name:string,c:{raw:number|null;compared:number;thin:boolean})=><div className={`match-cell ${c.thin?'thin':''}`}><span>{name}</span><b>{c.raw===null?'—':Math.round(c.raw)}</b><small>{c.compared} compared{c.thin?' · thin':''}</small></div>
  return <div className="match-row"><div className="rank">{n}</div><div className="match-title"><strong>{title}</strong><small>{subtitle}</small></div>{cell('Worldview',W)}{cell('Positions',P)}{cell('Methods',M)}</div>
}
