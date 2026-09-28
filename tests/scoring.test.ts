import { describe, expect, it } from 'vitest'
import { scoreSession } from '../src/scoring'
import type { AnswerRecord, QuestionnaireData, QuestionnaireItem } from '../src/types'

const base=(id:string,key:string):QuestionnaireItem=>({item_id:id,construct_id:'W_MORAL_OBJECTIVITY',construct_name:'Moral objectivity',layer:'broad_continuum',text:id,key,category:'',method:'',facet:'',quick_core:true,standard_core:true,complete_core:true,advanced_core:true,optional_from:''})
const q={continuum_orientation:{W_MORAL_OBJECTIVITY:{high_label:'independent',high_pole:'INDEPENDENT',low_label:'dependent',low_pole:'DEPENDENT'}},optional_modules:{},forms:{} as never,items:[],questionnaire_version:'test'} as QuestionnaireData
const items=[base('a','INDEPENDENT'),base('b','INDEPENDENT'),base('c','DEPENDENT'),base('d','DEPENDENT')]
const rec=(id:string,value:number):AnswerRecord=>({itemId:id,value,missing:'ANSWERED',answeredAt:''})
describe('continuous scoring',()=>{
  it('reverse scores the low pole and preserves midpoint semantics',()=>{
    const answers={a:rec('a',100),b:rec('b',75),c:rec('c',0),d:rec('d',25)}
    const s=scoreSession(q,items,answers,'QUICK').continuous.W_MORAL_OBJECTIVITY
    expect(s.score).toBe(88)
    expect(s.status).toBe('SCORABLE')
  })
  it('does not turn unsure into 50',()=>{
    const answers={a:rec('a',50),b:{itemId:'b',value:null,missing:'USER_UNSURE',answeredAt:''} as AnswerRecord,c:rec('c',50)}
    const s=scoreSession(q,items,answers,'QUICK').continuous.W_MORAL_OBJECTIVITY
    expect(s.score).toBe(50)
    expect(s.answered).toBe(2)
    expect(s.status).toBe('PROVISIONAL')
  })
})
