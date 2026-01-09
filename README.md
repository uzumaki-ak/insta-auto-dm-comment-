# insta-auto-dm-comment- 🚀 ![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg) ![Express](https://img.shields.io/badge/Express-4.18.2-blue.svg) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-8.11.3-blue.svg) ![Redis](https://img.shields.io/badge/Redis-5.3.2-blue.svg) ![Bull Queue](https://img.shields.io/badge/Bull-4.12.0-orange.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-NotUsed-lightgrey.svg) ![MIT License](https://img.shields.io/badge/license-MIT-brightgreen.svg)

---

## 📖 Introduction

**insta-auto-dm-comment-** is a robust backend service designed to automate interactions on Instagram, primarily focusing on comment detection, auto-replies based on keywords, and managing direct messages. Built with a scalable Node.js architecture, it leverages the Instagram Graph API to monitor and respond to comments in real time, ensuring engagement without manual intervention. The system employs a secure, token-based authentication mechanism via Supabase, and uses Redis-backed Bull queues to handle high-volume comment processing efficiently, supporting over 2000 comments per batch.

This backend is the core component powering an Instagram automation ecosystem that can be integrated with a frontend dashboard for managing posts, keywords, and viewing analytics. Its architecture emphasizes reliability, rate-limiting adherence, and spam prevention through deduplication logic, ensuring high-quality engagement and compliance with Instagram's API policies.

---

## ✨ Features

- 🔄 **Webhook-based comment detection** for real-time comment monitoring.
- 🤖 **Keyword-based auto-replies** to engage users automatically.
- 💬 **Direct Message automation** for personalized outreach.
- 🚫 **Deduplication system** to prevent multiple replies to the same user/comment.
- 📊 **Real-time statistics and analytics** on comments and replies.
- ⚡ **Queue-based high-volume processing** handling 2000+ comments seamlessly.
- 🔐 **Secure authentication** with JWT tokens via Supabase.
- 🛡️ **Rate-limited API interactions** to stay compliant with Instagram's API limits.
- 🌐 **Webhook verification** with secure tokens.
- 📝 **Database schema** for posts, keywords, and replied comments management.
- 🧰 Modular architecture separating services, controllers, and configs for maintainability.

---

## 🛠️ Tech Stack

| Technology / Library           | Purpose                                              | Version      |
|------------------------------|------------------------------------------------------|--------------|
| **Node.js**                  | Runtime environment for backend                      | 18+          |
| **Express.js**               | Web framework for API endpoints                      | 4.18.2       |
| **PostgreSQL**               | Main database for storing posts, keywords, replies   | 8.11.3       |
| **Redis**                    | Backing store for Bull queues and rate limiting     | 5.3.2        |
| **Bull**                     | Job queue processing with retries and rate limiting | 4.12.0       |
| **axios**                    | HTTP client for external API calls                   | 1.6.0        |
| **dotenv**                   | Environment variable management                      | 16.3.1       |
| **winston**                  | Logging library                                      | 3.19.0       |
| **@supabase/supabase-js**    | Authentication and user management via Supabase    | 2.39.0      |
| **pg**                       | PostgreSQL client                                    | 8.11.3       |

---

## 🚀 Quick Start / Installation

### Clone the repository

```bash
git clone https://github.com/uzumaki-ak/insta-auto-dm-comment- (45 files.git
cd insta-auto-dm-comment-
```

### Install dependencies

```bash
npm install
```

### Setup environment variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
# Then edit .env with your actual configuration
```

### Run database migrations

```bash
npm run migrate
```

### Start the server

Development mode with auto-restart:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

---

## 📁 Project Structure

```plaintext
/backend
├── src
│   ├── controllers
│   │   └── posts.controller.js      # Handles posts API endpoints
│   ├── services
│   │   ├── deduplication.service.js # Integrity to prevent duplicate replies
│   │   ├── instagram.service.js     # Interacts with Instagram Graph API
│   │   └── queue.service.js         # Manages comment processing queues
│   ├── config
│   │   ├── database.js              # PostgreSQL connection pool
│   │   ├── instagram.js             # Instagram API configuration
│   │   └── supabase.js              # Supabase authentication client
│   ├── utils
│   │   └── logger.js                # Winston logger setup
│   └── server.js                    # Entry point for Express server
├── migrations
│   └── 001_initial_schema.sql      # Database schema migrations
├── .env.example                     # Environment variables template
├── package.json                     # Dependencies and scripts
└── README.md                        # This documentation
```

---

## 🔧 Configuration

The backend relies on environment variables defined in `.env`. Key variables include:

| Variable                     | Description                                              | Required | Example                                |
|------------------------------|----------------------------------------------------------|----------|----------------------------------------|
| `DATABASE_URL`             | PostgreSQL connection string                              | Yes      | `postgres://user:pass@host:port/db`   |
| `INSTAGRAM_ACCESS_TOKEN`     | Instagram Graph API access token                           | Yes      | `EAAB...`                            |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Your Instagram Business Account ID                     | Yes      | `178414...`                          |
| `META_APP_SECRET`            | Webhook verification token                                | Yes      | `your_random_string`                 |
| `WEBHOOK_VERIFY_TOKEN`       | Token for verifying webhook setup                          | Yes      | `your_webhook_token`                 |
| `REDIS_URL`                  | Redis server URL for Bull queue                            | Yes      | `redis://localhost:6379`             |
| `MAX_REQUESTS_PER_HOUR`      | Instagram API rate limit (default 180)                     | No       | `180`                                |

---

## API Endpoints

### Webhook Verification

- `GET /webhook`  
  Verifies webhook setup with token validation.

- `POST /webhook`  
  Receives Instagram comment events in real-time, triggers comment processing.

### Posts Management (Protected)

- `GET /api/posts`  
  List all posts with associated keywords and stats.

- `GET /api/posts/:id`  
  Retrieve detailed info about a specific post.

- `POST /api/posts/sync`  
  Manually sync latest media/posts from Instagram.

- `POST /api/posts/:id/keywords`  
  Add keywords for automated responses.

- `PUT /api/posts/:id/toggle`  
  Enable or disable comment automation for a post.

### Analytics

- `GET /api/stats`  
  Overall engagement and comment statistics.

- `GET /api/stats/posts/:id`  
  Specific post engagement metrics.

*(Note: Authentication middleware should be configured for protected routes, likely via Supabase JWT tokens.)*

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- The project leverages [Instagram Graph API](https://developers.facebook.com/docs/instagram-api/) for comment and media management.
- Uses [Bull](https://github.com/OptimalBits/bull) for high-volume job queue processing.
- Powered by [Supabase](https://supabase.com/) for authentication and user management.
- Thanks to open-source libraries like [axios](https://github.com/axios/axios) and [winston](https://github.com/winstonjs/winston).

---

**This README provides a comprehensive, technical overview of the "insta-auto-dm-comment-" backend, grounded in actual code analysis.**
