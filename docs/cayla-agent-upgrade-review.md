# Cayla agent upgrade review

Status: implemented and verified locally. No changes have been published or deployed. Production diagnosis and real OpenAI integration checks remain pending because automatic approval review rejected both GitHub uploads.

## Production error

The precise root cause of the reported production `caylaAgentActions:request` failure has not been established. No production runtime logs or authenticated reproduction were available locally. It would be incorrect to attribute the screenshot's generic Convex error to one specific cause.

The existing code had these verified defects:

1. `beginRequest` executed outside the error handler. Authentication, workspace/context validation and quota errors therefore escaped directly as Convex failures.
2. Non-shortcut instructions used unconstrained JSON parsing from Chat Completions. Optional null fields and unexpected properties could fail the downstream Convex validator. No structured function schema governed the model output.
3. Failures had no request-level stage diagnostics or provider request correlation.
4. Transcription used a smaller model without payroll or name hints, had no request timeout, and exposed provider/configuration error details.

The implementation fixes those failure paths. It does not merely conceal the old error. A read-only CI diagnostic checks the existing production logs and provider configuration before release; that diagnostic has not run yet.

## Architecture

Recorded microphone audio → authenticated Convex transcription → editable transcript → explicit Send → Responses API reasoning and structured tools → independent Convex ownership/role/argument/usage validation → existing payroll and statutory engine → proposal/review cards → explicit approval → existing payroll persistence, email review and export components.

The model cannot call a payroll approval mutation or send a bulk email. Payroll adjustments, exclusions and overtime acknowledgements live in a proposed run. Employee master records are not changed by those proposals. Approval saves calculated snapshots through the existing payroll run implementation.

A Convex session stores the active command ID per actor and workspace. Context is reconstructed from authorized records, rather than resending a complete conversation or database. Follow-up amendments inherit the active period and proposed adjustments. A newer proposal supersedes the older unapproved review. "Run it" displays the active review; it never bypasses approval.

Exact reminders use the existing timezone conversion, scheduler and idempotency key. Existing finalized payslips are reused for download/print actions rather than creating another payroll run.

## API defaults

| Purpose | API | Default |
| --- | --- | --- |
| Reasoning | `POST /v1/responses`, strict function tools | `gpt-5.4-mini`, low reasoning effort |
| Recorded transcription | `POST /v1/audio/transcriptions` | `gpt-transcribe`, language and payroll/name hints |
| Spoken responses | `POST /v1/audio/speech` | `gpt-4o-mini-tts`, synthetic `marin` voice |

These choices were checked against current official OpenAI documentation. They are defaults in source, not a claim that production configuration or account access has been verified. Backend model/voice settings can override them. The voice is a synthetic adult character and does not imitate a real person.

Official references:

- https://developers.openai.com/api/docs/guides/speech-to-text
- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/guides/text-to-speech
- https://developers.openai.com/api/docs/models/gpt-5.4-mini

## Safeguards

- Existing Firebase authentication and workspace role checks are reused and independently enforced server-side.
- Client IDs, employee ownership and selected record context are validated before reads or preparation.
- Model tools have strict schemas plus local runtime validation, bounded output and a six-turn deadline.
- Ambiguous employee names create a clarification, not a proposed financial change.
- Existing payroll/statutory functions remain the calculation source of truth. No formulas were changed.
- Existing stale-data fingerprints, quota enforcement, transactional approval and idempotency remain active.
- Requests and pipeline stages have trace diagnostics. Logs contain IDs, counts, status and timings, not transcripts, salaries, documents or secrets.
- API keys and agent instructions stay out of browser code. Uploaded text is treated as untrusted data.
- Voice responses use private storage, an authenticated read path, a generation lease and cached audio. Temporary voice and explanation content expires independently of payroll history.
- Recording errors and cancellation preserve typed instructions. Transcription does not submit the payroll instruction automatically.
- Mia hides when it would intersect Cayla's input or result/approval cards.

## Verification

| Check | Result |
| --- | --- |
| Backend unit tests | 175 passed across 12 files |
| Cayla unit tests | 44 passed, including tool calling, names, ambiguity, follow-ups, proposal edits, approval, statutory delegation, exceptions, emails, reminders, unauthorized access, failures and retries |
| Main desktop/mobile browser suite | 160 initially passed; four compliance export cases needed locally missing production templates |
| Compliance rerun after restoring existing assets | All 16 passed, including those four export cases |
| Distinct main browser cases verified across those runs | 164 |
| Social desktop/mobile regression suite | 10 passed |
| Accountant frontend TypeScript/lint | Passed |
| Convex backend TypeScript | Passed |
| Cayla action bundle | Passed |
| Accountant production build | Passed; existing large-chunk warning remains |
| Backend repository's separate legacy UI full lint | Fails with 13 pre-existing errors; identical output on the unchanged baseline |
| Live provider / microphone accuracy | Not verified; backend tests use mocked provider responses and browser tests use mocked recordings |
| Production root cause and release | Not verified; publication blocked |

Mobile screenshots and interaction checks were inspected. The existing controls, enlarged fixed input, review actions, editable voice transcript and support positioning remain usable at narrow widths. Missing local mascot/support image assets were restored from the existing production site without changing their repository source.

## Files changed

Backend repository `joinmeetapp-a11y/sheetpay-payroll`:

- `convex/ai.ts`
- `convex/caylaAgent.ts`
- `convex/caylaAgentActions.ts`
- `convex/caylaAgentSchema.ts`
- `convex/lib/caylaAgentPolicy.ts`
- `convex/lib/caylaReasoning.ts`
- `convex/privacyRetention.ts`
- `tests/caylaAgent.test.ts`
- `tests/fixtures/caylaLegacyIntent.ts` — regression-only helper; regex interpretation is removed from the production request pipeline.
- `scripts/verify-cayla-provider.ts`
- `docs/cayla-agent-upgrade-review.md`

Frontend repository `joinmeetapp-a11y/Sheetpay-Payslip-`:

- `src/components/accountant/CaylaWorkspace.tsx`
- `src/components/MiaWidget.tsx`
- `tests/browser/cayla.spec.ts`
- `tests/browser/mock-convex.tsx`
- `.github/workflows/firebase-hosting-merge.yml` — adds a read-only preflight; no deployment performed.
- `scripts/diagnose-cayla-provider.mjs`

## Release work remaining

1. Explicit authorization for publishing the reviewed source to both repository destinations. GitHub reports the backend as public and the frontend as private; automatic review rejected both uploads, describing both as public.
2. Run the read-only production diagnostic and synthetic speech/transcription/reasoning checks. Investigate and fix any failures; establish the existing production error cause where logs allow.
3. Publish the reviewed backend revision and update the existing frontend production workflow's backend commit pin to that revision. The production pin remains unchanged until an approved backend commit exists.
4. Run the existing CI checks, deploy through the existing Convex/Firebase workflow, and verify production without deleting or resetting data.
5. Perform an actual microphone test of the requested instruction sequence. A synthetic audio check cannot establish the accuracy of the user's real microphone, accent or environment.

No Firebase project, Convex project, repository, separate application, subscription flow or statutory formula was created or replaced.
