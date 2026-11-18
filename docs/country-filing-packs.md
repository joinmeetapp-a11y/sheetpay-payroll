# Country filing packs — 18 November 2026

Extends the existing compliance module; does not submit returns, pay authorities, send employees mail, change tax rates, or replace TD4/IT76/TAMIS. New branch is based on `feat/accountant-practice-portal-20261118` (33c99f0), which includes the Accountant I/O optimizations. Frontend is based on the payslip-design release (752ecde).

## Scope verified against the application

The Accountant country picker supports TT, BB, BZ, LC, JM, GD, DM, GY, US, CA, GB and AU. The existing compliance registry covers TT, BB, LC and BZ only. This release extends those four; it does not advertise filing support for the other eight.

## Country/form coverage

| Country | Output | Availability and blocker |
| --- | --- | --- |
| Trinidad & Tobago | NI 184 employee contribution statement | Official NIBTT PDF populated; original legal landscape size. Eleven employees per sheet with overflow onto fresh official sheets. Reporting year 2026 only. Requires reviewed weeks, employee/employer shares, earnings, identifiers, dates and employer contact/service centre. |
| Trinidad & Tobago | NI 187 contributions due/in arrears | Original two-page NIBTT PDF. Monthly employee+employer totals reconcile to NI 184; opening balance, penalty, interest and actual amount paid are explicitly reviewed. Method of payment, declaration, signature, official use and reverse payment details remain for the authorized preparer. |
| Trinidad & Tobago | TD4 and IT76 | Existing generators and immutable historical snapshots retained. Existing reviewed classifications remain required. |
| Trinidad & Tobago | Monthly PAYE/Health Surcharge | Purpose verified at IRD PAYE; current official monthly return/upload schema not obtained. Separate PAYE/Health Surcharge preparation reports remain available; excluded from a complete official pack. |
| Barbados | TAMIS PAYE | Existing official workbook and XML value population retained. Monthly classifications, 13-digit TINs and source reconciliation remain required. |
| Barbados | DP10 certificate and NIS schedule | Official download is a single-page cover. Current employee schedules for both four/five Mondays and category mapping not obtained. Computerised listing requires NIS format clearance. Calendar correctly lists real Mondays but never invents contribution weeks. Contribution preparation report available. |
| Saint Lucia | TD5, TD6 annual remittance | Purpose confirmed in IRD guide/government notice. Current official layouts were not obtained from the maintenance-mode IRD site. Annual earnings/PAYE preparation reports available. |
| Saint Lucia | C3 monthly NIC | NIC describes employer-specific, monthly-issued schedules. Current blank layout/Director-approved electronic schema not obtained. Contribution preparation report available. |
| Belize | TD4 | Kept separate from TT TD4. BTS lists NewTD4Design_v1.xlsx; workbook bytes and field mapping not obtained/validated in this release. Annual employee preparation statement available. |
| Belize | IRIS PAYE | BTS confirms all-employee listing including TIN, name, emoluments and withholding. Current accepted upload workbook/schema not obtained; no generic CSV is called an IRIS upload. |
| Belize | FIN15A | Official PDF retrieved and hashed, but contains an April 2022 rate schedule. Current applicability plus paid-contribution/interest field rules not confirmed. Official generation blocked; contribution preparation output remains available. |

A partial pack is explicitly marked incomplete on screen, in its preparation PDF, history and ZIP READ-ME. No official form is fabricated. Populated NI PDFs are for accountant review; this release does not certify them as accepted government submissions.

## Official evidence

Checked 2026-11-18. Sources and immutable template hashes are in the frontend template manifest and the synchronized registries.

- NIBTT forms directory: https://www.nibtt.net/NI_Forms/NI_Forms_downloads_rev.html
- NI 184: https://www.nibtt.net/NI_Forms/NI184.pdf (legal landscape, employee weekly contribution values and salary)
- NI 187: https://www.nibtt.net/NI_Forms/NI%20187.pdf (balances, contributions due, payments, arrears; declarations/official-use fields)
- IRD PAYE: https://www.ird.gov.tt/PAYE
- Barbados NIS schedules/4–5 Mondays/clearance: https://www.nis.gov.bb/earnings-schedules-and-contributions/
- Barbados form download directory: https://www.nis.gov.bb/national-insurance-forms/
- DP10 cover: https://www.nis.gov.bb/?jet_download=ddad1cd8d897ba41fa9c907ca53d57359266628e
- Saint Lucia IRD employer guide: https://irdstlucia.gov.lc/images/Documents/Publications/Employers_PAYE_Guide_viewV.pdf
- TD6 purpose: https://www.govt.lc/news/employers-to-receive-annual-tax-return-information-bulletin-via-mail
- NIC C3: https://www.stlucianic.org/employers
- Belize BTS forms: https://bts.gov.bz/tax_resources/category/international-business-companies
- Belize PAYE requirements: https://bts.gov.bz/wp-content/uploads/2023/12/PAYE-Contract-GST-requirements-Ms-Lisa-002-Oct-20-23.pdf
- Belize FIN15A: https://www.socialsecurity.org.bz/wp-content/uploads/2022/04/FIN15A_2022_editable_F.pdf

## Data setup and backward-compatible migration

1. Deploy the additive backend first. Existing business fields and payroll snapshots are unchanged. New optional business fields: `compliancePhone`, `complianceServiceCentreCode`, `complianceRevision`. New indexed tables: `complianceSupportingData`, `complianceSettlements`, `complianceSupportAudit`. New generation fields `cacheKey` and `sourceRevision` are optional. Existing histories/rows continue to export from their saved config. No backfill or destructive rewrite is required.
2. Existing optimized performance projections/background scheduling remain in place. No polling or new scheduled jobs. Do not remove or reset existing performance migration markers.
3. Enter correct employer identifiers/address, telephone and (NI 184) NIBTT service centre code. NIBTT employer registration is six digits; employee NI numbers are nine digits. Existing generic identifier mapping is not guessed for other jurisdictions.
4. In Tax & Compliance, select client, year and month. Open each employee's source payroll references → Review contribution details. Enter first/surname, birth/start/end dates and actual Monday contribution weeks, category, weekly insurable earnings and employee/employer amounts. Unpaid/exempt weeks require explicit zero amounts and a reviewed reason. Contributions must reconcile to employee deductions and to employer amounts where already saved. A week cannot appear in two runs. Missing employment weeks block the contribution form. Current UI offers reviewed manual entry; no unreviewed bulk historical import is performed.
5. Historical records are supporting overlays tied to a specific saved payroll run version; they do not overwrite approved pay or recalculate historical tax. Future snapshots may carry optional `filingSupport` on each employee row; all payroll/Cayla save paths validate it against that reporting period. Saving supporting details against a draft run stores them on that draft snapshot. Approval preserves them. A changed payroll invalidates external reviewed support and requires re-review.
6. Cross-month/year supporting allocation is intentionally blocked rather than guessed: each supporting record must reconcile to its source payroll run and contain Mondays in its source reporting month. A run requiring a different authority allocation needs a reviewed split/allocation workflow before these official forms can be generated. Out-of-period contribution exceptions needing other statutory handling must be reviewed with the authority; no current-rate calculation is used as historical evidence.
7. For NI 187, review explicit opening balance, penalty, interest and actual amount paid from statements/receipts. The form computes total due and balance carried forward from those reviewed values and payroll contribution due; no payment is inferred. Section C and reverse payment instrument details are deliberately blank for manual completion.
8. Click Generate Filing Pack. The click snapshots the whole period once, downloads all eligible official files and a preparation report in ZIP, and lists each excluded form/reason. Individual generation/preview/download/print/history remain available. Annual legacy pack behavior is retained for historical compatibility.

## Security and resource behavior

Existing `requireBusinessAccess` roles and assignments are enforced on every public read/write and cache reuse. Generation/support/settlement changes require `editPayroll`; employee/employer identifier changes retain their existing capabilities. Pack and NI 187 totals cannot be restricted to selected employees. Supporting and export events are audited. Cayla uses the existing `generate_tax_compliance` confirmation tool, with new form IDs; it does not bypass review or submit.

Monthly payroll reads use `by_business_year_month`; year/employee/support rows use bounded pagination. Period classifications are bounded at 2,500 entries, with an explicit error on overflow. Source revisions invalidate cached generations atomically when payroll, employee, review or supporting facts change. Cache key includes the template config, selected employees, actual supporting details and source revision. Begin/complete checks retain source references and revision guards. A pack uses one aggregate/snapshot for all forms. Reuse still validates current data and permissions; it avoids duplicate generated rows, not all validation reads. No tenant-wide or global table scan was added.

## Deployment targets — unchanged

Frontend `.firebaserc` and `scripts/hosting-public-config.json` confirm Firebase Hosting `myglowtext` and Accountant backend `https://clear-avocet-926.convex.cloud`. Existing deployment docs confirm Convex `prod:clear-avocet-926`. The older `convex.json` project label is retained; the explicit deployment env file prevents guessing a target. Do not use the separate `caylaex` portal project for this release.

Use `scripts/deploy-filing-packs.sh` in the frontend checkout for exact copy/paste commands. It builds fresh checkouts in `/tmp`, keeping dependencies/npm cache off the nearly-full Cloud Shell home disk. Review both CI runs before executing. Nothing in development or CI deploys to production.
