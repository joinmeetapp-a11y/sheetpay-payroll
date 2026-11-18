/** Reviewed supporting facts, never a rate calculator. All monetary values are integer cents. */
export const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
export const FILING_VERSION='filing-packs-2026-11-18-v1';
export const FINAL_STATUSES=['completed','finalized','paid','approved'];
export type Week={weekStart:string;insurableEarningsCents:number;employeeCents:number;employerCents:number;category:string;exceptionReason?:string};
export type Supporting={surname:string;firstName:string;birthDate:string;employmentStart:string;employmentEnd:string;weeks:Week[]};
export function isDate(s:any){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
export function integerMoney(n:any){return Number.isSafeInteger(n)&&n>=0&&n<1e12;}
export function mondays(year:number,month:string){const m=MONTHS.indexOf(month);if(m<0)throw Error('Select a reporting month.');const result:string[]=[];for(let day=1;day<=31;day++){const date=new Date(Date.UTC(year,m,day));if(date.getUTCMonth()!==m)break;if(date.getUTCDay()===1)result.push(date.toISOString().slice(0,10));}return result;}
export function validateSupporting(value:any,year:number,month:string,row:any){
 if(!value||typeof value!=='object'||JSON.stringify(value).length>20000)throw Error('Supporting details are invalid or too large.');
 for(const k of ['surname','firstName'])if(typeof value[k]!=='string'||!value[k].trim()||value[k].length>120)throw Error('Enter the employee’s reviewed first name and surname.');
 if(!isDate(value.birthDate)||!isDate(value.employmentStart)||!(value.employmentEnd===''||isDate(value.employmentEnd))||value.birthDate>=value.employmentStart||value.employmentEnd&&value.employmentEnd<value.employmentStart)throw Error('Enter valid birth and employment dates; explicitly leave end date empty only for continuing employment.');
 if(!Array.isArray(value.weeks)||value.weeks.length>5||!value.weeks.length)throw Error('Enter 1–5 actual contribution weeks. Do not infer weeks from pay frequency.');
 const dates=mondays(year,month),seen=new Set();let employee=0,employer=0;
 for(const w of value.weeks){
  if(!dates.includes(w.weekStart)||seen.has(w.weekStart))throw Error('Contribution weeks must be unique Mondays in the reporting month. Split cross-month supporting records before filing.');seen.add(w.weekStart);
  if(!['insurableEarningsCents','employeeCents','employerCents'].every(k=>integerMoney(w[k]))||typeof w.category!=='string'||!w.category.trim()||w.category.length>100)throw Error('Enter the actual contribution class/category, weekly insurable earnings and both contribution amounts in integer cents. Unknown is not zero.');
  const weekEnd=new Date(Date.parse(w.weekStart+'T00:00:00Z')+6*86400000).toISOString().slice(0,10);
  if(weekEnd<value.employmentStart||value.employmentEnd&&w.weekStart>value.employmentEnd)throw Error('A contribution week falls outside the reviewed employment dates.');
  if((w.employeeCents===0&&w.employerCents===0)&&(!w.exceptionReason||typeof w.exceptionReason!=='string'))throw Error('A zero-contribution week needs a reviewed exception reason.');
  if(w.exceptionReason&&(w.exceptionReason.length>500||w.employeeCents!==0||w.employerCents!==0))throw Error('Exception weeks must have zero contributions and a specific reason.');
  employee+=w.employeeCents;employer+=w.employerCents;
 }
 if(employee!==Math.round(row.nis*100))throw Error('Weekly employee contributions do not reconcile to saved payroll deductions.');
 const savedEmployer=row.employerContribution??row.statutoryData?.employerContribution;
 if(savedEmployer!=null&&employer!==Math.round(savedEmployer*100))throw Error('Weekly employer contributions do not reconcile to the saved employer amount.');
 return {surname:value.surname.trim(),firstName:value.firstName.trim(),birthDate:value.birthDate,employmentStart:value.employmentStart,employmentEnd:value.employmentEnd,weeks:value.weeks.map((w:Week)=>({weekStart:w.weekStart,insurableEarningsCents:w.insurableEarningsCents,employeeCents:w.employeeCents,employerCents:w.employerCents,category:w.category,...(w.exceptionReason?{exceptionReason:w.exceptionReason}:{})}))};
}
export function stable(value:any):string {if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
/** Extend the existing aggregation once for the whole pack. No repeated year reads per form. */
export function extendFiling(report:any,runs:any[],support:any[],settlement:any){
 const month=report.month,country=report.business.country;report.filing={version:FILING_VERSION,settlement:settlement?.values||null,mondays:month?mondays(report.year,month):[]};
 const issues:any[]=[];const bad=(message:string,id='',code='SUPPORTING_DATA')=>issues.push({code,message,entity:'support',id});const seen=new Set();
 for(const e of report.employees){e.filing={weeks:[],support:[],dueCents:0};
  for(const run of runs.filter(r=>e.sourceRuns.includes(String(r._id)))){
   const row=run.employeesSnapshot.find((r:any)=>String(r._id)===e.id);const saved=support.find(s=>String(s.runId)===String(run._id)&&s.employeeId===e.id);const value=saved?.values||row?.filingSupport;
   if(!value||saved&&saved.runUpdatedAt!==run.updatedAt){bad(`${e.name}: review actual contribution weeks and employer amounts for ${run.periodLabel||run.month}`,e.id);continue;}
   try{const v=validateSupporting(value,report.year,run.month,row);e.filing.support.push({runId:String(run._id),...v});
    for(const w of v.weeks){const key=e.id+':'+w.weekStart;if(seen.has(key))bad(`${e.name}: duplicate contribution week ${w.weekStart} across payroll runs`,e.id,'DUPLICATE_WEEK');seen.add(key);e.filing.weeks.push(w);e.filing.dueCents+=w.employeeCents+w.employerCents;}
   }catch(error){bad(`${e.name}: ${(error as Error).message}`,e.id);}
  }
  // Different employment metadata must be resolved, never overwritten by latest input.
  const identities=e.filing.support.map((s:any)=>stable([s.surname,s.firstName,s.birthDate,s.employmentStart,s.employmentEnd]));if(new Set(identities).size>1)bad(`${e.name}: supporting employment details differ across runs`,e.id);
  if(month&&e.filing.support.length){const v=e.filing.support[0];for(const date of mondays(report.year,month)){const end=new Date(Date.parse(date+'T00:00:00Z')+6*86400000).toISOString().slice(0,10);if(end>=v.employmentStart&&(!v.employmentEnd||date<=v.employmentEnd)&&!e.filing.weeks.some((w:Week)=>w.weekStart===date))bad(`${e.name}: contribution week ${date} is not accounted for; add actual contributions or a reviewed zero-contribution exception`,e.id);}}
  e.filing.weeks.sort((a:Week,b:Week)=>a.weekStart.localeCompare(b.weekStart));
 }
 const paymentIssues:any[]=[];const payment=report.filing.settlement;
 if(country==='TT'&&month){
  if(!payment||!['openingCents','penaltyCents','interestCents','paidCents'].every(k=>integerMoney(payment[k])))paymentIssues.push({code:'SETTLEMENT',entity:'settlement',id:'',message:'Review NI 187 opening balance, penalty, interest and actual amount paid. Explicit zero requires confirmation.'});
 }
 for(const f of report.forms){
  if(['ni184','ni187','fin15a','dp10','nis_schedule','c3'].includes(f.id)){
   // Contribution forms do not depend on annual TD4 classifications or employee tax IDs.
   f.issues=f.issues.filter((x:any)=>!(x.entity==='employee'&&x.code==='MISSING_DATA'));
   for(const e of report.employees)if(!/^\d{9}$/.test(e.contributionId))f.issues.push({code:'MISSING_DATA',message:`${e.name}: add the correct 9-digit contribution identifier (review country-specific identifier mapping)`,entity:'employee',id:e.id});
   f.issues.push(...issues);
   if(!report.business.phone)f.issues.push({code:'MISSING_DATA',entity:'business',id:report.business.id,message:'Add employer telephone number.'});
   if(f.id==='ni187')f.issues.push(...paymentIssues);
   if(['ni184','ni187'].includes(f.id)&&!/^\d{6}$/.test(report.business.nisNumber))f.issues.push({code:'MISSING_DATA',entity:'business',id:report.business.id,message:'Add the 6-digit NIBTT employer registration number.'});
   if(f.id==='ni184'&&!report.business.serviceCentreCode)f.issues.push({code:'MISSING_DATA',entity:'business',id:report.business.id,message:'Add employer NIBTT service centre code.'});
   if(f.id==='fin15a')f.issues.push({code:'SPECIFICATION',entity:'source',id:f.id,message:'The retrieved FIN15A embeds a contribution schedule effective April 2022. Current schedule applicability and paid-contribution/interest detail must be confirmed with SSB before official population is enabled. Use the contribution preparation report.'});
  }
  if(f.period==='monthly'&&!month)f.issues.push({code:'PERIOD',message:'Select a month for this form.',entity:'month',id:''});
  if(f.period==='annual'&&month)f.issues.push({code:'PERIOD',message:'Select full tax year for this annual form.',entity:'month',id:''});
  f.status=f.issues.length?(f.issues.some((x:any)=>['MISSING_DATA','SUPPORTING_DATA','SETTLEMENT'].includes(x.code))?'Missing Information':'Needs Review'):'Ready';
 }
 const relevant=report.forms.filter((f:any)=>f.official&&f.period===(month?'monthly':'annual'));
 report.filing.excluded=relevant.filter((f:any)=>f.issues.length).map((f:any)=>({id:f.id,name:f.name,reasons:f.issues.map((x:any)=>x.message)}));report.filing.included=relevant.filter((f:any)=>!f.issues.length).map((f:any)=>f.id);report.filing.complete=relevant.length>0&&!report.filing.excluded.length;report.filing.supportIssues=issues;return report;
}
