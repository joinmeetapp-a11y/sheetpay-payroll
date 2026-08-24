import React from 'react';
import { Star, CheckCircle2, Quote, ShieldCheck } from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';

export interface TestimonialItem {
  id: string;
  businessName: string;
  industry: string;
  country: string;
  countryFlag: string;
  contactName: string;
  role: string;
  avatar: string;
  rating: number;
  quote: string;
  highlightStat: string;
  statLabel: string;
  statutoryPraise: string;
  verifiedEmployees: number;
}

export const caribbeanTestimonials: TestimonialItem[] = [
  {
    id: 'rev-tt-1',
    businessName: 'Apex Caribbean Logistics Ltd',
    industry: 'Maritime, Freight & Logistics',
    country: 'Trinidad & Tobago',
    countryFlag: '🇹🇹',
    contactName: 'Derek De Silva',
    role: 'Managing Director & CFO',
    avatar: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=240&auto=format&fit=crop&q=80',
    rating: 5,
    quote:
      'We used to spend 2 full days calculating split-shift maritime overtime, BIR tax brackets, and NIS Class 16 ceilings. With Cayla, I literally say “Run payroll for August and give Derek’s crew 12 hours overtime” and it’s done in 15 seconds. 100% compliant with Trinidad BIR TD4 guidelines.',
    highlightStat: '95% Time Saved',
    statLabel: 'from 2 days to 30 seconds',
    statutoryPraise: 'Flawless TD4, BIR & NIS Class 16 precision',
    verifiedEmployees: 48,
  },
  {
    id: 'rev-bb-2',
    businessName: 'Bajan Palms Resorts & Spas',
    industry: 'Hospitality & Luxury Tourism',
    country: 'Barbados',
    countryFlag: '🇧🇧',
    contactName: 'Camille Walcott',
    role: 'Group HR & Payroll Director',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=240&auto=format&fit=crop&q=80',
    rating: 5,
    quote:
      'Cayla understands the Caribbean hospitality reality—service charge distributions, split weekend rates, and BRA statutory income tax brackets. Our 85 resort staff receive their beautiful branded payslips straight to their WhatsApp or email before Friday evening.',
    highlightStat: '85 Staff Paid',
    statLabel: 'in one 5-second voice instruction',
    statutoryPraise: 'BRA & Barbados NIS automatic tiers',
    verifiedEmployees: 85,
  },
  {
    id: 'rev-jm-3',
    businessName: 'Kingston Digital Media Group',
    industry: 'Tech, Media & Creative Agencies',
    country: 'Jamaica',
    countryFlag: '🇯🇲',
    contactName: 'Andre Campbell',
    role: 'Founder & Operations Lead',
    avatar: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=240&auto=format&fit=crop&q=80',
    rating: 5,
    quote:
      'Calculating Jamaican payroll with NHT, NIS, Education Tax, and HEART trust used to give our accounting team panic attacks. Cayla handles all deterministic withholding automatically while I focus on scaling the agency.',
    highlightStat: '0 Errors in 18 Mos',
    statLabel: '100% Tax Authority compliance',
    statutoryPraise: 'NHT, NIS, Ed Tax & HEART Trust computed',
    verifiedEmployees: 32,
  },
  {
    id: 'rev-gy-4',
    businessName: 'Demerara Engineering & Supplies',
    industry: 'Industrial, Oil & Gas Infrastructure',
    country: 'Guyana',
    countryFlag: '🇬🇾',
    contactName: 'Priya Persaud',
    role: 'Financial Controller',
    avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=240&auto=format&fit=crop&q=80',
    rating: 5,
    quote:
      'With Guyana’s rapid economic expansion, we hired 30 new technicians in 6 months. Cayla handled GRA statutory withholding tax, offshore camp allowances, and instant bank remittance sheets without breaking a sweat.',
    highlightStat: '3.5x Faster Growth',
    statLabel: 'seamlessly scaled to 60+ team members',
    statutoryPraise: 'Guyana GRA Withholding & NIS compliant',
    verifiedEmployees: 64,
  },
  {
    id: 'rev-lc-5',
    businessName: 'Lucian Commercial Distributors',
    industry: 'Wholesale & Retail Supply',
    country: 'Saint Lucia',
    countryFlag: '🇱🇨',
    contactName: 'Jean-Marc Baptiste',
    role: 'General Manager',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=240&auto=format&fit=crop&q=80',
    rating: 5,
    quote:
      'We replaced an overpriced legacy payroll provider with Cayla. Our managers love the natural conversational interface and our warehouse workers love the modern QR-verified digital payslips.',
    highlightStat: '$14,000/yr Saved',
    statLabel: 'eliminated legacy payroll vendor fees',
    statutoryPraise: 'NIC St. Lucia statutory automation',
    verifiedEmployees: 38,
  },
  {
    id: 'rev-bs-6',
    businessName: 'Bahamas Blue Financial Advisory',
    industry: 'Corporate Services & Wealth',
    country: 'The Bahamas',
    countryFlag: '🇧🇸',
    contactName: 'Shaniqua Rolle',
    role: 'Head of People & Compliance',
    avatar: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=240&auto=format&fit=crop&q=80',
    rating: 5,
    quote:
      'Executive payroll requires absolute confidentiality and zero errors. Cayla’s anomaly checks catch mistakes before they happen and provide the cleanest audit logs I’ve ever seen in the Caribbean.',
    highlightStat: '100% Audit Ready',
    statLabel: 'real-time forensic ledger tracking',
    statutoryPraise: 'NIB contributions & executive schedules',
    verifiedEmployees: 26,
  },
];

export const CaribbeanReviews: React.FC = () => {
  return (
    <section id="caribbean-reviews" className="py-24 sm:py-32 bg-slate-50/80 text-slate-900 border-y border-slate-200 relative overflow-hidden">
      {/* Ambient background styling */}
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1.2px,transparent_1.2px)] [background-size:28px_28px] opacity-15 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold shadow-2xs">
            <CaylaPenMascot size="xs" showStatusDot={true} />
            <span>Trusted Across the Caribbean Region</span>
          </div>

          <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-tight text-slate-950">
            Loved by <span className="text-emerald-600">Caribbean businesses</span> large and small.
          </h2>

          <p className="text-base sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto font-medium">
            From Port of Spain to Kingston and Bridgetown, Caribbean entrepreneurs and payroll managers trust <strong className="text-emerald-600">Cayla</strong> for statutory accuracy and effortless voice payroll.
          </p>
        </div>

        {/* High-Impact Stat Badges Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl text-center space-y-1.5 shadow-xs hover:border-emerald-300 transition-all">
            <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">99.98%</div>
            <div className="text-xs sm:text-sm font-bold text-slate-900">Statutory Tax Accuracy</div>
            <div className="text-[11px] text-slate-500 font-medium">BIR, NIS, PAYE &amp; NHT Guaranteed</div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-3xl text-center space-y-1.5 shadow-xs hover:border-emerald-300 transition-all">
            <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">15,000+</div>
            <div className="text-xs sm:text-sm font-bold text-slate-900">Caribbean Payslips Generated</div>
            <div className="text-[11px] text-slate-500 font-medium">Across 6 island jurisdictions</div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-3xl text-center space-y-1.5 shadow-xs hover:border-emerald-300 transition-all">
            <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">4.9 / 5</div>
            <div className="text-xs sm:text-sm font-bold text-slate-900">Employer Satisfaction</div>
            <div className="text-[11px] text-slate-500 font-medium">Over 350+ regional business reviews</div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-3xl text-center space-y-1.5 shadow-xs hover:border-emerald-300 transition-all">
            <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">5 Secs</div>
            <div className="text-xs sm:text-sm font-bold text-slate-900">Average Pay Run Time</div>
            <div className="text-[11px] text-slate-500 font-medium">Natural voice to official payslips</div>
          </div>
        </div>

        {/* Testimonials Grid (6 Comprehensive Caribbean Business Case Reviews) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {caribbeanTestimonials.map((item) => (
            <div
              key={item.id}
              className="bg-white hover:bg-slate-50/70 border border-slate-200 hover:border-emerald-400 rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 transition-all duration-300 shadow-xs hover:shadow-md group"
            >
              <div className="space-y-4">
                {/* Top Row: Country Tag + Rating */}
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
                    <span className="text-sm">{item.countryFlag}</span>
                    <span>{item.country}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>

                {/* Statutory Praise Badge */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{item.statutoryPraise}</span>
                </div>

                {/* Review Quote */}
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-normal italic relative">
                  <Quote className="w-6 h-6 text-emerald-600/15 absolute -top-2 -left-2 pointer-events-none" />
                  &ldquo;{item.quote}&rdquo;
                </p>
              </div>

              {/* Bottom Row: Highlight Impact & Author Details */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                {/* Quantitative Impact Metric */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono">
                  <div>
                    <span className="text-emerald-700 font-black text-sm block">{item.highlightStat}</span>
                    <span className="text-slate-500 text-[11px] font-sans">{item.statLabel}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {item.verifiedEmployees} Staff
                  </span>
                </div>

                {/* Reviewer Info */}
                <div className="flex items-center gap-3">
                  <img
                    src={item.avatar}
                    alt={item.contactName}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500/30 border border-white"
                  />
                  <div className="overflow-hidden">
                    <h3 className="font-extrabold text-sm text-slate-900 truncate flex items-center gap-1.5">
                      <span>{item.contactName}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    </h3>
                    <p className="text-xs text-emerald-700 font-semibold truncate">{item.role}</p>
                    <p className="text-[11px] text-slate-500 truncate">{item.businessName}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
