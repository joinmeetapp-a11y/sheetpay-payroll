# Booking page and widget designs

The Accountant dashboard connected to `sheetpay.app/accountant` now offers six booking page layouts and six website widget styles. This extends the current practice profile and keeps the payroll, filing-pack, booking, lead capture, availability, QR/link and client-portal flows.

| Booking page | Structure |
| --- | --- |
| Signature Split | Cover and practice/services column beside the booking form |
| Editorial | Magazine masthead, serif headline, numbered service list and appointment column |
| Spotlight | Full-width hero with image/brand artwork, overlapping form and service list |
| Executive | Vertical brand rail, service directory and appointment desk |
| Quiet Minimal | Centered identity, service pills and one focused booking column |
| Studio Grid | Asymmetric bento introduction, booking card and individual service tiles |

| Widget | Structure |
| --- | --- |
| Classic Chat | Brand-colored header, conversation and rounded launcher |
| Concierge | Personal practice card, service directory and asymmetric launcher |
| Voice Desk | Centered voice-inspired introduction, orb and circular launcher |
| Text Minimal | Compact messenger with subtle header and rectangular text launcher |
| Service Cards | Service grid above the conversation, with a card-style launcher |
| Compact Dock | Slim dark identity bar and small square launcher |

## Use

Open Booking Pages or Website Widget in the existing Accountant sidebar. Choose a design card. Logo, headline, description, services and brand color update immediately in Live Design Preview without saving or calling booking/chat APIs. Choose Desktop or Mobile, or Expand preview. On mobile, View live preview scrolls directly to it. Expanded preview supports keyboard focus, Escape and a close control.

The preview deliberately uses example appointment times. It never creates an appointment, sends a message, requests microphone access, or writes a lead. Published pages retain the actual availability, consent, anti-spam, inquiry and booking controls. Selecting a service in either the published design or its preview opens that service in the booking panel.

Save changes preserves draft/publication state. Publish page & widget retains the existing publication action. The shared PracticeDesign component renders both the saved public design and the unsaved dashboard preview. The public booking link and downloadable QR code continue to point at the same `/book/<slug>` URL and open in a new tab.

After changing a widget style, save/publish and copy the updated embed code to the existing website. The iframe uses the saved style. The loader's new `data-layout` attribute styles its launcher; old snippets without that attribute keep the classic launcher. Existing position and color attributes, allowed origins, lazy iframe loading, keyboard close, voice/chat and booking behaviors remain in place. No new public data endpoint is added.

## Backward compatibility and deployment

The backend adds only optional `bookingLayout` and `widgetLayout` profile fields. Existing profiles render Signature Split / Classic Chat. Existing clients that omit the fields do not reset saved design choices. Unsupported saved IDs are rejected server-side; public renderers have safe legacy fallbacks. No data backfill is required. Role checks and workspace isolation use the existing profile-save authorization.

Deploy the backend before the frontend, so saved design fields are accepted. Both feature branches are `feat/booking-widget-layouts-20261118`, based on the reviewed country-filing-pack release (frontend d4e4a3f, backend c2cb62b). Existing deployment settings stay unchanged: Convex `prod:clear-avocet-926`, browser URL `https://clear-avocet-926.convex.cloud`, Firebase Hosting `myglowtext`. Use `scripts/deploy-practice-designs.sh`; dependencies and fresh checkouts go to `/tmp` to avoid the Cloud Shell home-disk limit. No development/verification workflow deploys to production.
