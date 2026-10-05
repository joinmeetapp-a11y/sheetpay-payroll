# Kurt Prince private LinkedIn automation

Implementation date: 5 October 2026. This code is prepared locally for review.
It has not been pushed or deployed, and no real LinkedIn post has been published.

The frontend belongs to joinmeetapp-a11y/Sheetpay-Payslip-. The production Convex
backend belongs to joinmeetapp-a11y/sheetpay-payroll. The source revisions inspected
were frontend 579d75b8305a848de674970bbccb538411cb3efb and backend
8d8ac185007c63e06bdbdc64e26bf60f35c1bf4a.

## What is implemented

Protected routes: /admin/social, /admin/social/history, /admin/social/topics and
/admin/social/settings. The existing admin Firebase session and bootstrap remain
in use. Every public social query, mutation and action verifies the admin role on
the server and binds the verified Firebase email to the admin record. Finance, support, analytics, anonymous and ordinary users cannot use
the module. Scheduled actions revalidate the social owner's admin role.

Initial settings are Test Mode ON, Posting Enabled OFF, Approval Required ON,
10:00 AM America/Port_of_Spain, all seven days enabled, and generation 30 minutes
before posting. The minute dispatcher understands local dates and timezone
offsets, DST gaps and repeated minutes, and generation across midnight. It
deduplicates each daily post using a transactional day key.

Twenty story categories are seeded. Generation retrieves 30 recent captions,
hooks, phrases, lessons, angles, hashtags and Sheetpay/link flags. It applies
lexical checks, embedding similarity and a separate semantic/factual review.
Generation retries at most three times and fails without publishing. Sheetpay
mentions are limited to at most one in four posts and links to at most one in
seven. Captions are validated for 6–8 short sentences and 3–5 final hashtags.

The deterministic React/Satori card renders through bundled resvg WebAssembly
inside a Convex Node action. No browser service, external font fetching, stock
backgrounds or image generator is used. The card is 1200 × 1200 with a near-black
background and fixed profile header. Font metrics drive wrapping and dynamic
font sizes. Content that cannot fit safely is rejected. The PNG is also checked
for visible portrait pixels so a silently missing portrait cannot be published.
Real image bytes are detected independently of an incorrect filename or MIME.
The original portrait is displayed with a circular crop; its face is never
regenerated, retouched or transformed.

Kurt's supplied portrait is available separately in the private setup folder of
the review package. Upload it once through Social Settings after deployment.
It is not committed into either repository or served as a public frontend asset.
Portraits and generated PNGs are stored in Convex storage; previews require an
admin-authenticated /social/image HTTP request. No public storage URL is returned
to the browser.

Editing clears approval and invalidates the image revision. Regenerating image
text also renders the matching PNG. Publication requires a current image,
matching portrait, valid approval under the current policy and a connected
LinkedIn account. Test Mode stops before credential decryption, upload
initialization, image upload and post creation.

The module stores post IDs, safe post URLs, provider status/request IDs,
generation attempts and sanitized errors. It does not store provider response
bodies in logs. Publication uses a transactional claim plus a persisted
outbound-request marker. A crash, timeout, 5xx, uncertain 408 response or accepted
response without a usable ID is never blindly retried. With the requested
write-only member permission, private post readback is unavailable; the admin
must inspect LinkedIn and explicitly reconcile an uncertain outcome before
retrying. Known request rejections permit retry. Upload failure never falls back
to a text-only post.

Basic analytics explicitly cover the latest 500 posts/events. Full histories
remain in the database. Approval notifications use a separate social category
in the existing internal notification center; customer/payroll emails are not
sent by this module.

## Server environment configuration

Set these in the production Convex deployment, using the existing secrets
approach. Never use VITE-prefixed variants or paste secrets into a caption,
browser configuration or GitHub commit.

| Variable | Configuration |
| --- | --- |
| OPENAI_API_KEY | Reuse the existing server-side key |
| LINKEDIN_CLIENT_ID | Developer App client ID |
| LINKEDIN_CLIENT_SECRET | Developer App secret |
| LINKEDIN_REDIRECT_URI | https://sheetpay.app/admin/social/settings |
| LINKEDIN_API_VERSION | 202609, configurable for future supported releases |
| SOCIAL_TOKEN_ENCRYPTION_KEY | A base64-encoded, randomly generated 32-byte key |
| SOCIAL_OPENAI_MODEL | Optional; defaults to gpt-4o |
| SOCIAL_APP_ORIGIN | https://sheetpay.app |
| SOCIAL_LIVE_PUBLISH_APPROVED | Keep false for the initial rollout |

Generate the encryption key with a cryptographically secure random generator.
Back it up securely: existing encrypted LinkedIn tokens require the same key.
If the key is changed without migrating credentials, disconnect and reconnect.
Access/refresh tokens are AES-256-GCM encrypted with owner binding. LinkedIn
tokens are stored only in the private database, not environment variables,
frontend state or API responses.

No new frontend secrets are needed. The existing
VITE_ACCOUNTANT_CONVEX_URL and accountant Firebase configuration are reused.

## LinkedIn Developer App configuration

1. Create/configure a LinkedIn Developer App for this private tool. Complete the
   Developer Portal's required app/Page ownership and verification steps.
2. Request the Share on LinkedIn and Sign in with LinkedIn using OpenID Connect
   products. Confirm that openid, profile and w_member_social are available.
   Email, organization publishing, analytics and restricted read permissions
   are not requested.
3. Add exactly https://sheetpay.app/admin/social/settings to the authorized
   OAuth redirect URLs.
4. Configure the client ID and secret on Convex, then use Connect LinkedIn while
   signed into Sheetpay Admin and Kurt's intended LinkedIn profile.
5. Connection tests use the official userinfo endpoint. Review the account name
   shown in Settings before any live test.

The integration uses LinkedIn's confidential web authorization-code flow with a
server-side client secret, a random single-use hashed state, a ten-minute expiry,
admin/user binding and an additional browser session-state check. OAuth codes are
exchanged server-side and removed from the browser URL. LinkedIn documents native
PKCE as a separately enabled flow with loopback redirects; unsupported native
PKCE parameters are not added to the web OAuth endpoints.

Official endpoints are /oauth/v2/authorization, /oauth/v2/accessToken,
/v2/userinfo, /rest/images?action=initializeUpload, the returned HTTPS image
upload URL, and /rest/posts. Versioned requests include LinkedIn-Version and
X-Restli-Protocol-Version. Person authors are built from the authenticated
userinfo subject, never an arbitrary client-supplied member ID.

LinkedIn currently documents a 60-day access-token lifespan; the actual
expires_in response is authoritative. Refresh is used only if LinkedIn actually
issues a refresh token with a valid remaining lifetime. Otherwise Settings asks
for reconnecting. Revoked tokens fail safely. Disconnect deletes local encrypted
credentials and turns posting off; revoke the app grant in LinkedIn as well if
you want LinkedIn to revoke authorization.

Official documentation checked:

- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow-native
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-09
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-06
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens
- https://docs.convex.dev/functions/bundling

## Verification and limits

Passing checks:

- Frontend TypeScript/lint and production build.
- Convex/shared/tests TypeScript via npm run check:convex.
- Backend production build.
- Offline social backend bundling using Convex's own WASM loader.
- 30 social tests covering generation, 30-post history, similarity, grounding
  review, rendering/overflow/portrait visibility, credential encryption, OAuth
  exchange/state replay, token expiry, image upload/post payloads, retry behavior,
  authorization, DST, midnight generation, approval and automatic test mode.
- 10 social desktop/mobile browser tests.
- 20 existing backend admin, private bulk-email and privacy/security tests.
- 40 existing frontend admin, pricing, bulk PDF, print and email browser tests.
- A visually inspected PNG rendered using Kurt's actual supplied portrait.

Total: 100 passing tests. OpenAI and LinkedIn network responses in the automated
tests are fixtures. Real credentialed OpenAI generation, LinkedIn authorization
and the first live upload/post still need to be checked after app configuration.
No real LinkedIn account connection or publishing was claimed to have passed.

The backend repository's full npm run lint reports 13 pre-existing TypeScript
errors in its legacy src UI, involving App, Header, GuestAccountantExperience
and PayslipsPortalView. The same errors were reproduced on the unchanged
baseline. They were not suppressed or fixed through payroll changes. The
Convex/backend module check passes. Both repository production builds pass.

The Convex CLI code-generation attempt was rejected by automatic approval
review because it attempted unapproved Sentry telemetry. The new API declaration
entries were prepared offline; TypeScript and offline bundling then verified
them. No rejected network operation was retried or bypassed. A real Convex
deployment validation is still pending approval.

## Approval and deployment order

No remote branch, commit, PR, deployment, secret or LinkedIn post was modified.

After Kurt approves pushing and deployment:

1. Recheck the current remote revisions and apply only this module's reviewed
   changes, preserving any newer Sheetpay work.
2. Push the backend changes through the existing repository workflow.
3. Update the frontend workflow's pinned accountant-backend ref to the actual
   approved backend commit before pushing the frontend. Do not leave its old
   pinned ref in place: it would redeploy the old backend and remove the new
   social functions.
4. Configure server secrets with SOCIAL_LIVE_PUBLISH_APPROVED=false. Deploy the
   relevant Convex changes and Firebase frontend through the existing workflow.
5. Open /admin/social, upload the provided original portrait, connect LinkedIn,
   test the identity connection, generate a draft and run Test Publish Now.
6. Keep Test Mode ON, Posting Enabled OFF and Approval Required ON. Stop if
   production authorization, generation or rendering checks fail.
7. Only after a separate explicit approval of the first live post, set the
   server live-publishing gate to true, turn Test Mode off, approve the reviewed
   draft and use Publish Now with scheduled posting still disabled.
8. Verify the returned LinkedIn post and image. Daily automatic publishing can
   then be enabled deliberately in Settings.

The full legacy-UI lint issue remains a documented repository check limitation
and must be resolved or accepted through a separately reviewed repository fix
before claiming all repository lint checks pass.
