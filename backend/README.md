# Instagram Automation Backend

Automated comment reply system for Instagram using Graph API.

## Features

- 🔄 Automatic comment detection via webhooks
- 🤖 Keyword-based auto-replies
- 💬 Direct message automation
- 🚫 Smart deduplication (no double replies)
- 📊 Real-time statistics
- ⚡ Queue-based processing (handles 2000+ comments)
- 🔐 Secure authentication with Supabase

## Prerequisites

- Node.js 18+
- PostgreSQL (or Supabase account)
- Redis (or Upstash account)
- Instagram Business Account
- Facebook Developer Account

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env` and fill in values:
```bash
cp .env.example .env
```

### 3. Setup Database

Run the migration to create tables:
```bash
npm run migrate
```

Or manually run the SQL in `migrations/001_initial_schema.sql`

### 4. Start Server

Development mode (auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Environment Variables

See `.env.example` for all required variables.

### Critical Variables:

- `DATABASE_URL` - PostgreSQL connection string
- `INSTAGRAM_ACCESS_TOKEN` - From Facebook Developer Console
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` - Your Instagram Business ID
- `META_APP_SECRET` - For webhook verification
- `WEBHOOK_VERIFY_TOKEN` - Random string for webhook setup
- `REDIS_URL` - Redis connection (for Bull queue)
- `SUPABASE_URL` & `SUPABASE_ANON_KEY` - For authentication

## API Endpoints

### Webhook
- `GET /webhook` - Webhook verification
- `POST /webhook` - Receive Instagram events

### Posts (Authenticated)
- `GET /api/posts` - List all posts
- `GET /api/posts/:id` - Get post details
- `POST /api/posts/sync` - Sync from Instagram
- `POST /api/posts/:id/keywords` - Add keyword
- `PUT /api/posts/:id/toggle` - Enable/disable automation

### Stats (Authenticated)
- `GET /api/stats` - Overall statistics
- `GET /api/stats/posts/:id` - Post statistics

## Setting Up Instagram Webhooks

1. Go to Facebook Developer Console
2. Select your app → Instagram → Webhooks
3. Add webhook URL: `https://your-domain.com/webhook`
4. Verify token: Use your `WEBHOOK_VERIFY_TOKEN`
5. Subscribe to `comments` field

## Architecture
```
Webhook → Queue → Processor → Instagram API
              ↓
         Database (deduplication)
```

1. Instagram sends comment webhook
2. Comment added to Bull queue
3. Queue worker processes with rate limiting
4. Check deduplication (already replied?)
5. Match keywords
6. Reply to comment + send DM
7. Record in database

## Scaling

The system is designed to handle high volume:

- **Queue-based**: 2000+ comments won't overwhelm API
- **Rate limiting**: Respects Instagram's 200 req/hour limit
- **Connection pooling**: 20 concurrent DB connections
- **Deduplication**: Fast indexed queries
- **Retry logic**: Automatic retries on failures

## Monitoring

Check logs for:
- `✅` Success indicators
- `⚠️` Warnings (rate limits, failures)
- `❌` Errors (requires attention)

## Troubleshooting

**Webhooks not working?**
- Check `META_APP_SECRET` is correct
- Verify webhook URL is accessible
- Check server logs for errors

**Comments not getting replied?**
- Check if post is active (`is_active = true`)
- Verify keywords are configured
- Check queue stats: `GET /api/stats`

**Rate limits?**
- Queue automatically handles this
- Check `MAX_REQUESTS_PER_HOUR` setting

## License

MIT