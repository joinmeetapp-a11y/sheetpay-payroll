export const CAMPAIGN_ID = "accountant_free_7_day_v1";
export const FIRST_DELAY = 60 * 60 * 1000;
export const DAY_DELAY = 24 * 60 * 60 * 1000;
// Resend keys expire after 24h. Never retry an uncertain request past this shorter budget.
export const RETRY_BUDGET = 20 * 60 * 60 * 1000;
export const validEmail = (s: string) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const campaignFree = (u: {plan?: string} | null) => !!u && (!u.plan || u.plan === "free");
export const CAMPAIGN_COPY = [
 {subject:"Your next payroll doesn't need another spreadsheet", headline:"Payroll shouldn't eat up your day.", paragraphs:["Sheetpay helps you move from employee information to finished payslips without rebuilding the same spreadsheets every pay period.","Import your employees, calculate payroll and create professional payslips from one place.","Spend less time doing payroll admin and more time running your business."],cta:"Run Payroll in Sheetpay"},
 {subject:"Stop creating payslips one by one",headline:"One payroll. All your payslips.",paragraphs:["Managing multiple employees shouldn't mean repeating the same work over and over.","Sheetpay lets you prepare payroll, review employees and generate payslips in bulk.","For accountants, that means less repetitive work across every client."],cta:"Create Your Next Payroll"},
 {subject:"Still calculating deductions manually?",headline:"Let Sheetpay handle the repetitive calculations.",paragraphs:["Manual payroll calculations take time and small mistakes can create bigger problems later.","Sheetpay helps calculate supported statutory payroll deductions automatically, while keeping the payroll available for you to review before finalizing it.","You stay in control. Sheetpay removes the repetitive work."],cta:"Try Sheetpay Payroll"},
 {subject:"What if you could just ask for payroll?",headline:"Meet Cayla.",paragraphs:["Instead of clicking through endless payroll screens, tell Cayla what you need.","Use text, voice or supported payroll files to help prepare payroll faster.","You review the results before anything is finalized."],cta:"Try Cayla"},
 {subject:"Your clients shouldn't mean more admin",headline:"Built for accountants managing businesses.",paragraphs:["Keep payroll work organized across your clients without juggling separate spreadsheets and disconnected files.","Manage employees, payroll runs and payslips from the Sheetpay Accountant Dashboard.","As your client list grows, Sheetpay is designed to help the workload stay manageable."],cta:"Open Accountant Dashboard"},
 {subject:"Never let payroll sneak up on you",headline:"Stay ahead of payday.",paragraphs:["Sheetpay helps you keep payroll organized with payroll reminders and a workflow built around recurring pay periods.","Less remembering. Less chasing spreadsheets. More payroll completed on time.","Reminders help you plan; you remain responsible for payroll deadlines."],cta:"Set Up Your Payroll"},
 {subject:"Ready to make payroll easier?",headline:"You've seen what Sheetpay can do.",paragraphs:["Payroll doesn't have to mean hours of repetitive calculations, spreadsheets and individual payslips.","Upgrade Sheetpay Accountant to unlock the paid limits and tools designed to help you manage payroll faster across your business or clients.","Choose the plan that works for you."],cta:"Upgrade Sheetpay"},
] as const;
const escape = (s:string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function destination(day:number, activity:{client:boolean;employees:boolean;payroll:boolean}) {
 if(day === 7) return {url:"https://sheetpay.app/accountant?upgrade=1",label:"Upgrade Sheetpay"};
 if(!activity.client) return {url:"https://sheetpay.app/accountant",label:"Set Up Your First Client"};
 if(!activity.employees) return {url:"https://sheetpay.app/accountant?tab=Employees",label:"Import Your Employees"};
 if(day===5 && activity.payroll)return {url:"https://sheetpay.app/accountant?upgrade=1",label:"Explore Paid Accountant Plans"};
 const tab = day === 4 ? "Dashboard" : day === 5 ? "Clients" : day === 6 ? "Reminders" : "Payroll";
 return {url:"https://sheetpay.app/accountant?tab="+encodeURIComponent(tab)+(day===4?"&focus=cayla":""),label:CAMPAIGN_COPY[day-1].cta};
}
export function renderCampaign(day:number, name:string|undefined, target:{url:string;label:string}, unsubscribe:string) {
 const copy=CAMPAIGN_COPY[day-1]; if(!copy) throw Error("Invalid campaign day");
 const first=name?.trim().split(/\s+/)[0]?.slice(0,60);
 const greeting=first ? "Hi "+first+"," : "Hi there,";
 const footer="You're receiving this because you created a Sheetpay Accountant account.";
 const text=[greeting,copy.headline,...copy.paragraphs,target.label+": "+target.url,footer,"Sheetpay — sheetpay.app","Unsubscribe from marketing emails: "+unsubscribe,"Privacy: https://sheetpay.app/privacy-policy","Terms: https://sheetpay.app/terms-of-service"].join("\n\n");
 const html='<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f3f8f5;font-family:Arial,sans-serif;color:#183d33"><div style="max-width:560px;margin:0 auto;padding:28px 20px"><div style="background:white;border-radius:20px;padding:28px 22px"><p style="color:#087258;font-size:20px;font-weight:bold">Sheetpay Accountant</p><p>'+escape(greeting)+'</p><h1 style="font-size:24px;line-height:1.3">'+escape(copy.headline)+'</h1>'+copy.paragraphs.map(p=>'<p style="font-size:16px;line-height:1.6">'+escape(p)+'</p>').join("")+'<p style="margin:26px 0"><a href="'+escape(target.url)+'" style="display:inline-block;background:#087b58;color:white;padding:14px 20px;border-radius:12px;text-decoration:none;font-weight:bold">'+escape(target.label)+'</a></p></div><div style="font-size:12px;line-height:1.7;color:#617269;padding:18px 4px"><p>'+footer+'</p><p>Sheetpay · <a href="https://sheetpay.app">sheetpay.app</a></p><p><a href="'+escape(unsubscribe)+'">Unsubscribe from marketing emails</a></p><p><a href="https://sheetpay.app/privacy-policy">Privacy Policy</a> · <a href="https://sheetpay.app/terms-of-service">Terms of Service</a></p></div></div></body></html>';
 return {subject:copy.subject,html,text};
}
