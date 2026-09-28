import { describe, expect, it } from 'vitest'
import { matchPhilosopher, matchTradition, sensitivityRank } from '../src/matcher'
import type { PhilosopherProfile, Tradition, UserScores } from '../src/types'

const user:UserScores={
  continuous:{
    W_MORAL_OBJECTIVITY:{kind:'continuous',constructId:'W_MORAL_OBJECTIVITY',name:'',score:90,status:'SCORABLE',answered:4,administered:4,highPole:'',lowPole:'',highLabel:'',lowLabel:''},
    R_MENTAL_PHYSICALISM:{kind:'continuous',constructId:'R_MENTAL_PHYSICALISM',name:'',score:90,status:'SCORABLE',answered:4,administered:4,highPole:'',lowPole:'',highLabel:'',lowLabel:''}
  },
  categorical:{},
  methods:{}
}

const profile=(wStatus:'SETTLED'|'UNKNOWN',wScore:number|null,rScore:number|null):PhilosopherProfile=>({
  id:'x',name:'X',profile_label:'X',period:'',
  W:{
    moral_objectivity:{status:wStatus,central_estimate:wScore,confidence:1},
    relational_self:{status:'UNKNOWN',central_estimate:null,confidence:.5},
    moral_generalism:{status:'UNKNOWN',central_estimate:null,confidence:.5},
    substance_process:{status:'UNKNOWN',central_estimate:null,confidence:.5},
    experience_apriori:{status:'UNKNOWN',central_estimate:null,confidence:.5},
    aesthetic_response:{status:'UNKNOWN',central_estimate:null,confidence:.5}
  },
  R:{mental_physicalism:{status:rScore===null?'UNKNOWN':'SETTLED',central_estimate:rScore,confidence:1}},
  P:{},M:{}
} as unknown as PhilosopherProfile)

describe('matcher missingness and channel separation',()=>{
  it('excludes unknown rather than treating it as neutral',()=>{
    expect(matchPhilosopher(user,profile('UNKNOWN',null,null)).W.raw).toBeNull()
  })

  it('computes broad and restricted similarity as separate channels',()=>{
    const m=matchPhilosopher(user,profile('SETTLED',80,0))
    expect(m.W.raw).toBe(90)
    expect(m.R.raw).toBe(10)
    expect(m.W.compared).toBe(1)
    expect(m.R.compared).toBe(1)
  })

  it('does not let restricted continua change the common retrieval ordering index',()=>{
    const nearR=matchPhilosopher(user,profile('SETTLED',80,90))
    const farR=matchPhilosopher(user,profile('SETTLED',80,0))
    expect(nearR.R.raw).toBe(100)
    expect(farR.R.raw).toBe(10)
    expect(nearR.rankingIndex).toBe(farR.rankingIndex)
  })
})


describe('categorical vector matching',()=>{
  const categoricalUser:UserScores={
    continuous:{},
    methods:{},
    categorical:{
      P_NORMATIVE_ETHICS:{
        kind:'categorical',constructId:'P_NORMATIVE_ETHICS',name:'Normative ethics',comparisonReady:true,answered:6,administered:6,
        categories:{
          A:{score:20,status:'SCORABLE',answered:2,administered:2},
          B:{score:50,status:'SCORABLE',answered:2,administered:2},
          C:{score:80,status:'SCORABLE',answered:2,administered:2}
        }
      }
    }
  }
  const categoricalProfile=(affinities:Record<string,number>):PhilosopherProfile=>({
    id:'p',name:'P',profile_label:'P',period:'',
    W:{},R:{},M:{},
    P:{normative_ethics:{status:'SETTLED',affinities,confidence:1}}
  } as unknown as PhilosopherProfile)

  it('is invariant to a common level shift because domains are mean-centered',()=>{
    const m=matchPhilosopher(categoricalUser,categoricalProfile({A:40,B:70,C:100}))
    expect(m.P.raw).toBeCloseTo(100,8)
  })

  it('treats a flat philosopher vector as unavailable',()=>{
    const m=matchPhilosopher(categoricalUser,categoricalProfile({A:70,B:70,C:70}))
    expect(m.P.raw).toBeNull()
    expect(m.P.compared).toBe(0)
  })
})


describe('retrieval sensitivity ordering',()=>{
  const c=(adjusted:number)=>({raw:adjusted,adjusted,evidence:1,compared:4,thin:false})
  it('prefers a match that stays strong across plausible W/P/M weightings',()=>{
    const ranked=sensitivityRank([
      {id:'W-specialist',W:c(100),P:c(40),M:c(40),rankingIndex:0},
      {id:'P-specialist',W:c(40),P:c(100),M:c(40),rankingIndex:0},
      {id:'M-specialist',W:c(40),P:c(40),M:c(100),rankingIndex:0},
      {id:'balanced',W:c(75),P:c(75),M:c(75),rankingIndex:0}
    ])
    expect(ranked[0].id).toBe('balanced')
  })

  it('keeps exact ties tied rather than inventing an input-order advantage',()=>{
    const ranked=sensitivityRank([
      {id:'b',W:c(60),P:c(60),M:c(60),rankingIndex:0},
      {id:'a',W:c(60),P:c(60),M:c(60),rankingIndex:0}
    ])
    expect(ranked[0].rankingIndex).toBe(ranked[1].rankingIndex)
  })
})


describe('multistrand sensitivity selection',()=>{
  const interval=(score:number)=>({status:'SETTLED' as const,center:score,core_range:[score,score] as [number,number],breadth:0,confidence:1})
  it('uses sensitivity-tested common channels to select the closest strand',()=>{
    const u:UserScores={
      continuous:{
        W_MORAL_OBJECTIVITY:{kind:'continuous',constructId:'W_MORAL_OBJECTIVITY',name:'',score:100,status:'SCORABLE',answered:4,administered:4,highPole:'',lowPole:'',highLabel:'',lowLabel:''}
      },
      categorical:{},
      methods:{
        TEST_METHOD:{method:'TEST_METHOD',score:100,status:'SCORABLE',answered:4,administered:4}
      }
    }
    const t={
      id:'T',name:'T',family:'test',scope_note:'',structure:'MULTISTRAND',
      W:{moral_objectivity:interval(75)},R:{},P:{},M:{TEST_METHOD:interval(75)},
      strands:[
        {id:'specialist',name:'Single-channel specialist',members:[],W:{moral_objectivity:interval(100)},R:{},P:{},M:{TEST_METHOD:interval(40)}},
        {id:'balanced',name:'Balanced strand',members:[],W:{moral_objectivity:interval(75)},R:{},P:{},M:{TEST_METHOD:interval(75)}}
      ],
      breadth_summary:{mean_interval_width:0,scored_interval_count:2}
    } as unknown as Tradition
    expect(matchTradition(u,t).closestStrand).toBe('Balanced strand')
  })
})
