import { useEffect, useMemo, useState } from 'react'
import type { AnswerRecord, FormId, PhilosopherData, QuestionnaireData, QuestionnaireItem, SessionState, TraditionData } from './types'
import { loadAppData } from './data'
import { interleavedOrder } from './order'
import { scoreSession } from './scoring'
import { rankPhilosophers, rankTraditions } from './matcher'
import { clearSession, loadSession, saveSession } from './storage'
import Results from './Results'
import { FORM_ORDER, availableItems, formRank } from './forms'
import './styles.css'

const AGREE_OPTIONS=[['Strongly disagree',0],['Disagree',25],['Neither agree nor disagree',50],['Agree',75],['Strongly agree',100]] as const
const METHOD_OPTIONS=[['Not useful',0],['Occasionally useful',25],['Important',50],['Very important',75],['Indispensable',100]] as const
function responseOptions(item:QuestionnaireItem){return item.layer==='method_profile'?METHOD_OPTIONS:AGREE_OPTIONS}

export default function App(){
  const [data,setData]=useState<{questionnaire:QuestionnaireData;philosophers:PhilosopherData;traditions:TraditionData}|null>(null)
  const [error,setError]=useState<string>('')
  const [session,setSession]=useState<SessionState|null>(null)
  const [view,setView]=useState<'home'|'quiz'|'results'>('home')

  useEffect(()=>{loadAppData().then(d=>{setData(d); const s=loadSession(); if(s)setSession(s)}).catch(e=>setError(String(e)))},[])
  useEffect(()=>{if(session)saveSession(session)},[session])

  const items=useMemo(()=>{
    if(!data||!session)return []
    const map=new Map(availableItems(data.questionnaire,session.form,session.modules).map(i=>[i.item_id,i]))
    return session.order.map(id=>map.get(id)).filter(Boolean) as QuestionnaireItem[]
  },[data,session])
  const current=session&&items[session.cursor]

  function begin(form:FormId){
    if(!data)return
    const defaultModules=Object.entries(data.questionnaire.optional_modules).filter(([,m])=>m.default_in.includes(form)).map(([id])=>id)
    const seed=`${Date.now()}-${Math.random().toString(36).slice(2)}`
    const chosen=availableItems(data.questionnaire,form,defaultModules)
    const next:SessionState={version:2,form,modules:defaultModules,skippedModules:[],seed,order:interleavedOrder(chosen,seed),cursor:0,answers:{},startedAt:new Date().toISOString()}
    setSession(next); setView('quiz')
  }
  function setModules(form:FormId,modules:string[],skippedModules:string[]){
    if(!data)return
    const sameForm=session?.form===form
    const seed=sameForm&&session?session.seed:`${Date.now()}-${Math.random().toString(36).slice(2)}`
    const chosen=availableItems(data.questionnaire,form,modules)
    const preserved=session?.answers??{}
    const order=interleavedOrder(chosen,seed)
    const firstUnanswered=order.findIndex(id=>!preserved[id])
    setSession({
      version:2,form,modules,skippedModules,seed,order,
      cursor:firstUnanswered>=0?firstUnanswered:Math.max(0,order.length-1),
      answers:preserved,
      startedAt:sameForm&&session?session.startedAt:new Date().toISOString()
    })
  }
  function answer(value:number|null,missing:'ANSWERED'|'USER_UNSURE'){
    if(!session||!current)return
    const rec:AnswerRecord={itemId:current.item_id,value,missing,answeredAt:new Date().toISOString()}
    setSession({...session,answers:{...session.answers,[current.item_id]:rec},cursor:Math.min(session.cursor+1,items.length-1)})
  }
  function skip(){
    if(!session||!current)return
    const rec:AnswerRecord={itemId:current.item_id,value:null,missing:'NO_RESPONSE',answeredAt:new Date().toISOString()}
    setSession({...session,answers:{...session.answers,[current.item_id]:rec},cursor:Math.min(session.cursor+1,items.length-1)})
  }
  function finish(){setView('results')}
  function reset(){clearSession();setSession(null);setView('home')}
  if(error)return <main className="shell"><div className="panel"><h1>Could not load the alpha</h1><p>{error}</p></div></main>
  if(!data)return <main className="shell"><div className="panel"><p>Loading the philosophy map…</p></div></main>

  if(view==='home'){
    const resume=session&&Object.keys(session.answers).length>0
    return <main className="shell">
      <header className="hero"><div className="eyebrow">PRE-PILOT ALPHA · QUESTIONNAIRE v0.2</div><h1>Philosophy Fun</h1><p className="lede">Map your philosophical worldview across independent dimensions, then compare it with philosophers and traditions without collapsing everything into one ideology score.</p></header>
      {resume&&<section className="resume panel"><div><strong>Resume {session.form.toLowerCase()} form</strong><p>{Object.keys(session.answers).length} responses saved locally.</p></div><button className="primary" onClick={()=>setView('quiz')}>Resume</button></section>}
      <section className="form-grid">{FORM_ORDER.map(form=>{const f=data.questionnaire.forms[form];return <article className="form-card" key={form}><div className="form-top"><span>{form}</span><strong>{f.core_item_count}</strong></div><h2>{form==='QUICK'?'Fast map':form==='STANDARD'?'Main test':form==='COMPLETE'?'Full core':'Everything'}</h2><p>{f.purpose}</p><small>{f.estimated_scope}</small><button className="primary" onClick={()=>begin(form)}>Start {form.toLowerCase()}</button></article>})}</section>
      <p className="fineprint">Scores are pre-pilot research estimates, not psychometric diagnoses. Missing or inapplicable dimensions are never treated as disagreement.</p>
    </main>
  }

  if(view==='quiz'&&session&&current){
    const answered=items.filter(i=>Boolean(session.answers[i.item_id])).length
    const progress=items.length?Math.round((answered/items.length)*100):0
    const optionalEntries=Object.entries(data.questionnaire.optional_modules).filter(([,m])=>formRank(session.form)>=formRank(m.available_from))
    return <main className="quiz-shell">
      <header className="quiz-header"><button className="ghost" onClick={()=>setView('home')}>← Home</button><div className="progress-wrap"><div className="progress-copy"><span>{session.form}</span><span>{answered}/{items.length} · {progress}%</span></div><div className="progress"><i style={{width:`${progress}%`}}/></div></div><button className="ghost" onClick={finish}>Results</button></header>
      <section className="question-panel">
        <div className="question-meta"><span>{current.construct_name}</span><span>{current.facet}</span></div>
        <h1>{current.text}</h1>
        <div className="answers">{responseOptions(current).map(([label,value],idx)=><button key={label} className={session.answers[current.item_id]?.value===value?'selected':''} onClick={()=>answer(value,'ANSWERED')}><b>{idx+1}</b><span>{label}</span></button>)}</div>
        <div className="answer-tools"><button className="secondary" onClick={()=>answer(null,'USER_UNSURE')}>{current.layer==='method_profile'?'Insufficiently familiar':'Unsure / cannot judge'}</button><button className="ghost" onClick={skip}>Skip</button></div>
        <div className="nav"><button disabled={session.cursor===0} onClick={()=>setSession({...session,cursor:Math.max(0,session.cursor-1)})}>← Previous</button><span>Item {session.cursor+1} of {items.length}</span><button disabled={session.cursor>=items.length-1} onClick={()=>setSession({...session,cursor:Math.min(items.length-1,session.cursor+1)})}>Next →</button></div>
      </section>
      {optionalEntries.length>0&&<details className="modules"><summary>Specialist modules</summary><p>Modules are separate from the common worldview score. Skipping one is recorded separately; changing modules preserves stored answers and only changes what is currently administered.</p>{optionalEntries.map(([id,m])=><label key={id}><input type="checkbox" checked={session.modules.includes(id)} onChange={(e:{target:{checked:boolean}})=>{const enabled=e.target.checked; const mods=enabled?[...new Set([...session.modules,id])]:session.modules.filter(x=>x!==id); const skipped=enabled?session.skippedModules.filter(x=>x!==id):[...new Set([...session.skippedModules,id])]; setModules(session.form,mods,skipped)}}/><span><strong>{id.replace(/^[AR]_/, '').replaceAll('_',' ')}</strong><small>{m.item_count} items · {m.reason}{session.skippedModules.includes(id)?' · deliberately skipped':''}</small></span></label>)}</details>}
    </main>
  }

  if(view==='results'&&session){
    const administered=availableItems(data.questionnaire,session.form,session.modules)
    const scores=scoreSession(data.questionnaire,administered,session.answers,session.form)
    const philosophers=rankPhilosophers(scores,data.philosophers.profiles).slice(0,10)
    const traditions=rankTraditions(scores,data.traditions.traditions).slice(0,8)
    return <Results scores={scores} philosopherMatches={philosophers} traditionMatches={traditions} form={session.form} answered={administered.filter(i=>Boolean(session.answers[i.item_id])).length} total={administered.length} onBack={()=>setView('quiz')} onReset={reset}/>
  }
  return null
}
