# Spidey Social

Your Friendly Neighborhood Network — ephemeral webs, Spider-Sense proximity, and Aura.

## Project structure

- **`frontend/`** — React (Vite + TypeScript + Tailwind) Spider-Noir UI. Mobile-responsive.
- **`infrastructure/`** — AWS CDK stack: Cognito, DynamoDB, S3, CloudFront, API Gateway (REST + WebSocket).
- **`spidey-social-template/`** — Original UI template (reference only).

## Prerequisites

- Node.js 20+
- AWS CLI configured (`aws configure`)
- AWS CDK bootstrapped in your account/region (`cdk bootstrap`)

## Quick start

### 1. Frontend (local)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. Uses mock data until backend is wired in Slice 2+.

Optional: create `frontend/.env.local` with:

- `VITE_API_URL` — REST API URL (after first deploy)
- `VITE_WS_URL` — WebSocket URL, e.g. `wss://<api-id>.execute-api.<region>.amazonaws.com/prod`
- `GEMINI_API_KEY` — optional, for "Noir Narrator" rewrite on Post

### 2. Infrastructure (first deploy)

```bash
cd infrastructure
npm install
npx cdk bootstrap   # once per account/region
npx cdk deploy --require-approval never
```

Note the outputs: `UserPoolId`, `UserPoolClientId`, `TableName`, `WebBucketName`, `CloudFrontUrl`, `RestApiUrl`, `WebSocketUrl`.

### 3. Serve the app from CloudFront

After building the frontend, upload it to the S3 bucket:

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://<WebBucketName from CDK output> --delete
```

Then open **CloudFrontUrl** from the CDK outputs (e.g. `https://d1234abcd.cloudfront.net`).

## Next steps (plan)

- **Slice 2 — Auth:** Wire Cognito sign-up/sign-in in Onboarding; protect API with JWT authorizer.
- **Slice 3 — Web Wall:** Post/create web Lambda, TTL, WebSocket feed; Feed + Post pages call API.
- **Slice 4 — Spider-Sense:** Geohash + nearby-user Lambda; Sense radar with map.
- **Slice 5–6:** Chat, Aura, polish.

## Scripts

| Where        | Command              | Description                    |
|-------------|----------------------|--------------------------------|
| `frontend/` | `npm run dev`        | Dev server (port 3000)         |
| `frontend/` | `npm run build`      | Production build → `dist/`     |
| `infrastructure/` | `npx cdk deploy` | Deploy stack to AWS            |
| `infrastructure/` | `npx cdk diff`  | Diff stack vs deployed         |
