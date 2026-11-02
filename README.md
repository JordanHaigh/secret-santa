# Family Secret Santa

A complete, self-hosted Secret Santa exchange built with Next.js, React and PostgreSQL. Ready to deploy with a Dockerfile through Coolify.

## What’s included

- Public signup with name, email, a fixed **$150 gift budget**, and **1–50 wishlist ideas**. Three fields are shown initially; participants can add or remove fields.
- Optional HTTP/HTTPS links on each idea, plus notes for sizes, preferences or allergies.
- Pasted links show a preview with the page title, website, description and thumbnail when available. Pasting a URL directly into a gift idea fills in its title. The same preview appears in admin and recipient wishlists; blocked or unavailable previews fall back to a clickable link.
- Sharing the app produces an Open Graph and X/Twitter card with a 1200×630 PNG, title and description. Browser and Apple touch icons are included. Private reveal previews contain no participant names, wishlist details or reveal tokens.
- Password-protected organiser dashboard at `/admin`, controlled by **`ADMIN_PASSWORD`**.
- Participant accounts at `/account`, using their signup email. New and migrated accounts start with **`change-me`** and must choose a new password of 12–128 characters before accessing their wishlist. Returning participants can update names, ideas, links and notes, even after the draw, and change their password using their current password. Email addresses remain fixed to the account.
- Participant responses, searchable wishlists, removal before the draw, and CSV exports.
- Required (“must give to”) and excluded (“can’t give to”) pairings. Rules are directional, with a checkbox to apply both directions.
- Randomised allocation: everyone gives to one recipient and receives from one giver, with no self-pairings. Required and excluded rules are respected. Conflicts and impossible draws produce useful errors.
- Private, unguessable reveal links showing only the recipient’s name, wishes and notes. Admins can copy each link or export all of them.
- Once names are drawn, each pairing has a ready-to-send Christmas message with the giver’s greeting, recipient’s name, all wishlist ideas and their original gift links, any notes, the **$150 budget**, and a reminder to bring a **separate $20 Dirty Santa joke present for Christmas Eve**. Messages do not link back to this site. Preview or copy messages individually, or export them as CSV. Messages use the wishlist currently loaded in admin; refresh responses before copying if someone has updated their ideas.
- Reopening a draw keeps participants and rules, clears the allocations, invalidates old links and opens signups again.
- Durable PostgreSQL storage, concurrency-safe state updates, automatic transactional migrations, rate-limited login and signup, signed eight-hour admin sessions, and CSRF origin checks.

This is one exchange per deployment, for up to 500 participants. Reciprocal pairings are allowed. Random matching is not guaranteed to be uniformly distributed across all possible valid draws.

Account passwords are stored as salted scrypt hashes. Login uses opaque, server-side sessions in HttpOnly, SameSite=Strict cookies, with Secure cookies in production. Default-password sessions only permit password setup and expire after 20 minutes; regular sessions last seven days. Changing a password revokes every previous session. Removing a participant also removes their account and sessions. The admin password remains separate.

The account migration automatically creates default-password accounts for existing submissions on deployment, preserving participant IDs, wishlists, rules and allocations. Running migrations again does not reset passwords. There is no email verification or email-based password recovery in this version; the shared starter password is the requested way to claim an account, so anyone who knows a signup email can claim it until the owner replaces `change-me`.

**Reveal links are shared manually. The application does not send email.** Send each giver only their own link; anyone with that link can view their recipient. Changing the admin password invalidates admin sessions. Signups close automatically when the organiser draws names.

## Deploy through Coolify

1. Add a **PostgreSQL** resource to your Coolify project, start it, and copy its **Internal URL**. Put the application and database on the same server/destination network. The application uses this URL directly; it does not need a publicly exposed database port.
2. Put this project in your Git repository and add it as an application in Coolify. Select the **Dockerfile** build pack, with `Dockerfile` at the repository root.
3. Set the application’s **Ports Exposes** to **`3000`**, and configure your HTTPS domain.
4. Add these **runtime** environment variables to the application (not the database):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | The exact PostgreSQL Internal URL copied from Coolify |
   | `ADMIN_PASSWORD` | Your unique admin password, at least 12 characters |
   | `APP_URL` | The exact external origin, e.g. `https://santa.example.com`, with no trailing slash |

   These values are not required at build time. Do not use a `NEXT_PUBLIC_` prefix for secrets. If you use a PostgreSQL service requiring TLS, include its supported SSL configuration in the connection URL.
5. Deploy. The container applies any pending SQL migrations before starting the app. A migration failure stops startup instead of running against a partial schema. Migrations use an advisory lock so simultaneous application starts cannot apply the same migration twice.
6. Check `/api/health` or use that path for Coolify’s HTTP health check (port `3000`). Open `/admin`, sign in with `ADMIN_PASSWORD`, and share your homepage with participants.

The Docker image includes a health check and runs as an unprivileged user. Keep the database persistent volume managed by Coolify. No application file volume is necessary because records are stored in PostgreSQL. Use HTTPS for the domain because production admin cookies are `Secure`. `APP_URL` must match the domain you use in the browser so form submissions pass the origin check. Keep Coolify’s reverse proxy in front of the application, with forwarded headers managed by the proxy.

Official references: [Coolify PostgreSQL](https://coolify.io/docs/databases/postgresql), [Dockerfile deployments](https://coolify.io/docs/applications/builds/dockerfile), and [application environment variables](https://coolify.io/docs/applications/configuration/environment-variables).

## Local development

Node.js 22.13+ and a PostgreSQL database are required.

```sh
npm ci
cp .env.example .env.local
# Edit .env.local with your local PostgreSQL URL, password and origin.
npm run db:migrate
npm run dev
```

The dev server listens on `127.0.0.1:3000`. Set `APP_URL=http://127.0.0.1:3000` and use that address in the browser. This avoids a potential `localhost` IPv6 collision with other local services.

```sh
npm test
npm run typecheck
npm run build
npm start
```

The Node production start command also applies pending migrations. Docker runs the smaller Next.js standalone server.

To build and run the production image yourself:

```sh
docker build -t family-secret-santa .
docker run --rm -p 3000:3000 --env-file .env.production family-secret-santa
```

The database hostname must be reachable from inside the container. Use your HTTPS reverse proxy for production admin access.

## Verification

`npm test` covers required and excluded pairings, conflicts, self-pairing prevention, one giver/recipient per person, every four-person exclusion graph, wishlist counts, normalisation, and unsafe link validation.

A local API integration check is also included. **Only use an empty, disposable local database**; it creates test participants, draws names, reopens the exchange and deletes its participants. It rejects non-loopback server URLs and refuses to start if the exchange already has participants:

```sh
# With .env.local configured and npm run dev running:
node --env-file=.env.local tests/api.integration.mjs
```

This verifies persistence, concurrent signups, duplicate emails, authentication, session tampering, rate limiting, CSRF, rule conflicts, allocations, signup closure, reveal privacy, invalid links and invalidation after reopening.

`tests/accounts.integration.mjs` verifies legacy-account migration, required password changes, wishlist ownership, updates after a draw, session expiration/revocation, account removal, transactional signup rollback and rate limiting. It resets the schema of its test database, and refuses to run unless both server and database use `127.0.0.1` and the database name starts with `secret_santa_accounts_qa_`. Use a separate server instance pointed at that disposable database:

```sh
TEST_BASE_URL=http://127.0.0.1:3002 DATABASE_URL=postgresql://santa@127.0.0.1:55439/secret_santa_accounts_qa_example ADMIN_PASSWORD=your-test-admin-password node tests/accounts.integration.mjs
```

Sharing metadata has a separate read-only check that does not access the database or change participants:

```sh
node --env-file=.env.local tests/metadata.integration.mjs
# To check a production server on another port and verify its runtime origin:
TEST_URL=http://127.0.0.1:3001 EXPECTED_APP_URL=https://santa.example.com node tests/metadata.integration.mjs
```

The application reads `APP_URL` at request time, so Coolify only needs it as a runtime variable. It controls absolute social image URLs, Open Graph URLs and canonical links. Metadata is included in the initial HTML head for all clients, including messaging crawlers that do not execute JavaScript. The public PNG and icon files are served without authentication. Set `APP_URL` to your reachable HTTPS domain and redeploy; sharing services must be able to fetch that domain and `/share-card.png`. Existing previews may stay cached until the platform refreshes them. The editable artwork is `public/share-card.svg`; regenerate `public/share-card.png` after changing it.

## Files to know

- `app/page.tsx` — signup and wishlist form
- `app/admin/admin.tsx` — organiser dashboard
- `app/reveal/[token]/` — private reveal page
- `app/api/` — server-side validation and access checks
- `lib/exchange.ts` — pairing algorithm and input validation
- `lib/server.ts` — PostgreSQL state, signed sessions and request helpers
- `migrations/` — versioned SQL migrations
- `scripts/migrate.mjs` — transactional migration runner
- `Dockerfile` — Coolify deployment image

All environment files containing real credentials are ignored by Git and excluded from the Docker build context. `.env.example` only documents the required configuration. The app uses Google Fonts with system font fallbacks.

Link previews need outbound HTTP/HTTPS access from the application container. They read Open Graph, Twitter card and standard page metadata; sites that require login, block automated requests or only generate metadata in JavaScript may not provide a full preview. No additional environment variables or database migrations are needed. Preview fetching and thumbnail proxying reject private network addresses, revalidate redirects, pin DNS to the validated address, limit response sizes and timeouts, and do not forward visitor credentials.
