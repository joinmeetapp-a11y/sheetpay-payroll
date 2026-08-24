import { CountryCode, COUNTRIES_METADATA } from '../tax-rules';

export type CalculatorType =
  | 'nis'
  | 'paye'
  | 'salary'
  | 'payroll'
  | 'take-home'
  | 'health-surcharge';

export interface FAQItem {
  question: string;
  answer: string;
}

export interface CalculatorPageConfig {
  slug: string;
  path: string;
  calculatorType: CalculatorType;
  countryCode: CountryCode;
  countryName: string;
  countryFlag: string;
  currency: string;
  currencySymbol: string;
  taxYear: number;
  lastUpdated: string;
  h1: string;
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  defaultEarnings: number;
  defaultFrequency: 'monthly' | 'weekly' | 'fortnightly' | 'semi-monthly';
  breadcrumbs: { name: string; path: string }[];
  howToUseSteps: string[];
  howCalculatedMarkdown: string;
  faqs: FAQItem[];
  relatedCalculators: { name: string; path: string; description: string }[];
}

export const PRIORITY_CALCULATORS: CalculatorPageConfig[] = [
  // 1. Trinidad NIS Calculator
  {
    slug: 'nis-calculator-trinidad',
    path: '/nis-calculator-trinidad',
    calculatorType: 'nis',
    countryCode: 'TT',
    countryName: 'Trinidad and Tobago',
    countryFlag: '🇹🇹',
    currency: 'TTD',
    currencySymbol: 'TT$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Trinidad & Tobago NIS Calculator',
    shortDescription:
      'Calculate estimated Trinidad and Tobago NIS contributions based on your insurable earnings and pay frequency.',
    seoTitle: 'Trinidad NIS Calculator 2026 – NIBTT Contributions | Sheetpay',
    seoDescription:
      'Calculate Trinidad and Tobago NIS contributions from your earnings. See estimated employee and employer NIS contributions instantly on Sheetpay.',
    primaryKeyword: 'nis calculator trinidad',
    secondaryKeywords: [
      'nis calculator',
      'nis contributions calculator',
      'trinidad nis calculator',
      'nis contribution calculator trinidad',
      'trinidad and tobago nis calculator',
    ],
    defaultEarnings: 8500,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Trinidad & Tobago', path: '/trinidad-and-tobago' },
      { name: 'NIS Calculator', path: '/nis-calculator-trinidad' },
    ],
    howToUseSteps: [
      'Enter your gross earnings or salary in the input field.',
      'Select your pay frequency (Weekly, Fortnightly, Semi-monthly, or Monthly).',
      'Instantly view your employee NIS deduction, employer contribution, and assigned NIBTT contribution class.',
      'Use the Reset or Recalculate buttons anytime to test different salary scenarios.',
    ],
    howCalculatedMarkdown:
      'In Trinidad & Tobago, the National Insurance Board (NIBTT) operates a 16-class earnings schedule. Total NIS is set at 13.2% of insurable earnings, divided into a 1/3 employee portion (4.4%) and a 2/3 employer portion (8.8%). Maximum monthly insurable earnings are capped at $13,600 (Class 16). Earnings under $200/week ($867/month) are exempt.',
    faqs: [
      {
        question: 'How much NIS do I pay in Trinidad?',
        answer:
          'You pay approximately 4.4% of your insurable earnings (one-third of the total 13.2% contribution), determined by the NIBTT 16-class wage schedule. For instance, on a monthly salary of TT$8,500 (Class 11), your monthly employee deduction is TT$359.23.',
      },
      {
        question: 'How is NIS calculated in Trinidad and Tobago?',
        answer:
          'NIBTT assigns your gross wages into one of 16 wage classes. Each class specifies an assumed average insurable wage and assigns fixed weekly/monthly dollar amounts for employee and employer contributions.',
      },
      {
        question: 'How much does an employer contribute to NIS?',
        answer:
          'Employers contribute two-thirds of the total NIS obligation (8.8% of insurable earnings), which is exactly double the employee contribution amount.',
      },
      {
        question: 'Is NIS calculated weekly or monthly?',
        answer:
          'NIS is calculated based on the employee’s pay frequency. NIBTT publishes statutory schedules for weekly, fortnightly, semi-monthly, and monthly pay cycles.',
      },
      {
        question: 'What earnings are subject to NIS?',
        answer:
          'Gross employment earnings including basic pay, overtime, cost of living allowances (COLA), and cash bonuses are subject to NIS, up to the Class 16 ceiling of TT$13,600 per month.',
      },
    ],
    relatedCalculators: [
      {
        name: 'Trinidad PAYE Tax Calculator',
        path: '/paye-calculator-trinidad',
        description: 'Calculate income tax with 70% NIS relief and $84,000 personal allowance.',
      },
      {
        name: 'Trinidad Health Surcharge Calculator',
        path: '/health-surcharge-calculator-trinidad',
        description: 'Calculate statutory weekly and monthly Health Surcharge deductions.',
      },
      {
        name: 'Trinidad Salary & Take-Home Calculator',
        path: '/salary-calculator-trinidad',
        description: 'Estimate net pay after all BIR taxes, NIS, and health surcharges.',
      },
      {
        name: 'Trinidad Full Payroll Calculator',
        path: '/payroll-calculator-trinidad',
        description: 'Calculate complete employer payroll cost and employee deductions.',
      },
    ],
  },

  // 2. Barbados NIS Calculator
  {
    slug: 'nis-calculator-barbados',
    path: '/nis-calculator-barbados',
    calculatorType: 'nis',
    countryCode: 'BB',
    countryName: 'Barbados',
    countryFlag: '🇧🇧',
    currency: 'BBD',
    currencySymbol: 'BDS$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Barbados NIS Calculator',
    shortDescription:
      'Calculate Barbados National Insurance Scheme (NIS) employee and employer contributions with updated 2026 insurable ceilings.',
    seoTitle: 'Barbados NIS Calculator 2026 – Employee & Employer | Sheetpay',
    seoDescription:
      'Calculate Barbados NIS contributions accurately for employees and employers on Sheetpay. Includes Catastrophe Fund, Severance, and Training levies.',
    primaryKeyword: 'nis calculator barbados',
    secondaryKeywords: [
      'barbados nis calculator',
      'nis calculator',
      'barbados national insurance calculator',
      'barbados nis contribution calculator',
    ],
    defaultEarnings: 4200,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Barbados', path: '/barbados' },
      { name: 'NIS Calculator', path: '/nis-calculator-barbados' },
    ],
    howToUseSteps: [
      'Enter your gross earnings in BDS dollars.',
      'Select your payroll frequency (Monthly, Fortnightly, or Weekly).',
      'Review the itemized employee deduction (11.10%) and employer contribution (12.75%).',
      'See your estimated take-home impact and annualized statutory projections.',
    ],
    howCalculatedMarkdown:
      'In Barbados, NIS contributions are calculated up to the maximum insurable earnings ceiling of BDS$5,200/month (BDS$1,200/week). The employee contributes 11.10% (incorporating National Insurance, Non-Contributory scheme, Catastrophe Fund, Severance, Training, and Health levies). The employer contributes 12.75%.',
    faqs: [
      {
        question: 'How is NIS calculated in Barbados?',
        answer:
          'NIS in Barbados is calculated as a percentage of gross insurable earnings up to BDS$5,200 per month (BDS$1,200/week). The standard employee rate is 11.10% and employer rate is 12.75%.',
      },
      {
        question: 'How much NIS does an employee pay in Barbados?',
        answer:
          'An employee pays 11.10% of their insurable earnings up to the monthly ceiling of BDS$5,200, resulting in a maximum employee deduction of BDS$577.20 per month.',
      },
      {
        question: 'How much does an employer contribute?',
        answer:
          'An employer pays 12.75% of insurable earnings, which equates to a maximum employer contribution of BDS$663.00 per month per employee at the insurable ceiling.',
      },
      {
        question: 'What salary is subject to NIS?',
        answer:
          'All basic wages, overtime, commissions, and performance bonuses are subject to NIS deductions up to the statutory ceiling.',
      },
    ],
    relatedCalculators: [
      {
        name: 'Barbados PAYE Tax Calculator',
        path: '/paye-calculator-barbados',
        description: 'Calculate BRA income tax with $25,000 personal allowance and dual tax tiers.',
      },
      {
        name: 'Barbados Salary Calculator',
        path: '/salary-calculator-barbados',
        description: 'Calculate net take-home salary after Barbados NIS and BRA deductions.',
      },
      {
        name: 'Barbados Take-Home Pay Calculator',
        path: '/take-home-pay-calculator-barbados',
        description: 'Instant net earnings breakdown for Barbados workers and contractors.',
      },
      {
        name: 'Barbados Full Payroll Calculator',
        path: '/payroll-calculator-barbados',
        description: 'Estimate total employer burden and employee remittances in Barbados.',
      },
    ],
  },

  // 3. Saint Lucia PAYE Calculator
  {
    slug: 'paye-calculator-st-lucia',
    path: '/paye-calculator-st-lucia',
    calculatorType: 'paye',
    countryCode: 'LC',
    countryName: 'Saint Lucia',
    countryFlag: '🇱🇨',
    currency: 'XCD',
    currencySymbol: 'EC$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Saint Lucia PAYE Calculator',
    shortDescription:
      'Calculate estimated Saint Lucia PAYE income tax, personal allowance deductions, and net take-home salary.',
    seoTitle: 'Saint Lucia PAYE Calculator 2026 – Tax & Net Pay | Sheetpay',
    seoDescription:
      'Calculate Saint Lucia PAYE income tax and net take-home pay on Sheetpay. Includes EC$25,000 personal allowance, NIC deductions, and progressive tax tiers.',
    primaryKeyword: 'paye calculator st lucia',
    secondaryKeywords: [
      'st lucia paye calculator',
      'paye calculator',
      'saint lucia tax calculator',
      'st lucia income tax calculator',
      'salary calculator st lucia',
    ],
    defaultEarnings: 5500,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Saint Lucia', path: '/saint-lucia' },
      { name: 'PAYE Calculator', path: '/paye-calculator-st-lucia' },
    ],
    howToUseSteps: [
      'Enter your monthly or periodic gross salary in Eastern Caribbean Dollars (EC$).',
      'Select your pay cycle (Monthly, Fortnightly, or Weekly).',
      'Review your calculated statutory allowances (EC$25,000 annual personal relief + NIC deduction).',
      'View your itemized PAYE tax, marginal bracket, and estimated net take-home pay.',
    ],
    howCalculatedMarkdown:
      'Saint Lucia PAYE is calculated after deducting the annual personal allowance of EC$25,000 (EC$2,083.33/month) and 100% of employee NIC contributions (5% up to EC$5,000/month). The remaining taxable income is taxed in progressive brackets: 10% on the first EC$10,000, 15% on the next EC$10,000, 20% on the next EC$10,000, and 30% on excess taxable income.',
    faqs: [
      {
        question: 'How is PAYE calculated in Saint Lucia?',
        answer:
          'PAYE is calculated on chargeable income after subtracting the EC$25,000 annual personal allowance and employee NIC contributions. Tax rates scale progressively at 10%, 15%, 20%, and 30%.',
      },
      {
        question: 'Who has to pay PAYE in Saint Lucia?',
        answer:
          'Any resident employee whose taxable income exceeds the basic personal allowance of EC$25,000 per year (EC$2,083.33 per month) is subject to PAYE tax withholding.',
      },
      {
        question: 'How much tax is deducted from salary in Saint Lucia?',
        answer:
          'The first EC$2,083.33 per month is tax-free due to personal allowance. Above that, tax starts at 10% on the first EC$833.33 of chargeable income and scales up to 30% for higher income earners.',
      },
      {
        question: 'How do I calculate take-home pay?',
        answer:
          'Take-home pay equals Gross Salary minus employee NIC (5% up to EC$250/mo) minus PAYE tax. Cayla computes this instantly with exact statutory precision.',
      },
    ],
    relatedCalculators: [
      {
        name: 'Saint Lucia Salary Calculator',
        path: '/salary-calculator-st-lucia',
        description: 'Complete salary-to-net calculator with NIC and IRD tax deductions.',
      },
      {
        name: 'Saint Lucia Take-Home Pay Calculator',
        path: '/take-home-pay-calculator-st-lucia',
        description: 'Find out your exact monthly and bi-weekly take-home cash in EC$.',
      },
      {
        name: 'Saint Lucia Full Payroll Calculator',
        path: '/payroll-calculator-st-lucia',
        description: 'Calculate employer matching contributions and total payroll expense.',
      },
    ],
  },

  // 4. Belize Income Tax Calculator
  {
    slug: 'income-tax-calculator-belize',
    path: '/income-tax-calculator-belize',
    calculatorType: 'paye',
    countryCode: 'BZ',
    countryName: 'Belize',
    countryFlag: '🇧🇿',
    currency: 'BZD',
    currencySymbol: 'BZ$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Belize Income Tax Calculator',
    shortDescription:
      'Calculate Belize income tax, PAYE withholding, Social Security (SSB) contributions, and net salary.',
    seoTitle: 'Belize Income Tax Calculator 2026 – PAYE & Net Pay | Sheetpay',
    seoDescription:
      'Calculate Belize income tax & PAYE withholding on Sheetpay. Includes BZ$20,000 basic deduction, BZ$26,000 low-income exemption, and SSB contribution rates.',
    primaryKeyword: 'income tax belize calculator',
    secondaryKeywords: [
      'belize tax calculator',
      'income tax calculator belize',
      'belize income tax calculator',
      'belize salary tax calculator',
      'belize paye calculator',
    ],
    defaultEarnings: 3500,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Belize', path: '/belize' },
      { name: 'Income Tax Calculator', path: '/income-tax-calculator-belize' },
    ],
    howToUseSteps: [
      'Enter your gross income in Belize Dollars (BZ$).',
      'Choose your pay frequency (Monthly, Bi-weekly, or Weekly).',
      'Check whether your annual earnings fall within the BZ$26,000 zero-tax threshold.',
      'View your calculated 25% PAYE tax, Social Security deduction, and net pay.',
    ],
    howCalculatedMarkdown:
      'In Belize, employees earning BZ$26,000 or less per year (BZ$2,166.67/month) pay 0% income tax. For employees earning over BZ$26,000 annually, income tax is charged at a flat rate of 25% on taxable income exceeding the BZ$20,000 basic standard exemption. Social Security (SSB) is deducted based on weekly wage brackets up to the $520/week ceiling.',
    faqs: [
      {
        question: 'How is income tax calculated in Belize?',
        answer:
          'If your annual gross salary is BZ$26,000 or less, you are completely exempt from income tax (0%). If your annual salary exceeds BZ$26,000, you pay a flat 25% tax on all income exceeding the BZ$20,000 standard deduction.',
      },
      {
        question: 'What income is taxable in Belize?',
        answer:
          'Gross employment income including basic wages, overtime, commissions, and taxable bonuses are included when determining whether you exceed the BZ$26,000 exemption threshold.',
      },
      {
        question: 'How much PAYE should be deducted?',
        answer:
          'For someone earning BZ$3,500/month (BZ$42,000/year), taxable income is BZ$22,000 ($42,000 - $20,000 allowance). Total annual tax is BZ$5,500, which equals BZ$458.33 per month in PAYE withholding.',
      },
      {
        question: 'How do I calculate my take-home salary in Belize?',
        answer:
          'Your net take-home salary is Gross Income minus Social Security (SSB) contributions minus PAYE Income Tax. Cayla computes both employee deductions and employer contributions automatically.',
      },
    ],
    relatedCalculators: [
      {
        name: 'Belize PAYE Calculator',
        path: '/paye-calculator-belize',
        description: 'Calculate PAYE withholding for salaried staff and executives in Belize.',
      },
      {
        name: 'Belize Salary Calculator',
        path: '/salary-calculator-belize',
        description: 'Complete gross-to-net salary estimator for Belize employees.',
      },
      {
        name: 'Belize Take-Home Pay Calculator',
        path: '/take-home-pay-calculator-belize',
        description: 'Determine your take-home cash after SSB and income tax deductions.',
      },
      {
        name: 'Belize Full Payroll Calculator',
        path: '/payroll-calculator-belize',
        description: 'Calculate employer Social Security liability and total payroll expense.',
      },
    ],
  },
];

// Expanded Clusters for all four countries
export const EXPANDED_CALCULATORS: CalculatorPageConfig[] = [
  // TRINIDAD EXPANDED
  {
    slug: 'paye-calculator-trinidad',
    path: '/paye-calculator-trinidad',
    calculatorType: 'paye',
    countryCode: 'TT',
    countryName: 'Trinidad and Tobago',
    countryFlag: '🇹🇹',
    currency: 'TTD',
    currencySymbol: 'TT$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Trinidad & Tobago PAYE Tax Calculator',
    shortDescription:
      'Calculate Trinidad and Tobago BIR PAYE income tax deductions with the $84,000 personal allowance and 70% NIS relief.',
    seoTitle: 'Trinidad PAYE Calculator 2026 – BIR Income Tax | Sheetpay',
    seoDescription:
      'Calculate Trinidad and Tobago PAYE tax on Sheetpay. Features $84,000 personal allowance, 70% NIS tax relief, and dual 25%/30% tax brackets.',
    primaryKeyword: 'paye calculator trinidad',
    secondaryKeywords: ['trinidad paye calculator', 'trinidad income tax calculator', 'bir paye calculator', 'tax calculator trinidad'],
    defaultEarnings: 10500,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Trinidad & Tobago', path: '/trinidad-and-tobago' },
      { name: 'PAYE Calculator', path: '/paye-calculator-trinidad' },
    ],
    howToUseSteps: [
      'Enter your monthly or periodic gross income.',
      'The calculator automatically applies the TT$84,000/yr (TT$7,000/mo) statutory personal allowance.',
      'It also applies the statutory 70% NIS tax relief deduction.',
      'Review your exact BIR PAYE tax liability and effective tax rate.',
    ],
    howCalculatedMarkdown:
      'Trinidad & Tobago PAYE is calculated by deducting the TT$84,000 annual personal allowance ($7,000/month) and 70% of employee NIS contributions from gross pay. The first TT$1,000,000/year ($83,333.33/mo) of chargeable income is taxed at 25%, and income beyond $1M is taxed at 30%.',
    faqs: [
      {
        question: 'What is the personal allowance for income tax in Trinidad?',
        answer: 'The standard individual personal allowance in Trinidad & Tobago is TT$84,000 per year (TT$7,000 per month).',
      },
      {
        question: 'Is NIS tax-deductible in Trinidad?',
        answer: 'Yes! 70% of your employee NIS contribution is statutory tax-deductible from gross income prior to calculating PAYE tax.',
      },
      {
        question: 'What are the PAYE tax brackets in Trinidad & Tobago?',
        answer: 'Chargeable income up to TT$1,000,000 per year ($83,333.33/month) is taxed at 25%. Any chargeable income above TT$1,000,000 is taxed at 30%.',
      },
    ],
    relatedCalculators: [
      { name: 'Trinidad NIS Calculator', path: '/nis-calculator-trinidad', description: 'NIBTT 16-class contribution calculator.' },
      { name: 'Trinidad Health Surcharge Calculator', path: '/health-surcharge-calculator-trinidad', description: 'Health surcharge deduction calculator.' },
      { name: 'Trinidad Salary Calculator', path: '/salary-calculator-trinidad', description: 'Complete gross-to-net salary calculator.' },
    ],
  },
  {
    slug: 'salary-calculator-trinidad',
    path: '/salary-calculator-trinidad',
    calculatorType: 'salary',
    countryCode: 'TT',
    countryName: 'Trinidad and Tobago',
    countryFlag: '🇹🇹',
    currency: 'TTD',
    currencySymbol: 'TT$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Trinidad & Tobago Salary Calculator',
    shortDescription:
      'Calculate your take-home pay and complete statutory deduction breakdown for Trinidad and Tobago.',
    seoTitle: 'Trinidad Salary Calculator – Gross to Net Pay | Sheetpay',
    seoDescription:
      'Convert gross salary to net pay in Trinidad & Tobago on Sheetpay. Includes exact BIR PAYE, NIBTT NIS classes, and Health Surcharge calculations.',
    primaryKeyword: 'salary calculator trinidad',
    secondaryKeywords: ['trinidad salary calculator', 'take home pay calculator trinidad', 'net pay calculator trinidad', 'trinidad wage calculator'],
    defaultEarnings: 12000,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Trinidad & Tobago', path: '/trinidad-and-tobago' },
      { name: 'Salary Calculator', path: '/salary-calculator-trinidad' },
    ],
    howToUseSteps: [
      'Enter your gross salary (monthly, fortnightly, or weekly).',
      'The calculator computes all statutory deductions (NIS, Health Surcharge, PAYE).',
      'Review your net take-home salary and itemized deductions.',
    ],
    howCalculatedMarkdown:
      'Net salary is calculated as Gross Pay minus Employee NIS (4.4% average via NIBTT Class), minus Health Surcharge (TT$35.75/mo for earnings >$469.99/mo), minus BIR PAYE (25% on taxable income over $7,000/mo after 70% NIS relief).',
    faqs: [
      {
        question: 'How is net take-home pay calculated in Trinidad?',
        answer: 'Net pay equals Gross Salary minus NIS contribution, minus Health Surcharge, minus BIR PAYE tax withholding.',
      },
      {
        question: 'How much health surcharge is deducted from my salary?',
        answer: 'If you earn over TT$469.99/month (TT$108.46/week), the health surcharge deduction is TT$8.25/week (TT$35.75/month). If you earn TT$469.99/mo or less, it is TT$4.80/week (TT$20.80/month). Individuals age 60 and over are exempt.',
      },
    ],
    relatedCalculators: [
      { name: 'Trinidad NIS Calculator', path: '/nis-calculator-trinidad', description: 'NIBTT 16-class contribution calculator.' },
      { name: 'Trinidad PAYE Tax Calculator', path: '/paye-calculator-trinidad', description: 'Income tax calculator with BIR rules.' },
      { name: 'Trinidad Full Payroll Calculator', path: '/payroll-calculator-trinidad', description: 'Complete employer and employee payroll calculator.' },
    ],
  },
  {
    slug: 'payroll-calculator-trinidad',
    path: '/payroll-calculator-trinidad',
    calculatorType: 'payroll',
    countryCode: 'TT',
    countryName: 'Trinidad and Tobago',
    countryFlag: '🇹🇹',
    currency: 'TTD',
    currencySymbol: 'TT$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Trinidad & Tobago Payroll Calculator',
    shortDescription:
      'Calculate total employer payroll cost, statutory remittances, and employee net pay in Trinidad & Tobago.',
    seoTitle: 'Trinidad Payroll Calculator – Employer Cost & Deductions | Sheetpay',
    seoDescription:
      'Calculate total employer payroll burden, employer NIS (8.8%), employee deductions, and statutory compliance in Trinidad & Tobago on Sheetpay.',
    primaryKeyword: 'payroll calculator trinidad',
    secondaryKeywords: ['trinidad payroll calculator', 'employer payroll cost trinidad', 'payroll taxes trinidad'],
    defaultEarnings: 15000,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Trinidad & Tobago', path: '/trinidad-and-tobago' },
      { name: 'Payroll Calculator', path: '/payroll-calculator-trinidad' },
    ],
    howToUseSteps: [
      'Enter gross employee earnings.',
      'Review total employer burden including 8.8% employer NIS.',
      'Review employee deductions and net pay disbursement.',
    ],
    howCalculatedMarkdown:
      'Employer payroll cost in Trinidad includes gross salary plus Employer NIS contribution (8.8% up to $1,206.40/month max). Total statutory remittances to NIBTT and BIR include employee NIS + employer NIS + Health Surcharge + PAYE.',
    faqs: [
      {
        question: 'What is the employer NIS contribution in Trinidad?',
        answer: 'Employers contribute 8.8% of insurable earnings to NIBTT, which is double the employee 4.4% contribution, up to a monthly maximum of TT$1,206.40 (Class 16).',
      },
    ],
    relatedCalculators: [
      { name: 'Trinidad NIS Calculator', path: '/nis-calculator-trinidad', description: 'NIBTT contribution breakdown.' },
      { name: 'Trinidad Salary Calculator', path: '/salary-calculator-trinidad', description: 'Employee net pay calculator.' },
    ],
  },
  {
    slug: 'take-home-pay-calculator-trinidad',
    path: '/take-home-pay-calculator-trinidad',
    calculatorType: 'take-home',
    countryCode: 'TT',
    countryName: 'Trinidad and Tobago',
    countryFlag: '🇹🇹',
    currency: 'TTD',
    currencySymbol: 'TT$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Trinidad & Tobago Take-Home Pay Calculator',
    shortDescription:
      'Find out your exact take-home pay in Trinidad after NIS, Health Surcharge, and PAYE tax.',
    seoTitle: 'Trinidad Take-Home Pay Calculator | Sheetpay',
    seoDescription:
      'Calculate your exact net take-home salary in Trinidad & Tobago. Fast, accurate, and free calculator powered by Sheetpay.',
    primaryKeyword: 'take home pay calculator trinidad',
    secondaryKeywords: ['take home pay trinidad', 'net pay trinidad', 'trinidad net salary'],
    defaultEarnings: 9000,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Trinidad & Tobago', path: '/trinidad-and-tobago' },
      { name: 'Take-Home Pay', path: '/take-home-pay-calculator-trinidad' },
    ],
    howToUseSteps: [
      'Enter your gross compensation.',
      'Instantly view your net take-home cash per pay period and annually.',
    ],
    howCalculatedMarkdown:
      'Take-home pay equals Gross Pay minus NIBTT NIS, minus Health Surcharge, minus BIR PAYE tax.',
    faqs: [
      {
        question: 'How can I maximize my take-home pay in Trinidad?',
        answer: 'Ensure your employer has properly recorded your TT$84,000 personal allowance and that 70% NIS relief is credited on your TD4 form.',
      },
    ],
    relatedCalculators: [
      { name: 'Trinidad NIS Calculator', path: '/nis-calculator-trinidad', description: 'NIS class schedule.' },
      { name: 'Trinidad PAYE Calculator', path: '/paye-calculator-trinidad', description: 'BIR income tax.' },
    ],
  },
  {
    slug: 'health-surcharge-calculator-trinidad',
    path: '/health-surcharge-calculator-trinidad',
    calculatorType: 'health-surcharge',
    countryCode: 'TT',
    countryName: 'Trinidad and Tobago',
    countryFlag: '🇹🇹',
    currency: 'TTD',
    currencySymbol: 'TT$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Trinidad & Tobago Health Surcharge Calculator',
    shortDescription:
      'Calculate statutory weekly, monthly, and annual Trinidad and Tobago Health Surcharge deductions.',
    seoTitle: 'Trinidad Health Surcharge Calculator | Sheetpay',
    seoDescription:
      'Calculate Trinidad Health Surcharge deductions accurately. Free online calculator from Sheetpay with statutory BIR rates and exemptions.',
    primaryKeyword: 'health surcharge calculator trinidad',
    secondaryKeywords: ['trinidad health surcharge', 'health surcharge rates trinidad', 'bir health surcharge'],
    defaultEarnings: 7500,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Trinidad & Tobago', path: '/trinidad-and-tobago' },
      { name: 'Health Surcharge', path: '/health-surcharge-calculator-trinidad' },
    ],
    howToUseSteps: [
      'Enter gross earnings.',
      'Select pay frequency to view exact statutory Health Surcharge deduction.',
    ],
    howCalculatedMarkdown:
      'Health surcharge is TT$8.25/week ($35.75/month) for gross earnings exceeding TT$108.46/week ($469.99/month), and TT$4.80/week ($20.80/month) for lower earnings. Individuals age 60 and over are 100% exempt.',
    faqs: [
      {
        question: 'Who is exempt from Trinidad Health Surcharge?',
        answer: 'Individuals under 16 years of age and individuals 60 years of age or older are exempt from the Health Surcharge.',
      },
    ],
    relatedCalculators: [
      { name: 'Trinidad NIS Calculator', path: '/nis-calculator-trinidad', description: 'NIBTT contributions.' },
      { name: 'Trinidad PAYE Calculator', path: '/paye-calculator-trinidad', description: 'BIR income tax.' },
    ],
  },

  // BARBADOS EXPANDED
  {
    slug: 'paye-calculator-barbados',
    path: '/paye-calculator-barbados',
    calculatorType: 'paye',
    countryCode: 'BB',
    countryName: 'Barbados',
    countryFlag: '🇧🇧',
    currency: 'BBD',
    currencySymbol: 'BDS$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Barbados PAYE Tax Calculator',
    shortDescription:
      'Calculate Barbados Revenue Authority (BRA) PAYE income tax with BDS$25,000 personal allowance and 12.5%/28.5% brackets.',
    seoTitle: 'Barbados PAYE Calculator – BRA Income Tax | Sheetpay',
    seoDescription:
      'Calculate Barbados PAYE income tax on Sheetpay. Includes BDS$25,000 personal allowance and current BRA tax brackets.',
    primaryKeyword: 'paye calculator barbados',
    secondaryKeywords: ['barbados paye calculator', 'barbados income tax calculator', 'bra tax calculator barbados'],
    defaultEarnings: 6000,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Barbados', path: '/barbados' },
      { name: 'PAYE Calculator', path: '/paye-calculator-barbados' },
    ],
    howToUseSteps: [
      'Enter gross earnings in BDS$.',
      'The calculator applies the BDS$25,000 personal allowance.',
      'View itemized tax across 12.5% and 28.5% tiers.',
    ],
    howCalculatedMarkdown:
      'Barbados PAYE applies after the BDS$25,000/year ($2,083.33/mo) personal allowance. Tax is 12.5% on the first BDS$50,000 of taxable income and 28.5% on excess taxable income.',
    faqs: [
      {
        question: 'What is the personal tax allowance in Barbados?',
        answer: 'The statutory personal allowance in Barbados is BDS$25,000 per year (BDS$2,083.33 per month).',
      },
    ],
    relatedCalculators: [
      { name: 'Barbados NIS Calculator', path: '/nis-calculator-barbados', description: 'NIS contributions.' },
      { name: 'Barbados Salary Calculator', path: '/salary-calculator-barbados', description: 'Gross to net pay.' },
    ],
  },
  {
    slug: 'salary-calculator-barbados',
    path: '/salary-calculator-barbados',
    calculatorType: 'salary',
    countryCode: 'BB',
    countryName: 'Barbados',
    countryFlag: '🇧🇧',
    currency: 'BBD',
    currencySymbol: 'BDS$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Barbados Salary Calculator',
    shortDescription:
      'Calculate net take-home salary in Barbados after 11.10% NIS deductions and BRA PAYE income tax.',
    seoTitle: 'Barbados Salary Calculator – Gross to Net Pay | Sheetpay',
    seoDescription:
      'Calculate your Barbados net salary on Sheetpay. Includes 11.10% NIS, BRA PAYE, and statutory deductions.',
    primaryKeyword: 'salary calculator barbados',
    secondaryKeywords: ['barbados salary calculator', 'take home pay barbados', 'net salary barbados'],
    defaultEarnings: 5000,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Barbados', path: '/barbados' },
      { name: 'Salary Calculator', path: '/salary-calculator-barbados' },
    ],
    howToUseSteps: ['Enter your gross salary.', 'Review your itemized deductions and net take-home pay.'],
    howCalculatedMarkdown: 'Net pay equals Gross Salary minus 11.10% NIS (up to $5,200/mo) minus BRA PAYE tax.',
    faqs: [{ question: 'How is take-home pay calculated in Barbados?', answer: 'Gross pay minus 11.10% employee NIS minus BRA PAYE tax.' }],
    relatedCalculators: [
      { name: 'Barbados NIS Calculator', path: '/nis-calculator-barbados', description: 'NIS calculator.' },
      { name: 'Barbados PAYE Calculator', path: '/paye-calculator-barbados', description: 'PAYE calculator.' },
    ],
  },
  {
    slug: 'payroll-calculator-barbados',
    path: '/payroll-calculator-barbados',
    calculatorType: 'payroll',
    countryCode: 'BB',
    countryName: 'Barbados',
    countryFlag: '🇧🇧',
    currency: 'BBD',
    currencySymbol: 'BDS$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Barbados Payroll Calculator',
    shortDescription:
      'Calculate employer payroll expenses, 12.75% employer NIS contributions, and employee net pay in Barbados.',
    seoTitle: 'Barbados Payroll Calculator – Employer Cost & Taxes | Sheetpay',
    seoDescription: 'Calculate Barbados employer payroll cost, NIS contributions, and employee pay on Sheetpay.',
    primaryKeyword: 'payroll calculator barbados',
    secondaryKeywords: ['barbados payroll calculator', 'employer cost barbados', 'payroll tax barbados'],
    defaultEarnings: 8000,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Barbados', path: '/barbados' },
      { name: 'Payroll Calculator', path: '/payroll-calculator-barbados' },
    ],
    howToUseSteps: ['Enter gross salary to view total employer burden and net pay.'],
    howCalculatedMarkdown: 'Employer cost is gross salary plus 12.75% employer NIS (up to $5,200/month cap).',
    faqs: [{ question: 'What is the employer NIS rate in Barbados?', answer: 'Employer NIS is 12.75% of insurable earnings up to BDS$5,200/month.' }],
    relatedCalculators: [
      { name: 'Barbados NIS Calculator', path: '/nis-calculator-barbados', description: 'NIS contributions.' },
    ],
  },
  {
    slug: 'take-home-pay-calculator-barbados',
    path: '/take-home-pay-calculator-barbados',
    calculatorType: 'take-home',
    countryCode: 'BB',
    countryName: 'Barbados',
    countryFlag: '🇧🇧',
    currency: 'BBD',
    currencySymbol: 'BDS$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Barbados Take-Home Pay Calculator',
    shortDescription: 'Instant net take-home salary calculator for Barbados employees and professionals.',
    seoTitle: 'Barbados Take-Home Pay Calculator | Sheetpay',
    seoDescription: 'Calculate your exact net take-home pay in Barbados on Sheetpay.',
    primaryKeyword: 'take home pay calculator barbados',
    secondaryKeywords: ['barbados take home pay', 'net salary barbados'],
    defaultEarnings: 4500,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Barbados', path: '/barbados' },
      { name: 'Take-Home Pay', path: '/take-home-pay-calculator-barbados' },
    ],
    howToUseSteps: ['Enter gross earnings to view net take-home pay.'],
    howCalculatedMarkdown: 'Calculated as gross earnings minus 11.10% NIS and BRA PAYE.',
    faqs: [{ question: 'What is the NIS ceiling in Barbados?', answer: 'The insurable ceiling is BDS$5,200 per month.' }],
    relatedCalculators: [
      { name: 'Barbados NIS Calculator', path: '/nis-calculator-barbados', description: 'NIS calculator.' },
    ],
  },

  // SAINT LUCIA EXPANDED
  {
    slug: 'salary-calculator-st-lucia',
    path: '/salary-calculator-st-lucia',
    calculatorType: 'salary',
    countryCode: 'LC',
    countryName: 'Saint Lucia',
    countryFlag: '🇱🇨',
    currency: 'XCD',
    currencySymbol: 'EC$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Saint Lucia Salary Calculator',
    shortDescription: 'Calculate net take-home salary in Saint Lucia after 5% NIC and IRD PAYE deductions.',
    seoTitle: 'Saint Lucia Salary Calculator – Gross to Net Pay | Sheetpay',
    seoDescription: 'Calculate Saint Lucia net salary on Sheetpay. Includes NIC deductions and IRD tax bands.',
    primaryKeyword: 'salary calculator st lucia',
    secondaryKeywords: ['st lucia salary calculator', 'take home pay st lucia', 'saint lucia net pay'],
    defaultEarnings: 6000,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Saint Lucia', path: '/saint-lucia' },
      { name: 'Salary Calculator', path: '/salary-calculator-st-lucia' },
    ],
    howToUseSteps: ['Enter your gross salary in EC$ to calculate net pay.'],
    howCalculatedMarkdown: 'Net pay equals gross salary minus 5% NIC (max EC$250/mo) minus IRD PAYE tax.',
    faqs: [{ question: 'What is the NIC rate in Saint Lucia?', answer: 'Employee NIC is 5% up to a monthly salary of EC$5,000 (max EC$250/month).' }],
    relatedCalculators: [
      { name: 'Saint Lucia PAYE Calculator', path: '/paye-calculator-st-lucia', description: 'PAYE tax calculator.' },
    ],
  },
  {
    slug: 'payroll-calculator-st-lucia',
    path: '/payroll-calculator-st-lucia',
    calculatorType: 'payroll',
    countryCode: 'LC',
    countryName: 'Saint Lucia',
    countryFlag: '🇱🇨',
    currency: 'XCD',
    currencySymbol: 'EC$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Saint Lucia Payroll Calculator',
    shortDescription: 'Calculate total employer payroll cost and 5% matching NIC contributions in Saint Lucia.',
    seoTitle: 'Saint Lucia Payroll Calculator – Employer Cost & NIC | Sheetpay',
    seoDescription: 'Calculate Saint Lucia payroll expenses, NIC matching, and net salaries on Sheetpay.',
    primaryKeyword: 'payroll calculator st lucia',
    secondaryKeywords: ['st lucia payroll calculator', 'saint lucia employer cost', 'nic payroll st lucia'],
    defaultEarnings: 7500,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Saint Lucia', path: '/saint-lucia' },
      { name: 'Payroll Calculator', path: '/payroll-calculator-st-lucia' },
    ],
    howToUseSteps: ['Enter employee gross pay to view total cost to employer.'],
    howCalculatedMarkdown: 'Employer cost is gross salary plus 5% employer matching NIC (up to EC$250/mo).',
    faqs: [{ question: 'What is the employer NIC rate in Saint Lucia?', answer: 'Employers match 5% of insurable earnings up to EC$5,000/month.' }],
    relatedCalculators: [
      { name: 'Saint Lucia PAYE Calculator', path: '/paye-calculator-st-lucia', description: 'PAYE tax calculator.' },
    ],
  },
  {
    slug: 'take-home-pay-calculator-st-lucia',
    path: '/take-home-pay-calculator-st-lucia',
    calculatorType: 'take-home',
    countryCode: 'LC',
    countryName: 'Saint Lucia',
    countryFlag: '🇱🇨',
    currency: 'XCD',
    currencySymbol: 'EC$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Saint Lucia Take-Home Pay Calculator',
    shortDescription: 'Calculate your exact net take-home salary in Eastern Caribbean Dollars (EC$).',
    seoTitle: 'Saint Lucia Take-Home Pay Calculator | Sheetpay',
    seoDescription: 'Calculate Saint Lucia take-home pay after NIC and PAYE taxes on Sheetpay.',
    primaryKeyword: 'take home pay calculator st lucia',
    secondaryKeywords: ['st lucia take home pay', 'net salary saint lucia'],
    defaultEarnings: 4800,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Saint Lucia', path: '/saint-lucia' },
      { name: 'Take-Home Pay', path: '/take-home-pay-calculator-st-lucia' },
    ],
    howToUseSteps: ['Enter gross salary to view take-home cash.'],
    howCalculatedMarkdown: 'Calculated as gross earnings minus 5% NIC and IRD PAYE.',
    faqs: [{ question: 'How much is the tax-free allowance in Saint Lucia?', answer: 'The tax-free personal allowance is EC$25,000 per year.' }],
    relatedCalculators: [
      { name: 'Saint Lucia PAYE Calculator', path: '/paye-calculator-st-lucia', description: 'PAYE tax calculator.' },
    ],
  },

  // BELIZE EXPANDED
  {
    slug: 'paye-calculator-belize',
    path: '/paye-calculator-belize',
    calculatorType: 'paye',
    countryCode: 'BZ',
    countryName: 'Belize',
    countryFlag: '🇧🇿',
    currency: 'BZD',
    currencySymbol: 'BZ$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Belize PAYE Income Tax Calculator',
    shortDescription: 'Calculate Belize PAYE income tax with BZ$20,000 standard allowance and 25% flat rate.',
    seoTitle: 'Belize PAYE Calculator – Income Tax & Withholding | Sheetpay',
    seoDescription: 'Calculate Belize PAYE tax on Sheetpay. Includes BZ$20,000 standard deduction and low-income exemption rules.',
    primaryKeyword: 'paye calculator belize',
    secondaryKeywords: ['belize paye calculator', 'belize income tax calculator', 'paye tax belize'],
    defaultEarnings: 4000,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Belize', path: '/belize' },
      { name: 'PAYE Calculator', path: '/paye-calculator-belize' },
    ],
    howToUseSteps: ['Enter gross income in BZ$ to view statutory PAYE withholding.'],
    howCalculatedMarkdown: 'Tax is 25% on taxable income over BZ$20,000/year if gross exceeds BZ$26,000/year.',
    faqs: [{ question: 'What is the income tax rate in Belize?', answer: 'A flat 25% rate on taxable income over BZ$20,000/yr for earnings above BZ$26,000/yr.' }],
    relatedCalculators: [
      { name: 'Belize Income Tax Calculator', path: '/income-tax-calculator-belize', description: 'Income tax calculator.' },
    ],
  },
  {
    slug: 'salary-calculator-belize',
    path: '/salary-calculator-belize',
    calculatorType: 'salary',
    countryCode: 'BZ',
    countryName: 'Belize',
    countryFlag: '🇧🇿',
    currency: 'BZD',
    currencySymbol: 'BZ$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Belize Salary Calculator',
    shortDescription: 'Calculate net take-home salary in Belize after Social Security (SSB) and PAYE income tax.',
    seoTitle: 'Belize Salary Calculator – Gross to Net Pay | Sheetpay',
    seoDescription: 'Convert gross salary to net pay in Belize on Sheetpay. Fast, accurate, and free.',
    primaryKeyword: 'salary calculator belize',
    secondaryKeywords: ['belize salary calculator', 'take home pay belize', 'net pay belize'],
    defaultEarnings: 3200,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Belize', path: '/belize' },
      { name: 'Salary Calculator', path: '/salary-calculator-belize' },
    ],
    howToUseSteps: ['Enter your gross salary in BZ$ to calculate net pay.'],
    howCalculatedMarkdown: 'Net pay equals gross salary minus SSB contribution minus PAYE income tax.',
    faqs: [{ question: 'What is the Social Security rate in Belize?', answer: 'SSB contributions follow weekly wage brackets up to BZ$21.84/week maximum for employees.' }],
    relatedCalculators: [
      { name: 'Belize Income Tax Calculator', path: '/income-tax-calculator-belize', description: 'Income tax calculator.' },
    ],
  },
  {
    slug: 'payroll-calculator-belize',
    path: '/payroll-calculator-belize',
    calculatorType: 'payroll',
    countryCode: 'BZ',
    countryName: 'Belize',
    countryFlag: '🇧🇿',
    currency: 'BZD',
    currencySymbol: 'BZ$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Belize Payroll Calculator',
    shortDescription: 'Calculate employer Social Security liability and total payroll expense in Belize.',
    seoTitle: 'Belize Payroll Calculator – Employer Cost & SSB | Sheetpay',
    seoDescription: 'Calculate Belize employer payroll cost, SSB contributions, and employee pay on Sheetpay.',
    primaryKeyword: 'payroll calculator belize',
    secondaryKeywords: ['belize payroll calculator', 'employer cost belize', 'ssb payroll belize'],
    defaultEarnings: 6000,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Belize', path: '/belize' },
      { name: 'Payroll Calculator', path: '/payroll-calculator-belize' },
    ],
    howToUseSteps: ['Enter gross salary to view employer SSB obligations.'],
    howCalculatedMarkdown: 'Employer cost is gross salary plus employer SSB contribution (up to BZ$24.96/week).',
    faqs: [{ question: 'How much does an employer contribute to SSB in Belize?', answer: 'Employers contribute up to BZ$24.96/week (BZ$108.16/month) at the top wage bracket.' }],
    relatedCalculators: [
      { name: 'Belize Income Tax Calculator', path: '/income-tax-calculator-belize', description: 'Income tax calculator.' },
    ],
  },
  {
    slug: 'take-home-pay-calculator-belize',
    path: '/take-home-pay-calculator-belize',
    calculatorType: 'take-home',
    countryCode: 'BZ',
    countryName: 'Belize',
    countryFlag: '🇧🇿',
    currency: 'BZD',
    currencySymbol: 'BZ$',
    taxYear: 2026,
    lastUpdated: 'August 2026',
    h1: 'Belize Take-Home Pay Calculator',
    shortDescription: 'Calculate your exact net take-home salary in Belize Dollars (BZ$).',
    seoTitle: 'Belize Take-Home Pay Calculator | Sheetpay',
    seoDescription: 'Calculate Belize net take-home pay after SSB and income tax deductions on Sheetpay.',
    primaryKeyword: 'take home pay calculator belize',
    secondaryKeywords: ['belize take home pay', 'net salary belize'],
    defaultEarnings: 2800,
    defaultFrequency: 'monthly',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Calculators', path: '/calculators' },
      { name: 'Belize', path: '/belize' },
      { name: 'Take-Home Pay', path: '/take-home-pay-calculator-belize' },
    ],
    howToUseSteps: ['Enter gross earnings to view net take-home pay.'],
    howCalculatedMarkdown: 'Calculated as gross earnings minus SSB and PAYE tax.',
    faqs: [{ question: 'Is salary under $26,000/year taxed in Belize?', answer: 'No, annual salary up to BZ$26,000 is 100% tax-free.' }],
    relatedCalculators: [
      { name: 'Belize Income Tax Calculator', path: '/income-tax-calculator-belize', description: 'Income tax calculator.' },
    ],
  },
];

export const ALL_CALCULATORS: CalculatorPageConfig[] = [
  ...PRIORITY_CALCULATORS,
  ...EXPANDED_CALCULATORS,
];

export function getCalculatorByPath(path: string): CalculatorPageConfig | undefined {
  const normalized = path.replace(/\/$/, '') || '/';
  return ALL_CALCULATORS.find((c) => c.path === normalized);
}

export function getCalculatorsByCountry(countryCode: CountryCode): CalculatorPageConfig[] {
  return ALL_CALCULATORS.filter((c) => c.countryCode === countryCode);
}
