import { describe, expect, it } from 'vitest'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

function read(stem:string,count:number){
  const b64=Array.from({length:count},(_,i)=>readFileSync(`public/data/runtime/${stem}-${String(i).padStart(2,'0')}.b64`,'utf8')).join('')
  return JSON.parse(gunzipSync(Buffer.from(b64,'base64')).toString('utf8'))
}

describe('frozen runtime data plumbing',()=>{
  it('ships Questionnaire v0.2 with the frozen nested form counts',()=>{
    const q=read('questionnaire-v2',8)
    expect(q.items).toHaveLength(291)
    expect(q.questionnaire_version).toContain('0.2')
    for(const [form,count] of Object.entries({QUICK:46,STANDARD:107,COMPLETE:201,ADVANCED:291})){
      const key=`${form.toLowerCase()}_core`
      expect(q.items.filter((x:any)=>x[key]).length).toBe(count)
      expect(q.forms[form].core_item_count).toBe(count)
    }
    expect(new Set(q.items.map((x:any)=>x.item_id)).size).toBe(291)
  })
  it('ships 100 unique philosopher profiles',()=>{
    const p=read('philosophers-v2',8)
    expect(p.profiles).toHaveLength(100)
    expect(new Set(p.profiles.map((x:any)=>x.id)).size).toBe(100)
  })
  it('ships 46 tradition profiles including seven multistrand structures',()=>{
    const t=read('traditions-v2',10)
    expect(t.traditions).toHaveLength(46)
    expect(new Set(t.traditions.map((x:any)=>x.id)).size).toBe(46)
    expect(t.traditions.filter((x:any)=>x.structure==='MULTISTRAND')).toHaveLength(7)
  })
})