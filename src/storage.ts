import type { SessionState } from './types'

const KEY='philosophy-fun-session-v2'
const LEGACY_KEY='philosophy-fun-session-v1'

export function saveSession(s:SessionState){localStorage.setItem(KEY,JSON.stringify(s))}

export function loadSession():SessionState|null{
  try{
    const current=localStorage.getItem(KEY)
    if(current)return JSON.parse(current) as SessionState
    const legacy=localStorage.getItem(LEGACY_KEY)
    if(!legacy)return null
    const old=JSON.parse(legacy) as Omit<SessionState,'version'|'skippedModules'> & {version:1}
    return {...old,version:2,skippedModules:[]}
  }catch{return null}
}

export function clearSession(){
  localStorage.removeItem(KEY)
  localStorage.removeItem(LEGACY_KEY)
}
