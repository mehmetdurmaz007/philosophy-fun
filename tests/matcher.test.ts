import { describe, expect, it } from 'vitest'
import { matchPhilosopher } from '../src/matcher'
import type { PhilosopherProfile, UserScores } from '../src/types'
const user:UserScores={continuous:{W_MORAL_OBJECTIVITY:{kind:'continuous',constructId:'W_MORAL_OBJECTIVITY',name:'',score:90,status:'SCORABLE',answered:4,administered:4,highPole:'',lowPole:'',highLabel:'',lowLabel:''}},categorical:{},methods:{}}
const mk=(status:'SETTLED'|'UNKNOWN',score:number|null):PhilosopherProfile=>({id:'x',name:'X',profile_label:'X',period:'',W:{moral_objectivity:{status,central_estimate:score,confidence:1},relational_self:{status:'UNKNOWN',central_estimate:null,confidence:.5},moral_generalism:{status:'UNKNOWN',central_estimate:null,confidence:.5},substance_process:{status:'UNKNOWN',central_estimate:null,confidence:.5},experience_apriori:{status:'UNKNOWN',central_estimate:null,confidence:.5},aesthetic_response:{status:'UNKNOWN',central_estimate:null,confidence:.5}},R:{},P:{},M:{}} as unknown as PhilosopherProfile)
describe('matcher missingness',()=>{
  it('excludes unknown rather than treating it as neutral',()=>{expect(matchPhilosopher(user,mk('UNKNOWN',null)).W.raw).toBeNull()})
  it('computes raw similarity on comparable dimensions',()=>{expect(matchPhilosopher(user,mk('SETTLED',80)).W.raw).toBe(90)})
})
