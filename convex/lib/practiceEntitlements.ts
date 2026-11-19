import { ConvexError } from 'convex/values';
import { accountantPlanFor } from '../usage';
import { usagePeriod } from '../../shared/accountantPlans';
import { PRACTICE_FREE_LIMITS, PRACTICE_LABELS, type PracticeUsageKind } from '../../shared/practicePlans';
export async function practicePlan(ctx:any,ownerId:any) {
 const owner=await ctx.db.get(ownerId);if(!owner)throw Error('Workspace unavailable.');
 return accountantPlanFor(owner);
}
export function practiceLimit(kind:string,message:string) { throw new ConvexError({code:'PLAN_LIMIT_REACHED',kind,message}); }
export async function practiceAllowance(ctx:any,ownerId:any,kind:PracticeUsageKind,consume=false,publicRequest=false) {
 if(await practicePlan(ctx,ownerId)!=='free')return;
 const period=usagePeriod(),row=await ctx.db.query('practiceUsage').withIndex('by_owner_period',(q:any)=>q.eq('ownerId',ownerId).eq('period',period)).first();
 const used=row?.counts[kind]||0,limit=PRACTICE_FREE_LIMITS[kind];
 if(used>=limit)practiceLimit(kind,publicRequest ? 'This practice has reached its monthly '+PRACTICE_LABELS[kind]+' allowance. Please contact the accountant directly.' : 'Free includes '+limit+' '+PRACTICE_LABELS[kind]+' per month. Upgrade to Monthly or Yearly to continue. Your saved work is still available.');
 if(consume){const counts={...(row?.counts||{}),[kind]:used+1};if(row)await ctx.db.patch(row._id,{counts});else await ctx.db.insert('practiceUsage',{ownerId,period,counts});}
}
