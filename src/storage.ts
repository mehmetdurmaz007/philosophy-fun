import type { SessionState } from './types'
const KEY='philosophy-fun-session-v1'
export function saveSession(s:SessionState){localStorage.setItem(KEY,JSON.stringify(s))}
export function loadSession():SessionState|null{try{const x=localStorage.getItem(KEY);return x?JSON.parse(x) as SessionState:null}catch{return null}}
export function clearSession(){localStorage.removeItem(KEY)}
