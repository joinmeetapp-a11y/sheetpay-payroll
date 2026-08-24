import React, { useState, useEffect } from 'react';
import { LegalDocument, legalDocuments } from '../../lib/legalContent';
import { SEOHead } from '../calculators/SEOHead';
import { CaylaPenMascot } from '../CaylaPenMascot';
import {
  Shield,
  ShieldCheck,
  FileText,
  CreditCard,
  Lock,
  BookOpen,
  Mail,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Printer,
  Share2,
  Check,
  Home,
  HelpCircle,
  Sparkles,
  Phone,
  Clock,
  MapPin,
  Send,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';

interface LegalPageProps {
  document: LegalDocument;
  onNavigate: (path: string) => void;
  onLaunchApp: () => void;
  onStartOnboarding: () => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({
  document: doc,
  onNavigate,
  onLaunchApp,
  onStartOnboarding,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Contact form state (for contact/support view)
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('General Inquiry');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  // Scroll to top on document change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCopiedLink(false);
  }, [doc.slug]);

  const handleCopyLink = () => {
    const url = window.location.origin + doc.canonicalPath;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) return;
    setContactSent(true);
  };

  // Nav list of all legal documents
  const allLegalDocs = [
    { slug: 'privacy-policy', path: '/privacy-policy', label: 'Privacy Policy', icon: Lock },
    { slug: 'terms-of-service', path: '/terms-of-service', label: 'Terms of Service', icon: FileText },
    { slug: 'refund-policy', path: '/refund-policy', label: 'Refund Policy', icon: CreditCard, badge: '14-Day Guarantee' },
    { slug: 'security', path: '/security', label: 'Security & Encryption', icon: ShieldCheck },
    { slug: 'compliance', path: '/compliance', label: 'Statutory Compliance', icon: BookOpen },
    { slug: 'contact', path: '/contact', label: 'Support & Contact', icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-200 font-sans antialiased">
      {/* 1. SEO Head & Dynamic Meta Injection */}
      <SEOHead
        config={{
          title: doc.metaTitle,
          description: doc.metaDescription,
          canonicalPath: doc.canonicalPath,
          h1: doc.title,
          breadcrumbs: [
            { name: 'Home', path: '/' },
            { name: 'Legal & Trust', path: '/privacy-policy' },
            { name: doc.title, path: doc.canonicalPath },
          ],
          faqs: doc.faqs,
        }}
      />

      {/* 2. Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onNavigate('/')}
            id="legal-header-logo"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <CaylaPenMascot size="sm" showStatusDot={true} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight text-slate-950">Sheetpay</span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  Legal &amp; Trust
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 hidden sm:block">AI Payroll Agent Platform</p>
            </div>
          </div>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-600">
            <button
              onClick={() => onNavigate('/')}
              className="hover:text-emerald-700 transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => onNavigate('/calculators')}
              className="hover:text-emerald-700 transition-colors cursor-pointer"
            >
              Payroll Calculators
            </button>
            <button
              onClick={() => onNavigate('/refund-policy')}
              className={`hover:text-emerald-700 transition-colors cursor-pointer ${
                doc.slug === 'refund-policy' ? 'text-emerald-700 font-extrabold' : ''
              }`}
            >
              Refund Policy
            </button>
            <button
              onClick={() => onNavigate('/contact')}
              className={`hover:text-emerald-700 transition-colors cursor-pointer ${
                doc.slug === 'contact' ? 'text-emerald-700 font-extrabold' : ''
              }`}
            >
              Support
            </button>
          </nav>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onLaunchApp}
              id="legal-launch-app-btn"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            >
              <span>Launch App</span>
            </button>
            <button
              onClick={onStartOnboarding}
              id="legal-try-free-btn"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <CaylaPenMascot size="xs" />
              <span>Try Cayla Free</span>
              <ArrowRight className="w-3.5 h-3.5 hidden sm:inline-block" />
            </button>
          </div>
        </div>
      </header>

      {/* 3. Hero / Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white pt-10 pb-14 border-b border-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1.5px,transparent_1.5px)] [background-size:32px_32px] opacity-10 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-5">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 flex-wrap" aria-label="Breadcrumb">
            <button
              onClick={() => onNavigate('/')}
              className="hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>
            <span>/</span>
            <span className="text-slate-300">Legal &amp; Trust Center</span>
            <span>/</span>
            <span className="text-emerald-400 font-bold">{doc.title}</span>
          </nav>

          {/* Title and Metadata */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
            <div className="space-y-3 max-w-3xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Shield className="w-3.5 h-3.5" />
                  <span>{doc.category} Document</span>
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Version {doc.version}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400">
                  Last Updated: <strong className="text-slate-200">{doc.lastUpdated}</strong>
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                {doc.title}
              </h1>

              <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
                {doc.summary}
              </p>
            </div>

            {/* Quick Actions (Print & Copy Link) */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer shadow-xs"
                title="Print or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>Print Document</span>
              </button>
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer shadow-xs"
                title="Copy shareable link"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Share Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Horizontal Document Switcher Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-18 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar">
            {allLegalDocs.map((item) => {
              const Icon = item.icon;
              const isActive = doc.slug === item.slug;
              return (
                <button
                  key={item.slug}
                  onClick={() => onNavigate(item.path)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-black uppercase px-1.5 py-0.2 rounded-md ${
                        isActive
                          ? 'bg-emerald-800 text-emerald-100'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* LEFT SIDEBAR: Table of Contents & Quick Navigation */}
          <aside className="lg:col-span-4 space-y-6">
            
            {/* Table of Contents Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs sticky top-36 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Table of Contents
                </h2>
              </div>

              <nav className="space-y-1.5 text-xs font-semibold text-slate-600">
                {doc.sections.map((sec, idx) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="block py-1.5 px-2.5 rounded-lg hover:bg-slate-50 hover:text-emerald-700 transition-colors truncate"
                  >
                    <span className="font-mono text-emerald-600 font-bold mr-1.5">{idx + 1}.</span>
                    <span>{sec.title.replace(/^\d+\.\s*/, '')}</span>
                  </a>
                ))}
                {doc.faqs && doc.faqs.length > 0 && (
                  <a
                    href="#faq-section"
                    className="block py-1.5 px-2.5 rounded-lg hover:bg-slate-50 hover:text-emerald-700 transition-colors"
                  >
                    <span className="font-mono text-emerald-600 font-bold mr-1.5">★</span>
                    <span>Frequently Asked Questions</span>
                  </a>
                )}
              </nav>

              {/* Document Summary Box */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Jurisdiction &amp; Scope
                </div>
                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-slate-900">Caribbean &amp; Global Compliance</p>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Calibrated for Trinidad &amp; Tobago, Barbados, Saint Lucia, Belize, Jamaica, and Guyana statutory jurisdictions.
                  </p>
                </div>
              </div>

              {/* Direct Help Button */}
              <button
                onClick={() => onNavigate('/contact')}
                className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                <span>Contact Legal or Support</span>
              </button>
            </div>

          </aside>

          {/* RIGHT COLUMN: Document Body Sections */}
          <div className="lg:col-span-8 space-y-8 bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-xs">
            
            {/* Legal Sections */}
            <div className="space-y-10">
              {doc.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="space-y-4 scroll-mt-36"
                >
                  <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight pb-2 border-b border-slate-100">
                    {section.title}
                  </h2>

                  {/* Paragraphs */}
                  <div className="space-y-3 text-sm sm:text-base text-slate-700 leading-relaxed font-normal">
                    {section.content.map((p, pIdx) => (
                      <p key={pIdx}>{p}</p>
                    ))}
                  </div>

                  {/* Subsections if any */}
                  {section.subsections && section.subsections.length > 0 && (
                    <div className="space-y-4 pt-2">
                      {section.subsections.map((sub, sIdx) => (
                        <div key={sIdx} className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-2">
                          <h3 className="text-sm sm:text-base font-black text-slate-900">
                            {sub.title}
                          </h3>
                          <div className="space-y-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {sub.content.map((subP, subPIdx) => (
                              <p key={subPIdx}>{subP}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Callout Box */}
                  {section.callout && (
                    <div
                      className={`p-4 sm:p-5 rounded-2xl border flex items-start gap-3.5 ${
                        section.callout.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          : section.callout.type === 'shield'
                          ? 'bg-blue-50 border-blue-200 text-blue-950'
                          : section.callout.type === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-950'
                          : 'bg-emerald-50/50 border-emerald-200 text-slate-900'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {section.callout.type === 'success' && <CreditCard className="w-5 h-5 text-emerald-600" />}
                        {section.callout.type === 'shield' && <ShieldCheck className="w-5 h-5 text-blue-600" />}
                        {section.callout.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-600" />}
                        {section.callout.type === 'info' && <Sparkles className="w-5 h-5 text-emerald-600" />}
                      </div>
                      <div className="space-y-1 text-xs sm:text-sm">
                        <div className="font-black">
                          {section.callout.title}
                        </div>
                        <p className="leading-relaxed font-medium">
                          {section.callout.text}
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* If Support / Contact Page: Interactive Contact Form */}
            {doc.slug === 'contact' && (
              <section className="pt-6 border-t border-slate-200 space-y-6" id="contact-form-section">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-950">Send an Inquiry to Our Support Desk</h3>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Our Caribbean payroll specialists typically respond in less than 2 business hours.
                  </p>
                </div>

                {contactSent ? (
                  <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                      <Check className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-black text-emerald-900">Message Dispatched Successfully!</h4>
                    <p className="text-xs text-emerald-800 max-w-md mx-auto">
                      Thank you, {contactName}. A support ticket has been registered. We have sent a confirmation to {contactEmail}.
                    </p>
                    <button
                      onClick={() => {
                        setContactSent(false);
                        setContactMessage('');
                      }}
                      className="text-xs font-bold text-emerald-700 underline cursor-pointer"
                    >
                      Send another inquiry &rarr;
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Your Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="e.g. Camille Richards"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Business Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="name@company.com"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Topic / Category
                      </label>
                      <select
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      >
                        <option value="General Inquiry">General Payroll Question</option>
                        <option value="Accountant Practice Demo">Accountant Practice Multi-Tenant Demo</option>
                        <option value="Billing & Refund">Billing, Invoices &amp; 14-Day Refund</option>
                        <option value="Statutory Tax Engine">Statutory Tax Engine Calibration</option>
                        <option value="Security & Compliance">Security &amp; Data Protection</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Your Message / Questions *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Tell us how we can help your payroll workflow..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Submit Support Request</span>
                    </button>
                  </form>
                )}
              </section>
            )}

            {/* FAQ Accordion Section */}
            {doc.faqs && doc.faqs.length > 0 && (
              <section id="faq-section" className="pt-8 border-t border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg sm:text-xl font-black text-slate-950">
                    Frequently Asked Questions
                  </h3>
                </div>

                <div className="space-y-3">
                  {doc.faqs.map((faq, fIdx) => {
                    const isOpen = openFaqIndex === fIdx;
                    return (
                      <div
                        key={fIdx}
                        className="border border-slate-200 rounded-2xl overflow-hidden transition-all"
                      >
                        <button
                          onClick={() => setOpenFaqIndex(isOpen ? null : fIdx)}
                          className="w-full p-4 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-slate-900 bg-slate-50/60 hover:bg-slate-100/80 transition-colors cursor-pointer"
                        >
                          <span>{faq.question}</span>
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </button>

                        {isOpen && (
                          <div className="p-4 bg-white text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Bottom Conversion Card */}
            <div className="pt-6 border-t border-slate-200">
              <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
                <div className="flex items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <CaylaPenMascot size="sm" />
                  </div>
                  <div>
                    <h4 className="text-base sm:text-lg font-black text-white">
                      Experience Cayla Autonomous Payroll
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                      Compliant Caribbean statutory calculations with zero friction.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                  <button
                    onClick={onStartOnboarding}
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Try Cayla Free</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* 6. Comprehensive Footer */}
      <footer className="bg-white border-t border-slate-200 pt-14 pb-10 text-slate-600 text-xs sm:text-sm mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            
            {/* Brand Col */}
            <div className="col-span-2 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <CaylaPenMascot size="xs" />
                </div>
                <span className="font-black text-lg text-slate-950 tracking-tight">Sheetpay</span>
              </div>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed font-medium">
                Autonomous conversational payroll and deterministic Caribbean statutory tax calculations powered by Cayla AI.
              </p>
              <div className="text-[11px] text-slate-400 font-mono pt-1">
                &copy; {new Date().getFullYear()} Sheetpay Inc. All rights reserved.
              </div>
            </div>

            {/* Product Links */}
            <div className="space-y-2.5">
              <div className="font-black text-slate-900 uppercase tracking-wider text-xs">Product</div>
              <ul className="space-y-2 text-xs font-semibold">
                <li><button onClick={() => onNavigate('/')} className="hover:text-emerald-700 cursor-pointer">Landing Home</button></li>
                <li><button onClick={() => onNavigate('/#pricing')} className="hover:text-emerald-700 cursor-pointer">Pricing &amp; Plans</button></li>
                <li><button onClick={() => onNavigate('/#features')} className="hover:text-emerald-700 cursor-pointer">Voice Payroll</button></li>
                <li><button onClick={() => onNavigate('/#templates')} className="hover:text-emerald-700 cursor-pointer">12 Payslip Templates</button></li>
              </ul>
            </div>

            {/* Calculators */}
            <div className="space-y-2.5">
              <div className="font-black text-slate-900 uppercase tracking-wider text-xs">Payroll Calculators</div>
              <ul className="space-y-2 text-xs font-semibold">
                <li><button onClick={() => onNavigate('/calculators')} className="text-emerald-700 font-bold hover:text-emerald-800 cursor-pointer">All Calculators Hub</button></li>
                <li><button onClick={() => onNavigate('/trinidad-and-tobago')} className="hover:text-emerald-700 cursor-pointer">Trinidad &amp; Tobago</button></li>
                <li><button onClick={() => onNavigate('/barbados')} className="hover:text-emerald-700 cursor-pointer">Barbados</button></li>
                <li><button onClick={() => onNavigate('/saint-lucia')} className="hover:text-emerald-700 cursor-pointer">Saint Lucia</button></li>
                <li><button onClick={() => onNavigate('/belize')} className="hover:text-emerald-700 cursor-pointer">Belize</button></li>
              </ul>
            </div>

            {/* Trust & Legal */}
            <div className="space-y-2.5">
              <div className="font-black text-slate-900 uppercase tracking-wider text-xs">Legal &amp; Trust</div>
              <ul className="space-y-2 text-xs font-semibold">
                <li>
                  <button
                    onClick={() => onNavigate('/refund-policy')}
                    className={`hover:text-emerald-700 cursor-pointer flex items-center gap-1.5 ${
                      doc.slug === 'refund-policy' ? 'text-emerald-700 font-bold' : ''
                    }`}
                  >
                    <span>Refund Policy</span>
                    <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded-md">14-Day</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('/privacy-policy')}
                    className={`hover:text-emerald-700 cursor-pointer ${
                      doc.slug === 'privacy-policy' ? 'text-emerald-700 font-bold' : ''
                    }`}
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('/terms-of-service')}
                    className={`hover:text-emerald-700 cursor-pointer ${
                      doc.slug === 'terms-of-service' ? 'text-emerald-700 font-bold' : ''
                    }`}
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('/security')}
                    className={`hover:text-emerald-700 cursor-pointer ${
                      doc.slug === 'security' ? 'text-emerald-700 font-bold' : ''
                    }`}
                  >
                    Security &amp; Encryption
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('/compliance')}
                    className={`hover:text-emerald-700 cursor-pointer ${
                      doc.slug === 'compliance' ? 'text-emerald-700 font-bold' : ''
                    }`}
                  >
                    Statutory Compliance
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('/contact')}
                    className={`hover:text-emerald-700 cursor-pointer ${
                      doc.slug === 'contact' ? 'text-emerald-700 font-bold' : ''
                    }`}
                  >
                    Support &amp; Contact
                  </button>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </footer>
    </div>
  );
};
