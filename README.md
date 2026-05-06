# Continental Contact

A polished shared contact website for the Continental project ecosystem. The frontend posts contact submissions to `/api/contact`; the Express backend validates the request and forwards it to a private Discord channel through an incoming webhook.

The Discord webhook URL is never used in frontend code. It must stay in backend environment variables only.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

3. Add your webhook URL to `.env`:

```text
DISCORD_CONTACT_WEBHOOK_URL=your_discord_webhook_url_here
PORT=3000
```

4. Start the site:

```bash
npm run dev
```

5. Open:

```text
http://localhost:3000
```

## Creating a Discord Webhook

1. Open Discord and go to the private channel that should receive contact messages.
2. Open channel settings.
3. Go to **Integrations**.
4. Choose **Webhooks**.
5. Create a new webhook, name it something like `Continental Contact`, and copy the webhook URL.
6. Paste that URL into `.env` as `DISCORD_CONTACT_WEBHOOK_URL`.

Keep `.env` private. Do not commit it and do not paste the real webhook URL into README files, frontend JavaScript, HTML, screenshots, or public hosting settings.

## How Submissions Work

The contact form sends JSON to:

```text
POST /api/contact
```

The backend validates:

- project, reason, and message are present
- message is no longer than 3000 characters
- optional email is valid when provided
- hidden honeypot field `website` is empty
- no more than 3 submissions per IP every 10 minutes

After validation, the backend sends a Discord embed through `process.env.DISCORD_CONTACT_WEBHOOK_URL`. The payload includes project, reason, email or `Not provided`, message, timestamp, and a `Continental Contact` footer.

## Project Options

The dropdown includes the required core options plus discovered Continental projects from the local GitHub workspace:

- General
- Continental ID
- Vanguard
- Aegis
- Blueprint
- Continental Studios
- Grimoire
- StepCast
- The Echo Archives
- Minesweeper
- Terra Tread
- Sovereign
- Other

## Deployment Notes

For a future host such as `contact.continental-hub.com`, configure the hosting provider with:

```text
DISCORD_CONTACT_WEBHOOK_URL=<secret webhook URL>
PORT=<provider port, if required>
```

The frontend should keep using `/api/contact` so it works on the same origin in local development and production.

This repo now includes the common public site files expected for deployment:

- `public/index.html`
- `public/robots.txt`
- `public/sitemap.xml`
- `public/manifest.json`
- `public/404.html`
- `public/favicon.png`
- `public/favicon.svg`
- `public/privacy.html`
- `public/terms.html`
- `public/data.json`

Items from the checklist that are intentionally not in this repo:

- `index.php` or other PHP entrypoints are not needed because the site runs on Express/Node.
- `.htaccess` is not needed unless you deploy behind Apache.
- SSL/TLS certificates are not stored in the repo; they must be configured on the hosting platform or reverse proxy.

## Recent Improvements

- `/privacy` now serves a dedicated privacy page instead of falling through to the contact page
- the form shows field-level validation errors and accessible error states
- priority actions prefill the form for `Security issue` and `Abuse report`
- API responses now include a request ID for support/debugging
- webhook misconfiguration is logged server-side without exposing internal details to end users
