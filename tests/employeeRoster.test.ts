/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';
import schema from '../convex/schema';
const modules = import.meta.glob('../convex/**/*.{ts,js}');
async function fixture() {
 const t = convexTest(schema, modules);
 const ids = await t.run(async ctx => {
  const userId = await ctx.db.insert('users', {firebaseUid:'roster-owner',email:'owner@example.com',accountType:'accountant',plan:'accountant_monthly',planStatus:'active'});
  await ctx.db.insert('users', {firebaseUid:'other',email:'other@example.com',accountType:'accountant',plan:'free'});
  const businessId = await ctx.db.insert('businesses',{userId,name:'Test client',countryCode:'TT',currency:'TTD',currencySymbol:'$',updatedAt:Date.now()});
  const employeeId = await ctx.db.insert('employees',{businessId,userId,name:'Original',employeeId:'EMP-1',position:'Worker',department:'General',payFrequency:'monthly',basicPay:5000,frequencySalary:5000,overtimeHours:0,overtimeRate:0,bonus:0,commission:0,allowances:0,paye:0,nis:0,healthSurcharge:0,otherDeductions:0,grossPay:5000,netPay:5000,status:'active',localId:'roster-test',createdAt:Date.now()});
  return {userId,businessId,employeeId};
 });
 return {t,owner:t.withIdentity({subject:'roster-owner'}),...ids};
}
describe('Employee roster updates',()=>{
 it('edits contact details in place without changing pay or identity ownership',async()=>{
  const {t,owner,businessId,employeeId,userId}=await fixture();
  await owner.mutation(anyApi.employees.bulkUpdate,{businessId,updates:[{employeeId,fields:{name:'Updated Name',employeeId:'EMP-2',email:'updated@example.com',phone:'555-1234',address:'New address',position:'Foreman'}}]});
  expect(await t.run(ctx=>ctx.db.get(employeeId))).toMatchObject({name:'Updated Name',employeeId:'EMP-2',email:'updated@example.com',basicPay:5000,grossPay:5000,businessId,userId});
 });
 it('rejects invalid fields and unauthorized editing',async()=>{
  const {t,owner,businessId,employeeId}=await fixture();
  for(const fields of [{name:' '},{email:'bad email'},{phone:5},{name:'x'.repeat(121)},{userId:'other'}])await expect(owner.mutation(anyApi.employees.bulkUpdate,{businessId,updates:[{employeeId,fields}]})).rejects.toThrow();
  await expect(t.withIdentity({subject:'other'}).mutation(anyApi.employees.bulkUpdate,{businessId,updates:[{employeeId,fields:{name:'Wrong'}}]})).rejects.toThrow();
  await expect(t.mutation(anyApi.employees.bulkUpdate,{businessId,updates:[{employeeId,fields:{name:'Wrong'}}]})).rejects.toThrow();
  expect((await t.run(ctx=>ctx.db.get(employeeId)))?.name).toBe('Original');
 });
});
