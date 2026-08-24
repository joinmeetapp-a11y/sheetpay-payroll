export interface LegalSection {
  id: string;
  title: string;
  content: string[];
  subsections?: {
    title: string;
    content: string[];
  }[];
  callout?: {
    type: 'info' | 'success' | 'warning' | 'shield';
    title: string;
    text: string;
  };
}

export interface LegalDocument {
  id: string;
  slug: string;
  canonicalPath: string;
  aliases: string[];
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: 'Legal' | 'Compliance' | 'Security' | 'Support';
  lastUpdated: string;
  version: string;
  summary: string;
  sections: LegalSection[];
  faqs: { question: string; answer: string }[];
}

export const legalDocuments: Record<string, LegalDocument> = {
  'privacy-policy': {
    id: 'privacy-policy',
    slug: 'privacy-policy',
    canonicalPath: '/privacy-policy',
    aliases: ['/privacy', '/privacy-policy'],
    title: 'Privacy Policy',
    metaTitle: 'Privacy Policy — Sheetpay & Cayla AI Payroll',
    metaDescription:
      'Learn how Sheetpay collects, protects, encrypts, and processes payroll data, employee details, and tax records in compliance with Caribbean and global data protection standards.',
    category: 'Legal',
    lastUpdated: 'August 21, 2026',
    version: '2026.2',
    summary:
      'At Sheetpay, we treat payroll and employee compensation records with the highest echelon of confidentiality and bank-grade encryption. This policy outlines our data collection, AI processing boundaries, and protection practices.',
    sections: [
      {
        id: 'overview',
        title: '1. Introduction and Scope',
        content: [
          'Sheetpay Inc. ("Sheetpay", "we", "our", or "us") provides a conversational, autonomous AI payroll platform powered by the Cayla agent ("Cayla") for businesses and accounting practices across the Caribbean and globally.',
          'This Privacy Policy applies to all users of the Sheetpay web application, public tax calculators, API endpoints, and associated services (collectively, the "Service"). It explains what data we collect, why we collect it, how it is processed by our deterministic tax engine and AI models, and your statutory rights.',
          'By accessing or using Sheetpay, you acknowledge that you have read, understood, and agreed to the data collection and processing practices described herein.',
        ],
        callout: {
          type: 'shield',
          title: 'Zero Training on Sensitive Payroll Data',
          text: 'We never use your proprietary compensation figures, employee National Insurance/BIR numbers, or banking details to train public AI models.',
        },
      },
      {
        id: 'information-collected',
        title: '2. Information We Collect',
        content: [
          'To calculate statutory taxes, produce valid payslips, and execute payroll cycles, Sheetpay processes several categories of information:',
        ],
        subsections: [
          {
            title: 'A. Employer & Organization Data',
            content: [
              'Business legal name, trading name, registered business address, country of incorporation, corporate tax registration numbers (e.g., BIR registration in Trinidad & Tobago, TAMIS TIN in Barbados, Inland Revenue Department IDs), and National Insurance Board (NIB/NIS) employer registration numbers.',
              'Billing information, plan subscriptions, invoice history, and authorized administrative contact details.',
            ],
          },
          {
            title: 'B. Employee & Contractor Payroll Data',
            content: [
              'Full legal name, national identification number, National Insurance number, tax identification number, job title, department, employment classification (full-time, part-time, contractor), base salary or hourly rate, pay cycle frequency, biometric punch logs, overtime hours, bonuses, allowances, and statutory benefit selections.',
              'Bank disbursement account details and contact emails for electronic payslip delivery.',
            ],
          },
          {
            title: 'C. Conversational Prompts & Audit Logs',
            content: [
              'Text and voice transcripts of commands given to Cayla (e.g., "Run payroll for August and add 8 hours overtime for Marcus"), calculation audit timestamps, and actor identification logs to ensure complete payroll traceability.',
            ],
          },
        ],
      },
      {
        id: 'cayla-ai-processing',
        title: '3. How Cayla AI & Deterministic Engines Process Data',
        content: [
          'Sheetpay utilizes a hybrid architecture: natural language comprehension is handled securely via isolated server-side language models, while all statutory tax withholdings (PAYE, NIS, Health Surcharge, Social Security) are executed deterministically by verified statutory tax rule modules.',
          'Conversational inputs are ephemeral and processed in sandboxed environments with strict tenant isolation. An accounting firm operating multi-client tenants has complete cryptographic separation between each client company.',
        ],
        callout: {
          type: 'info',
          title: 'Tenant Isolation Guarantee',
          text: 'Every client company under an accountant practice has strictly partitioned database records and cannot be accessed or cross-queried by unauthorized third parties.',
        },
      },
      {
        id: 'security-encryption',
        title: '4. Security, Encryption & Storage',
        content: [
          'All payroll records and personal identifiable information (PII) are encrypted at rest using AES-256 encryption and encrypted in transit using Transport Layer Security (TLS 1.3).',
          'Data is stored within hardened ISO/IEC 27001 and SOC 2 Type II certified cloud container infrastructure with automated continuous backups, multi-factor authentication enforcement, and rate-limited API firewalls.',
        ],
      },
      {
        id: 'caribbean-compliance',
        title: '5. Caribbean & International Data Protection Standards',
        content: [
          'We adhere to the fundamental data protection principles established in Caribbean jurisdictions, including the Trinidad & Tobago Data Protection Act, Barbados Data Protection Act 2019, Jamaica Data Protection Act 2020, and international standards such as GDPR and CCPA.',
          'You retain the right to request access to, correction of, or permanent deletion of your organization and employee records at any time via the Settings console or by contacting our data privacy desk.',
        ],
      },
      {
        id: 'contact-privacy',
        title: '6. Data Protection Officer Contact',
        content: [
          'If you have questions regarding this Privacy Policy, your statutory data rights, or our security infrastructure, please contact our Data Protection Officer at privacy@sheetpay.com or by mail at: Sheetpay Inc., Attn: Privacy & Data Protection, Maraval Road, Port of Spain, Trinidad and Tobago.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Is my employee payroll data used to train AI models?',
        answer:
          'No. Sheetpay strictly prohibits using sensitive customer payroll, compensation numbers, or employee tax IDs to train public AI models. All conversational AI processing is ephemeral and tenant-isolated.',
      },
      {
        question: 'How long does Sheetpay retain historical payroll runs?',
        answer:
          'We retain historical payroll runs and generated payslips for as long as your account remains active to fulfill your statutory multi-year tax audit obligations. You can request full data export or permanent deletion at any time.',
      },
      {
        question: 'Is employee biometric and timesheet data encrypted?',
        answer:
          'Yes. All imported biometric punch files, timesheets, and overtime logs are encrypted with AES-256 encryption both at rest and in transit.',
      },
    ],
  },

  'terms-of-service': {
    id: 'terms-of-service',
    slug: 'terms-of-service',
    canonicalPath: '/terms-of-service',
    aliases: ['/terms', '/terms-of-service'],
    title: 'Terms of Service',
    metaTitle: 'Terms of Service — Sheetpay AI Payroll Platform',
    metaDescription:
      'Read the Terms of Service governing the use of Sheetpay AI, Cayla conversational payroll agent, statutory tax calculators, and multi-client accounting features.',
    category: 'Legal',
    lastUpdated: 'August 21, 2026',
    version: '2026.2',
    summary:
      'These terms constitute a legally binding agreement between you (or your enterprise/accounting practice) and Sheetpay Inc., governing your access to and use of our AI payroll platform.',
    sections: [
      {
        id: 'acceptance',
        title: '1. Acceptance of Terms & Eligibility',
        content: [
          'By registering for, accessing, or using Sheetpay (including its web interface, mobile views, public tax calculators, and Cayla agent features), you agree to be bound by these Terms of Service.',
          'If you are entering into this agreement on behalf of a business entity or accounting practice, you represent and warrant that you possess the requisite authority to bind that entity to these Terms.',
        ],
      },
      {
        id: 'service-description',
        title: '2. Service Description & Autonomous Agent Capabilities',
        content: [
          'Sheetpay provides a conversational payroll management solution powered by the Cayla AI agent. Capabilities include automated payroll calculations, overtime and bonus processing, deterministic statutory tax deductions (PAYE, NIS, Health Surcharge), payslip generation across 12 layout templates, biometric timesheet ingestion, TD4 tax form preparation, and multi-client practice tools.',
          'While Cayla automates calculations according to published statutory schedules, the employer or authorized accountant remains the ultimate signing authority responsible for reviewing and authorizing all final payroll disbursements.',
        ],
        callout: {
          type: 'warning',
          title: 'Human Review & Approval Workflow',
          text: 'Sheetpay is designed with an explicit "Review & Approve" gate. Cayla stages draft payroll runs; no final disbursement or bank transfer file is sealed without employer or accountant confirmation.',
        },
      },
      {
        id: 'subscriptions-pricing',
        title: '3. Subscription Plans, Billing & Upgrades',
        content: [
          'Sheetpay offers several service tiers:',
          '• Free Plan ($0/month): Includes up to 10 employees, 1 business, 10 payslips/month, standard statutory tax calculations, and basic Cayla AI assistance.',
          '• Business Plan ($97/month): Includes unlimited employees, unlimited businesses, unlimited payroll runs, unlimited payslips, full Cayla AI with voice commands, 50 OCR scans/month, all 12 payslip templates, and advanced reports.',
          '• Accountant Practice Plan ($197/month): Includes unlimited client companies, unlimited employees, batch payroll runs, practice team seats, client approval portal, and multi-tenant portfolio analytics.',
          'Subscription fees are billed in advance on a recurring monthly or annual basis. Prices are listed in USD unless explicitly stated otherwise.',
        ],
      },
      {
        id: 'accountant-practice',
        title: '4. Multi-Client Accountant Practice Terms',
        content: [
          'Accounting firms utilizing the Accountant Practice tier are granted licenses to administer multiple third-party client accounts. The firm is responsible for ensuring it holds appropriate client authorization to access, calculate, and submit statutory payroll filings.',
          'Practice team members must maintain individual secure login credentials and may not share administrative access outside authorized firm staff.',
        ],
      },
      {
        id: 'acceptable-use',
        title: '5. Acceptable Use & Conduct',
        content: [
          'You agree not to: (a) reverse-engineer or attempt to extract source algorithms of the Cayla agent or deterministic tax engine; (b) input intentionally falsified national identification numbers or fraudulent tax claims; (c) transmit malware or attempt to breach cloud container security; or (d) resell or white-label the software without prior written authorization.',
        ],
      },
      {
        id: 'limitation-liability',
        title: '6. Limitation of Liability & Warranty Disclaimer',
        content: [
          'Sheetpay provides its software on an "as is" and "as available" basis. While our deterministic tax engine undergoes rigorous verification against official Board of Inland Revenue (BIR) and National Insurance Board (NIB) gazettes, tax legislation is subject to statutory amendments.',
          'To the maximum extent permitted by law, Sheetpay Inc. shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues resulting from your use of the platform.',
        ],
      },
      {
        id: 'governing-law',
        title: '7. Governing Law and Dispute Resolution',
        content: [
          'These Terms shall be governed by and construed in accordance with the laws of the Republic of Trinidad and Tobago and applicable CARICOM commercial treaties, without regard to conflict of law principles.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I cancel my subscription at any time?',
        answer:
          'Yes. You can cancel your Business or Accountant subscription at any time directly from the Settings tab. Your access will remain active until the end of your paid billing period with no penalty fees.',
      },
      {
        question: 'What happens if statutory tax rates change in my country?',
        answer:
          'Our legal and engineering teams monitor official government gazettes across Trinidad & Tobago, Barbados, Saint Lucia, Belize, Jamaica, and Guyana. We push verified deterministic rule updates to Cayla automatically with zero downtime.',
      },
    ],
  },

  'refund-policy': {
    id: 'refund-policy',
    slug: 'refund-policy',
    canonicalPath: '/refund-policy',
    aliases: ['/refunds', '/refund-policy'],
    title: 'Refund Policy',
    metaTitle: 'Refund Policy — Sheetpay AI Payroll Subscriptions',
    metaDescription:
      'Review Sheetpay’s clear, transparent refund policy for Business ($97/mo) and Accountant ($197/mo) subscription plans, including our 14-day money-back guarantee.',
    category: 'Legal',
    lastUpdated: 'August 21, 2026',
    version: '2026.2',
    summary:
      'We stand behind the accuracy and time-saving power of Cayla. If Sheetpay does not meet your payroll or practice needs, we provide a transparent 14-day money-back guarantee on all initial subscription plans.',
    sections: [
      {
        id: 'guarantee',
        title: '1. 14-Day Money-Back Guarantee',
        content: [
          'We want you to experience the full conversational power and statutory tax accuracy of Cayla with complete confidence.',
          'If you subscribe to the Business Plan ($97/mo) or Accountant Practice Plan ($197/mo) and decide within 14 days of your initial payment that Sheetpay is not the right fit for your organization, you are entitled to a 100% full refund of your subscription fee—no questions asked.',
        ],
        callout: {
          type: 'success',
          title: 'Hassle-Free 14-Day Full Refund',
          text: 'Submit a simple refund request via our in-app chat with Cayla or email billing@sheetpay.com within 14 calendar days of your initial purchase for an immediate full refund.',
        },
      },
      {
        id: 'monthly-renewals',
        title: '2. Monthly Renewals & Ongoing Subscriptions',
        content: [
          'Following the initial 14-day guarantee period, subscription fees are billed on a monthly recurring basis. You can cancel auto-renewal at any time with a single click in your Settings tab.',
          'Upon cancellation, your subscription remains fully functional until the end of the current paid billing cycle, and no further charges will be levied. Recurring monthly renewal fees are generally non-refundable once the billing cycle has commenced, except in cases of verified billing errors or duplicate charges.',
        ],
      },
      {
        id: 'annual-plans',
        title: '3. Annual Subscription Plans',
        content: [
          'For organizations on annual billing contracts, a full refund is available within 30 days of initial purchase. If you cancel an annual plan after 30 days, we provide a prorated refund for the remaining unused full months, minus any discounted introductory benefits received.',
        ],
      },
      {
        id: 'free-tier',
        title: '4. Free Plan & Seamless Transition',
        content: [
          'Sheetpay provides a permanent Free Plan (up to 10 employees, 10 payslips/month, full statutory tax engine) so you can test calculations, generate preview payslips, and converse with Cayla without any credit card required.',
          'If you downgrade from a paid plan to the Free tier, your historical records and employee roster remain preserved.',
        ],
      },
      {
        id: 'refund-process',
        title: '5. How to Request a Refund',
        content: [
          'To request a refund under our 14-day guarantee or report a billing discrepancy:',
          '1. Send an email to billing@sheetpay.com with your account email and organization name, or message Cayla in-app stating "Request billing refund".',
          '2. Our finance desk will verify your account and process the refund back to your original payment method within 1 to 2 business days.',
          '3. Depending on your financial institution or credit card issuer, the refunded credit will typically reflect in your bank account within 3 to 5 business days.',
        ],
        callout: {
          type: 'info',
          title: 'Direct Support SLA',
          text: 'All billing inquiries and refund requests receive a confirmed response within 24 business hours.',
        },
      },
      {
        id: 'disputes',
        title: '6. Calculation Discrepancies or Technical Disruptions',
        content: [
          'If you experience a verified statutory calculation discrepancy or technical disruption that impacts your payroll processing timeline, our senior tax engineering team will review the case and may issue goodwill subscription credits or custom refunds at our discretion.',
        ],
      },
    ],
    faqs: [
      {
        question: 'How do I cancel my subscription before the next renewal?',
        answer:
          'Navigate to Settings > Subscription & Billing in the app and click "Cancel Subscription". Your plan will remain active until the end of the current paid period.',
      },
      {
        question: 'How long does it take for a refund to show up on my card statement?',
        answer:
          'We approve and process refunds within 24 to 48 hours. Your credit card network typically posts the funds back to your statement within 3 to 5 business days.',
      },
      {
        question: 'Does deleting my business account automatically trigger a refund?',
        answer:
          'Account deletion terminates future renewals, but to receive a refund under the 14-day money-back guarantee, please contact billing@sheetpay.com before deleting your workspace.',
      },
    ],
  },

  'security': {
    id: 'security',
    slug: 'security',
    canonicalPath: '/security',
    aliases: ['/security-policy', '/security'],
    title: 'Security & Encryption Standards',
    metaTitle: 'Security & Encryption Standards — Sheetpay AI',
    metaDescription:
      'Explore Sheetpay’s bank-grade security protocols, multi-tenant practice isolation, AES-256 encryption, forensic audit logging, and cloud data protection.',
    category: 'Security',
    lastUpdated: 'August 21, 2026',
    version: '2026.2',
    summary:
      'Payroll demands zero-compromise security. Sheetpay implements defense-in-depth architecture, end-to-end cryptographic encryption, strict tenant segregation, and granular forensic audit trails.',
    sections: [
      {
        id: 'architecture',
        title: '1. Defense-in-Depth Architecture',
        content: [
          'Sheetpay runs on enterprise-grade, sandboxed cloud container infrastructure with automated scaling, rate-limited reverse proxies, and continuous vulnerability scanning.',
          'All communication between client browsers, mobile devices, and server endpoints is enforced over HTTPS with TLS 1.3 encryption and HSTS preloading.',
        ],
        callout: {
          type: 'shield',
          title: 'Bank-Grade Cryptographic Encryption',
          text: 'All databases, employee identity files, biometric logs, and bank payout batches are encrypted at rest using industry-standard AES-256 keys.',
        },
      },
      {
        id: 'tenant-isolation',
        title: '2. Multi-Tenant Practice Isolation',
        content: [
          'For accounting firms and enterprise conglomerates managing dozens of distinct corporate payrolls, Sheetpay enforces strict logical and cryptographic tenant isolation.',
          'Each client company operates inside an isolated data partition. An accountant switching between clients (e.g., from Maraval Technologies to Caribbean Hospitality Group) accesses strictly isolated employee registers with zero risk of cross-tenant data bleed.',
        ],
      },
      {
        id: 'audit-trails',
        title: '3. Forensic Audit Logging & Traceability',
        content: [
          'Every single action in Sheetpay—whether triggered by a user interface click, biometric timesheet upload, or conversational command to Cayla—generates an immutable audit trail entry.',
          'Audit log records capture the exact timestamp, actor identity (e.g., user email or practice staff name), action summary, previous value, new calculated value, and reversibility status.',
        ],
      },
      {
        id: 'access-control',
        title: '4. Role-Based Access Control (RBAC)',
        content: [
          'Organizations can assign granular permission levels: Owner, Senior Practice Accountant, Payroll Manager, Reviewer, and Read-Only Auditor.',
          'Sensitive financial actions (such as authorizing final salary disbursements, altering statutory BIR numbers, or downloading unmasked bank account batches) require authorized administrative privileges.',
        ],
      },
      {
        id: 'incident-response',
        title: '5. Incident Response & Responsible Disclosure',
        content: [
          'Our dedicated security operations team monitors anomaly detectors 24/7. In the event of any security anomaly, affected administrators are notified within 24 hours with forensic impact assessments.',
          'Security researchers are encouraged to submit responsible vulnerability disclosures to security@sheetpay.com.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Are payroll files and generated PDF payslips password-protected?',
        answer:
          'Yes. Payslips exported or emailed to employees can be configured with automated digital encryption (e.g., employee PIN or date-of-birth encryption) and include verifiable cryptographic QR verification codes.',
      },
      {
        question: 'Where is Sheetpay data physically hosted?',
        answer:
          'Data is hosted across SOC 2 Type II compliant cloud regions with geographic redundancy, automated daily snapshots, and high-availability disaster recovery failovers.',
      },
    ],
  },

  'compliance': {
    id: 'compliance',
    slug: 'compliance',
    canonicalPath: '/compliance',
    aliases: ['/compliance-guide', '/statutory-compliance', '/compliance'],
    title: 'Statutory Compliance Guide & Tax Engine',
    metaTitle: 'Caribbean Statutory Compliance Guide & Tax Engine — Sheetpay',
    metaDescription:
      'Official statutory guidelines for Caribbean payroll withholdings: Trinidad BIR/NIS, Barbados NIS/PAYE, Saint Lucia NIC/PAYE, Belize Social Security, and TD4 tax forms.',
    category: 'Compliance',
    lastUpdated: 'August 21, 2026',
    version: '2026.2',
    summary:
      'Sheetpay’s deterministic tax engine is calibrated against official statutory legislation across the Caribbean. Cayla applies exact formulas, earnings bands, and exemption thresholds for 100% compliant payroll.',
    sections: [
      {
        id: 'framework',
        title: '1. The Deterministic Tax Engine Philosophy',
        content: [
          'Unlike generic AI tools that hallucinate numbers, Cayla never guesses tax math. All calculations are executed by hard-coded, unit-tested deterministic rule sets according to published statutory legislation.',
          'Cayla parses the conversational intent (e.g., overtime hours, bonuses, salary adjustments), and passes the validated parameters to the deterministic engine for exact penny-perfect calculation.',
        ],
        callout: {
          type: 'info',
          title: 'Zero Hallucination Tax Guarantee',
          text: 'Every statutory withholding (PAYE, NIS, Social Security, Health Surcharge) is computed by audited code conforming to statutory schedules.',
        },
      },
      {
        id: 'trinidad-tobago',
        title: '2. Trinidad & Tobago Statutory Rules',
        content: [
          '• Personal Income Tax (PAYE): Annual personal tax allowance of $90,000 TTD ($7,500/month). Earnings up to $1,000,000/yr taxed at 25%; earnings exceeding $1,000,000/yr taxed at 30%.',
          '• National Insurance (NIS): Evaluated across 16 official wage classes. The maximum insurable earnings ceiling is $13,600/month (Class 16 maximum contribution $452.40/month employee, $904.80/month employer).',
          '• Health Surcharge: $8.25/week ($35.75/month) for earnings over $469.99/month; $4.80/week ($20.80/month) for earnings $469.99/month or less.',
          '• Statutory Reporting: Automated generation of TD4 Supplementary certificates and BIR annual remittance summaries.',
        ],
      },
      {
        id: 'barbados',
        title: '3. Barbados Statutory Rules',
        content: [
          '• National Insurance (NIS): Employee contribution rate 11.10%, Employer contribution rate 12.75% up to the insurable maximum ceiling ($5,200/month or $1,200/week).',
          '• PAYE Tax Brackets: Basic rate of 12.5% on taxable income up to $50,000 BBD/year; Higher rate of 28.5% on taxable income exceeding $50,000 BBD/year with standard personal allowance ($25,000 BBD/year).',
        ],
      },
      {
        id: 'saint-lucia',
        title: '4. Saint Lucia Statutory Rules',
        content: [
          '• National Insurance Corporation (NIC): 5.0% employee and 5.0% employer contribution up to the maximum monthly insurable earnings ceiling ($5,000 XCD/month).',
          '• PAYE Progressive Brackets: Tiered tax bands (10%, 15%, 20%, 30%) following statutory personal deductions ($18,000 XCD/year).',
        ],
      },
      {
        id: 'belize',
        title: '5. Belize Statutory Rules',
        content: [
          '• Belize Social Security Board (SSB): Sliding contribution scale based on wage brackets up to maximum insurable ceiling ($520 BZD/week).',
          '• Income Tax (PAYE): Flat 25% tax rate on chargeable income exceeding the statutory threshold of $26,000 BZD/year ($500/week).',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I generate official TD4 certificates for BIR tax filing in Trinidad?',
        answer:
          'Yes. Sheetpay automatically compiles verified TD4 Supplementary certificates for all employees, formatted to official BIR specifications for both digital and print submissions.',
      },
      {
        question: 'How are bi-weekly and weekly payrolls calculated for NIS bands?',
        answer:
          'Our deterministic engine automatically adapts statutory formulas based on pay frequency (monthly, bi-weekly, semi-monthly, weekly) and applies exact weekly insurable earning limits.',
      },
    ],
  },

  'contact': {
    id: 'contact',
    slug: 'contact',
    canonicalPath: '/contact',
    aliases: ['/support', '/contact'],
    title: 'Support & Contact',
    metaTitle: 'Support & Contact — Sheetpay Customer & Practice Care',
    metaDescription:
      'Contact Sheetpay support, accounting practice onboarding specialists, and technical care teams. Caribbean payroll help desk and live agent assistance.',
    category: 'Support',
    lastUpdated: 'August 21, 2026',
    version: '2026.2',
    summary:
      'Have questions about Caribbean statutory compliance, multi-client accountant setups, or custom payroll imports? Our dedicated support team and Cayla AI are here to assist you.',
    sections: [
      {
        id: 'channels',
        title: '1. Support & Communication Channels',
        content: [
          'We provide multiple high-priority support channels for business owners, human resource managers, and accounting practices:',
          '• In-App Conversational Care: Ask Cayla directly in your workspace for immediate guidance on formulas, batch jobs, and payslip customizations.',
          '• General & Technical Support: support@sheetpay.com (Average response time < 2 hours during Caribbean business hours).',
          '• Accountant Practice Concierge: accountants@sheetpay.com (Dedicated practice migration and multi-tenant setup specialists).',
          '• Billing & Subscription Inquiries: billing@sheetpay.com.',
        ],
      },
      {
        id: 'headquarters',
        title: '2. Regional Office & Hours',
        content: [
          'Operating Hours: Monday – Friday, 8:00 AM – 6:00 PM AST (Atlantic Standard Time).',
          'Headquarters: Sheetpay Inc., Financial Center, Maraval Road, Port of Spain, Trinidad and Tobago.',
          'Regional Support Hubs: Bridgetown (Barbados), Castries (Saint Lucia), and Belize City (Belize).',
        ],
      },
    ],
    faqs: [
      {
        question: 'Do you offer custom payroll onboarding for accounting practices?',
        answer:
          'Yes! Our practice concierge team provides complimentary historical data import, staff training, and client tenant structuring for all Accountant tier subscribers.',
      },
      {
        question: 'What is the fastest way to get help with a live payroll run?',
        answer:
          'Type or speak to Cayla inside your active payroll workspace. If you require human escalation, Cayla will immediately route your request to our priority support desk.',
      },
    ],
  },
};

export function getLegalDocumentByPath(path: string): LegalDocument | null {
  const cleanPath = path.toLowerCase().trim().replace(/\/+$/, '') || '/';
  
  for (const doc of Object.values(legalDocuments)) {
    if (doc.canonicalPath === cleanPath || doc.aliases.includes(cleanPath)) {
      return doc;
    }
  }
  return null;
}
