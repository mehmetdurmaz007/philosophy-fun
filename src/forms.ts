import type { FormId, QuestionnaireData } from './types'

export const FORM_ORDER:FormId[]=['QUICK','STANDARD','COMPLETE','ADVANCED']

export const formRank=(form:FormId)=>FORM_ORDER.indexOf(form)

export function availableItems(q:QuestionnaireData,form:FormId,modules:string[]){
  const coreKey=`${form.toLowerCase()}_core` as 'quick_core'|'standard_core'|'complete_core'|'advanced_core'
  const optionalIds=new Set(Object.keys(q.optional_modules))
  const enabled=new Set(
    modules.filter(id=>{
      const module=q.optional_modules[id]
      return module && formRank(form)>=formRank(module.available_from)
    })
  )
  return q.items.filter(item=>enabled.has(item.construct_id)||(!optionalIds.has(item.construct_id)&&Boolean(item[coreKey])))
}
