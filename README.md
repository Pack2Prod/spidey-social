# Spidey Social

**Your Friendly Neighborhood Network** — a location-based ephemeral social app.

Create short posts near you, discover what’s happening nearby, swing in to chat with post owners, and stay in touch in real time — all without polling.

---

## Features

- **Posts (webs)** — Create posts with location and visibility radius; they expire after 30–120 min
- **Feed** — Browse posts within 0.5–10 mi of you
- **Sense (radar)** — Visual radar for post direction and distance
- **Swing-in** — One swing per post; swinging in opens a chat with the post owner
- **Chat** — Messaging with post owners after swing-in
- **Real-time** — WebSocket push for new posts and messages
- **Profile** — My posts, sign-out

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, TypeScript, Tailwind CSS, AWS Amplify |
| Hosting | S3 + CloudFront |
| Auth | Amazon Cognito |
| API | API Gateway (REST + WebSocket) |
| Backend | AWS Lambda (Node.js 20) |
| Database | Amazon DynamoDB |
| IaC | AWS CDK (TypeScript) |

---

## Prerequisites

- Node.js 20+
- AWS account with [AWS CLI configured](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

See [docs/AWS_SETUP.md](docs/AWS_SETUP.md) for first-time AWS setup (account, IAM, CLI, CDK bootstrap).

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd spidey-social
```

### 2. Deploy infrastructure (first time)

```bash
cd infrastructure
npm install
npx cdk bootstrap   # once per account/region
npx cdk deploy --require-approval never
```

### 3. Deploy frontend

```bash
cd frontend
npm install
./scripts/deploy.sh
```

The deploy script fetches stack outputs, builds the app with the correct env vars, syncs to S3, and invalidates CloudFront. The site URL will be printed at the end. Use `OpsDashboardUrl` to view operational metrics (latency, invocations, errors) in CloudWatch.

### 4. Local development

Create `frontend/.env.local` with stack outputs (or copy from deploy output):

```
VITE_API_URL=https://xxx.execute-api.region.amazonaws.com/prod
VITE_WS_URL=wss://xxx.execute-api.region.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=us-east-1_xxx
VITE_COGNITO_CLIENT_ID=xxx
```

Then run:

```bash
cd frontend
npm run dev
```

---

## Project Structure

```
spidey-social/
├── frontend/           # React SPA (Vite, TypeScript, Tailwind)
│   ├── api/            # REST API client
│   ├── lib/            # WebSocket, auth, geolocation
│   ├── components/     # UI components
│   └── scripts/        # Deploy script
├── infrastructure/     # AWS CDK stack (TypeScript)
│   ├── lib/            # spidey-social-mvp-stack.ts
│   └── lambdas/        # Lambda handlers
└── docs/
    ├── ARCHITECTURE.md # Architecture, data model, API, flows
    ├── AWS_SETUP.md    # AWS account and CLI setup
    └── MVP_DEPLOY.md   # Legacy minimal deploy
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, AWS services, DynamoDB schema, API reference, key flows, deployment, operational metrics |
| [docs/AWS_SETUP.md](docs/AWS_SETUP.md) | AWS account, IAM, CLI, CDK bootstrap |
| [docs/MVP_DEPLOY.md](docs/MVP_DEPLOY.md) | Legacy minimal deploy (S3 + DynamoDB only) |

---

## License

MIT
