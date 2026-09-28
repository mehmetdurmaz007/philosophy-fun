import { describe, expect, it } from 'vitest'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

function read(stem:string,count:number){
  const b64=Array.from({length:count},(_,i)=>readFileSync(`public/data/runtime/${stem}-${String(i).padStart(2,'0')}.b64`,'utf8')).join('')
  return JSON.parse(gunzipSync(Buffer.from(b64,'base64')).toString('utf8'))
}
describe('frozen runtime data plumbing',()=>{
  it('ships questionnaire v0.2 with 291 items',()=>{const q=read('questionnaire',4);expect(q.items).toHaveLength(291);expect(q.questionnaire_version).toContain('0.2')})
  it('ships 100 philosopher profiles',()=>{const p=read('philosophers',3);expect(p.profiles).toHaveLength(100)})
  it('ships 46 tradition profiles including multistrand structures',()=>{const t=read('traditions',4);expect(t.traditions).toHaveLength(46);expect(t.traditions.some((x:any)=>x.structure==='MULTISTRAND')).toBe(true)})
})
