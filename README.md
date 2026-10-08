# Ventorio

Equipment and supplies for classes and events: plan an event, get its packing list, scan what you pack, scan what comes back.

- **Templates** say what a kind of event needs, per attendee or per event (e.g. one adult manikin per two attendees, one AED trainer per three, one face shield each). An event scales its template to its headcount; quantities can be set by hand.
- **Equipment** is labelled and tracked unit by unit: available, out with an event, waiting to be cleaned, in repair, missing, retired. Each unit keeps its history.
- **Supplies** are counted: they come off stock when an event is packed, unused ones go back on return, and low stock is flagged.
- **Labels** carry a link, `https://<host>/t/<code>`, as a QR code and optionally on an NFC tag. Scanning works with:
  - the phone's camera, from the event page (QR codes and the maker's barcodes, matched by serial number);
  - NFC on Android, through Web NFC in Chrome (the page also writes tags);
  - NFC on iPhone, without an app: the iPhone reads the tag's link in the background and opens it. While you're packing or returning an event, opening a tag's link records the scan there.

## Stack

A Cloudflare Worker serving a React app (Vite, Tailwind, the Heimdall look with a berry accent) and an API (Hono) on a D1 database. People sign in through Cloudflare Access; the Worker checks the Access token on every API request. Everything fits Cloudflare's free plans for a chapter-sized team (up to 50 people in Access).

```
src/        React app (pages, components, camera and NFC scanning)
worker/     API: routes, Access check, D1 queries
shared/     Code used by both: packing-list scaling, label codes, API types
migrations/ D1 schema
test/       API tests, run in the Workers runtime against a local D1
```

## Develop

```sh
npm install
cp .dev.vars.example .dev.vars          # acts as dev@example.org instead of signing in
npm run db:migrate:local
npm run dev                             # http://localhost:5173
npm test
npm run typecheck
```

The development identity in `.dev.vars` only works on localhost; anywhere else the API refuses requests until Access is configured.

## Deploy

1. **Database.** `npx wrangler login`, then `npx wrangler d1 create ventorio`. Put the `database_id` it prints into `wrangler.jsonc`.
2. **Worker.** `npm run deploy` builds the app, applies migrations to the remote database, and deploys. Give the Worker a stable hostname (a custom domain under Workers → Settings → Domains & Routes) before printing labels: every label carries this hostname.
3. **Cloudflare Access.** In Zero Trust → Access → Applications, add a self-hosted application for that hostname. Add a policy allowing the people who should get in (their emails, or an email domain). For login methods, the one-time PIN (a code by email) works for anyone; Google, or any OpenID Connect provider, can be added under Settings → Authentication. A long session duration (a week or a month) saves signing in again before a tapped tag can open its item.
4. **Connect the two.** Copy the application's *Audience (AUD) tag* and your team domain (`<team>.cloudflareaccess.com`) into `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` in `wrangler.jsonc`, then `npm run deploy` again. Until both are set, the API answers every request with 503.

If the Worker's `workers.dev` address stays on, protect it too (Workers → Settings → Domains & Routes → workers.dev → Cloudflare Access), or turn it off with `"workers_dev": false`.

## NFC tags

NTAG213 or NTAG215 stickers work (a label link is about 40 bytes); use on-metal tags on metal cases. Write them from the Labels page in Chrome on Android, one after another; locking a tag is permanent and takes a second tap. On an iPhone, any NFC writing app can write the link shown on the item page instead.

iPhones (XS and newer) read tags in the background when the screen is on and the camera isn't in use: tapping a tag shows a notification that opens the link. Chrome on Android reads tags continuously while an event page with "Read NFC tags" is open.

## Free-plan limits worth knowing

- D1: 5 million rows read and 100,000 written per day, 5 GB storage. Since September 2026, queries over the daily limits fail until midnight UTC instead of being billed.
- D1: at most 100 bound parameters per query, which is why bulk writes use `json_each(?)` with one JSON parameter.
- Workers: 100,000 requests a day. Static files (the app itself) don't count.
- Access: up to 50 people.

## The first version

The Firebase version (Next.js in `Webapp/`, Cloud Functions in `Functions/`, and the root `firebase.json`, `.firebaserc` and `apphosting.yaml`) is still in the repository and isn't used by anything above. Its JSON QR labels (`{"type", "serial"}`) still scan: Ventorio matches them by serial number.
