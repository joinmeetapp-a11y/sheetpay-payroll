import { configuration, TT_FIELDS, BB_FIELDS, IT76_FIELDS } from './registry';
export const METRICS=['gross','paye','contribution','surcharge','other','net','basic','overtime','bonus','commissions','allowances','pension','employerContribution','taxableEarnings'] as const;
export type Totals=Record<typeof METRICS[number],number|null>;
const empty=():Totals=>Object.fromEntries(METRICS.map(k=>[k,['pension','employerContribution','taxableEarnings'].includes(k)?null:0])) as Totals;
export const cents=(v:any)=>typeof v==='number' && Number.isFinite(v) && Math.abs(v)<1e12 ? Math.round(v*100) : null;
const totalFields:Record<string,string>={gross:'totalGross',paye:'totalPaye',contribution:'totalNis',surcharge:'totalHealthSurcharge',net:'totalNet'};
const rowFields:Record<string,string>={gross:'grossPay',paye:'paye',contribution:'nis',surcharge:'healthSurcharge',other:'otherDeductions',net:'netPay',basic:'basicPay',bonus:'bonus',commissions:'commission',allowances:'allowances'};
const add=(a:Totals,b:Totals)=>{for(const k of METRICS) a[k]=a[k]===null||b[k]===null?null:a[k]!+b[k]!;};
export function aggregate(business:any, year:number, runs:any[], employees:any[], reviews:any[]=[], month?:string) {
 const config=configuration(business.countryCode || '',year);const issues:any[]=[];
 const issue=(code:string,message:string,entity='business',id=String(business._id))=>issues.push({code,message,entity,id});
 for(const field of ['name','address','taxRegistrationId','nisNumber']) if(!String(business[field]||'').trim()) issue('MISSING_DATA',`Client: missing ${field}`);
 const employeeById=new Map(employees.map(e=>[String(e._id),e]));const byEmployee=new Map<string,any>();const monthly=new Map<string,any>();const trace:any[]=[];
 const history=empty(),forms=empty(); for(const t of [history,forms]) for(const k of ['pension','employerContribution','taxableEarnings'] as const)t[k]=0;
 const included=runs.filter(r=>r.year===year && (!month || r.month===month));
 if(!included.length) issue('NO_PAYROLL','No payroll periods exist for this tax year.');
 for(const run of included){
  if(['void','voided','cancelled','canceled'].includes(run.status))continue;
  if(!['completed','finalized','paid'].includes(run.status)){issue('DRAFT_PAYROLL',`${run.periodLabel||run.month}: payroll is not finalized`,'payroll',String(run._id));continue;}
  if(!run.month || !run.employeesSnapshot?.length)issue('MISSING_DATA','Payroll period or employee snapshot is missing','payroll',String(run._id));
  if((run.countryCode && run.countryCode!==business.countryCode)||(run.currencyCode && run.currencyCode!==business.currency))issue('JURISDICTION','Payroll country/currency differs from the client. Review historical configuration.','payroll',String(run._id));
  trace.push({id:String(run._id),updatedAt:run.updatedAt,period:run.periodLabel||`${run.month} ${year}`,month:run.month,status:run.status,taxRuleVersion:run.taxRuleVersion||'Not recorded'});
  const runTotal=empty();for(const k of ['pension','employerContribution','taxableEarnings'] as const)runTotal[k]=0;
  const seen=new Set();
  for(const row of run.employeesSnapshot||[]){
   const id=String(row._id||'');if(!id || seen.has(id)){issue('EMPLOYEE_IDENTITY','Missing or duplicate employee reference','payroll',String(run._id));continue;}seen.add(id);
   const employee=employeeById.get(id);const ids=employee?.payrollIdentifiers||row.payrollIdentifiers||{};
   let record=byEmployee.get(id);if(!record){record={id,name:employee?.name||row.name||'',employeeId:employee?.employeeId??row.employeeId??'',address:employee?.address??row.address??'',taxId:ids.primaryId||ids.taxId||ids.birNumber||ids.tin||'',contributionId:ids.secondaryId||ids.nisNumber||ids.nicNumber||ids.socialSecurityNumber||'',totals:empty(),sourceRuns:[],periods:0};for(const k of ['pension','employerContribution','taxableEarnings'] as const)record.totals[k]=0;byEmployee.set(id,record);}
   const values=empty();for(const [k,field]of Object.entries(rowFields)){
    const n=cents(row[field]);values[k as keyof Totals]=n;
    if(n===null && ['gross','paye','contribution','surcharge','other','net'].includes(k)) issue('MISSING_STATUTORY',`${record.name}: missing/invalid ${field} in ${run.periodLabel||run.month}`,'payroll',String(run._id));
   }
   values.overtime=cents(typeof row.overtimePay==='number'?row.overtimePay:(row.overtimeHours??0)*(row.overtimeRate??0));
   for(const k of ['pension','employerContribution','taxableEarnings'] as const)values[k]=cents(row[k]??row.statutoryData?.[k]);
   if(values.gross!==null && values.net!==null && ['paye','contribution','surcharge','other'].every(k=>values[k as keyof Totals]!==null) && values.gross-values.paye!-values.contribution!-values.surcharge!-values.other! !== values.net)issue('RECONCILIATION',`${record.name}: earnings less deductions do not match net pay in ${run.periodLabel||run.month}`,'payroll',String(run._id));
   add(record.totals,values);add(runTotal,values);record.sourceRuns.push(String(run._id));record.periods++;
  }
  add(forms,runTotal);
  const stored={...runTotal};for(const[k,field]of Object.entries(totalFields)) {stored[k as keyof Totals]=cents(run[field]);if(stored[k as keyof Totals]!==runTotal[k as keyof Totals])issue('RECONCILIATION',`${run.periodLabel||run.month}: ${k} differs between saved payroll total and employee snapshots`,'payroll',String(run._id));}
  if(cents(run.totalDeductions)!== (runTotal.paye===null||runTotal.contribution===null||runTotal.surcharge===null||runTotal.other===null?null:runTotal.paye+runTotal.contribution+runTotal.surcharge+runTotal.other))issue('RECONCILIATION',`${run.periodLabel||run.month}: total deductions differ from employee snapshots`,'payroll',String(run._id));
  add(history,stored);
  let bucket=monthly.get(run.month);if(!bucket){bucket={month:run.month,periods:0,totals:empty()};for(const k of ['pension','employerContribution','taxableEarnings'] as const)bucket.totals[k]=0;monthly.set(run.month,bucket);}bucket.periods++;add(bucket.totals,runTotal);
 }
 if(!trace.length && included.length)issue('NO_PAYROLL','No finalized payroll exists for this period.');
 const records=[...byEmployee.values()].sort((a,b)=>a.name.localeCompare(b.name));
 for(const e of records){if(!e.name||!e.employeeId||!e.taxId||!e.contributionId||!e.address)issue('MISSING_DATA',`${e.name||'Employee'}: missing ${[!e.employeeId&&'employee ID',!e.taxId&&'tax ID',!e.contributionId&&'contribution number',!e.address&&'address'].filter(Boolean).join(', ')}`,'employee',e.id);}
 const reconciliation=METRICS.map(k=>({metric:k,history:history[k],forms:forms[k],difference:history[k]===null||forms[k]===null?null:forms[k]!-history[k]!}));
 const reconciled=!issues.some(i=>i.code==='RECONCILIATION'||i.code==='MISSING_STATUTORY');
 const specific:any[]=[];
 for(const form of config.forms){const formIssues=[...issues];if(form.blocked)formIssues.push({code:'SPECIFICATION',message:form.blocked,entity:'source',id:form.id});
  if(form.id==='td4'||form.id==='it76'){
   if(!/^PYE-.{8}$/.test(business.compliancePayeNumber||''))formIssues.push({code:'MISSING_DATA',message:'Employer PAYE number must be PYE- plus 8 characters',entity:'business',id:String(business._id)});
   if(!/^(\d{7}|\d{10})$/.test(business.taxRegistrationId||''))formIssues.push({code:'MISSING_DATA',message:'Employer BIR number must have 7 or 10 digits',entity:'business',id:String(business._id)});
   for(const e of records){const review=reviews.find(r=>r.employeeId===e.id && !r.month);e.review=review?.values||null;
    const addIssue=(m:string)=>formIssues.push({code:'REVIEW',message:`${e.name}: ${m}`,entity:'review',id:e.id});
    if(!/^(\d{7}|\d{10})$/.test(e.taxId)||/^(\d)\1+$/.test(e.taxId))addIssue('invalid BIR number');if(!/^\d{9}$/.test(e.contributionId))addIssue('NIS number must have 9 digits');
    if(!review || review.fingerprint!==fingerprint(trace)||!review.confirmed)addIssue('confirm annual TD4 classifications and Health Surcharge weeks against these payroll runs');
    else {const v=review.values;for(const[k]of TT_FIELDS)if(typeof v[k]!=='number'||!Number.isFinite(v[k])||v[k]<0)addIssue(`missing ${k}`);
     for(const k of ['weeksEmployed','healthWeeks','healthWeeks825','healthWeeks480'])if(!Number.isInteger(v[k])||v[k]>52)addIssue(`${k} must be an integer from 0 to 52`);
     if(v.weeksEmployed<1)addIssue('weeks employed must exceed zero');
     if(v.healthWeeks!==v.healthWeeks825+v.healthWeeks480 || cents(v.healthWeeks825*8.25+v.healthWeeks480*4.80)!==e.totals.surcharge)addIssue('Health Surcharge weeks do not reconcile to payroll');
     if(cents(v.remuneration+v.commissions+v.it76+v.travelAllowance+v.otherAllowance+v.previousIncome+v.savingsPlan)!==e.totals.gross)addIssue('TD4 classifications do not reconcile to gross payroll');
     if(v.it76>0){const b=v.benefits||{};if(!['Director','Employee'].includes(b.personType)||!['Yes','No'].includes(b.owned))addIssue('review IT76 employee/director and accommodation ownership');for(const[k,,type]of IT76_FIELDS)if(type==='number' && (typeof b[k]!=='number'||!Number.isFinite(b[k])||b[k]<0))addIssue(`review IT76 ${k}`);
      const sum=['Value of benefit in kind','Entertainment','Total b to e','Net Total','Club Subscriptions','Private Medical Dental etc treatment','Education of directors or employees family','Goods and Services','Work carried out','Employer contribution','Total a+b','Any other expense or benefit not included above'].reduce((n,k)=>n+(b[k]||0),0);if(cents(sum)!==cents(v.it76))addIssue('IT76 benefits must reconcile to TD4 taxable allowances');
     }
    }
   }
  }
  if(form.id==='tamis_paye'){
   if(!month)formIssues.push({code:'REVIEW',message:'Select one payroll month for the monthly TAMIS upload',entity:'month',id:''});
   if(!/^\d{13}$/.test(business.taxRegistrationId||''))formIssues.push({code:'MISSING_DATA',message:'Employer TAMIS TIN must have 13 digits',entity:'business',id:String(business._id)});
   for(const e of records){const r=reviews.find(r=>r.employeeId===e.id && r.month===month);e.monthlyReview=r?.values||null;const bad=(message:string)=>formIssues.push({code:'REVIEW',message:`${e.name}: ${message}`,entity:'review',id:e.id});if(!/^\d{13}$/.test(e.taxId))bad('TAMIS TIN must have 13 digits');
    if(!r||!r.confirmed||r.fingerprint!==fingerprint(trace))bad('review monthly TAMIS classifications, dates, tax code and pension');else {for(const[k]of BB_FIELDS){if(['taxCode','employmentStart','employmentEnd'].includes(k))continue;if(typeof r.values[k]!=='number'||!Number.isFinite(r.values[k])||r.values[k]<0)bad(`missing ${k}`);}if(!r.values.taxCode||!/^\d{4}-\d{2}-\d{2}$/.test(r.values.employmentStart))bad('missing tax code or employment start date');if(r.values.employmentEnd && (!/^\d{4}-\d{2}-\d{2}$/.test(r.values.employmentEnd)||r.values.employmentEnd<r.values.employmentStart))bad('invalid employment end date');if(cents(r.values.bonusShares)>e.totals.bonus)bad('bonus shares exceed payroll bonus');const benefits=['travel','entertainment','housing','vehicle','utilities','miscBenefits'].reduce((n,k)=>n+(r.values[k]||0),0);if(cents(benefits)!==e.totals.allowances)bad('taxable benefit categories do not reconcile to payroll allowances');if(cents(r.values.pension)>e.totals.other)bad('pension exceeds other payroll deductions');for(const key of ['employmentStart','employmentEnd'])if(r.values[key] && (!Number.isFinite(Date.parse(r.values[key]+'T00:00:00Z'))||new Date(r.values[key]+'T00:00:00Z').toISOString().slice(0,10)!==r.values[key]||r.values[key]<'2000-01-01'))bad('invalid '+key);}
   }
  }
  specific.push({...form,issues:formIssues,status:formIssues.length?(formIssues.some(i=>['MISSING_DATA','NO_PAYROLL','MISSING_STATUTORY'].includes(i.code))?'Missing Data':'Needs Review'):'Ready'});
 }
 return {business:{id:String(business._id),name:business.name,country:business.countryCode,currency:business.currency,address:business.address||'',taxRegistrationId:business.taxRegistrationId||'',nisNumber:business.nisNumber||'',payeNumber:business.compliancePayeNumber||''},config,year,month:month||'',employees:records,employeeCount:records.length,periodCount:trace.length,monthly:[...monthly.values()],trace,fingerprint:fingerprint(trace),history,totals:forms,reconciliation,reconciled,issues,forms:specific,status:issues.length?(issues.some(i=>i.code==='MISSING_DATA'||i.code==='NO_PAYROLL')?'Missing Data':'Needs Review'):'Ready',readiness:Math.round(100*(records.length+trace.length+4-Math.min(records.length+trace.length+4,issues.length))/(records.length+trace.length+4))};
}
export function fingerprint(trace:any[]){return JSON.stringify(trace.map(r=>[r.id,r.updatedAt]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));}
