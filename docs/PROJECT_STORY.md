# Spidey Social — Project Story

## Inspiration
Most social apps feel either too public (everything lives forever) or too noisy (infinite scrolling, spam, and posts that are nowhere near you). We wanted something that feels like a real neighborhood: quick, local, lightweight updates you can act on right now, then they disappear.

So we built **Spidey Social**, a “Friendly Neighborhood Network” where posts are tied to your location, visible only within a radius, and expire automatically. It’s for the moments that matter in the next hour: “pickup soccer behind the gym,” “free pizza in the lobby,” “study group in 10 minutes,” or “anyone want to grab coffee?”

## What it does

- **Posts (webs)** — Create short posts (max 280 chars) with location and visibility radius \(r\) (0.5–10 mi). They expire after a TTL \(t\) (30–120 min).
- **Feed** — Browse posts within a configurable radius; your own and already-swung posts are hidden.
- **Sense (radar)** — See post direction and distance on a circular radar.
- **Swing-in** — One swing per post; opens a chat with the post owner.
- **Chat** — Message post owners after swinging in.
- **Real-time** — WebSocket push for new posts and messages (no polling).
- **Profile** — My posts, sign-out.

## How we built it

- **Frontend:** React + Vite + TypeScript + Tailwind; AWS Amplify for auth; browser Geolocation API for position. WebSocket context sends lat/lng on connect for targeted real-time; live updates for feed and chat.
- **Backend:** REST + WebSocket APIs on API Gateway, Lambda handlers (create-web, list-webs, swing-in, send-message, ws-connect/disconnect, etc.), single DynamoDB table with GSIs for feed, per-user, and **geo** (webs and connections by geohash cell). Geohash utility (precision 5) for encode + neighbors; list-webs queries 9 cells when lat/lng provided; create-web does targeted fan-out to connections in those cells only.
- **Infra:** AWS CDK (TypeScript) for S3, CloudFront, Cognito, API Gateway, Lambda, DynamoDB (incl. gsi_geo, gsi_conn_geo); CloudWatch dashboard for latency, invocations, and resource usage.
- **Deploy:** CDK deploy for infra; frontend deploy script reads stack outputs, builds with env vars, syncs to S3, invalidates CloudFront.

## Challenges we ran into

- **Geolocation:** Browsers require HTTPS for `getCurrentPosition`; we put CloudFront in front of S3 so the app always loads over HTTPS.
- **Real-time at scale:** We moved from “broadcast new post to all connections” to **targeted fan-out**: connections store their location (geohash) on connect; create-web queries only the 9 geo cells around the post and pushes `web_added` only to connections in range (Haversine within visibility). Feed list-webs uses the same geo index so we only read 9 partitions per request.
- **Single-table design:** Modeling webs, swing-ins, chats, and WebSocket connections in one table with clear pk/sk and GSI patterns took a few iterations to keep queries simple and cost-effective.

## Accomplishments that we're proud of

- Full serverless stack (no EC2): Lambda, DynamoDB, API Gateway REST + WebSocket, Cognito, S3, CloudFront, all defined in CDK.
- **DynamoDB single-table design** with GSIs for recency, user, and **geo** (gsi_geo for webs by geohash cell, gsi_conn_geo for connections by cell)—so feed and real-time scale by location, not global size.
- **Geo-scalability:** Geo-indexed feed (list-webs queries 9 geohash cells when lat/lng provided) and targeted WebSocket fan-out (new post only pushes to connections in those cells). Bounded work per request; 10-mile neighborhood model scales globally.
- Real-time feed and chat via WebSocket with no polling.
- Operational visibility out of the box: CloudWatch dashboard for latency, invocations, errors, and DynamoDB capacity.
- One-command deploy for both infra and frontend.

## What we learned

- How to structure a DynamoDB single table (pk/sk, GSIs) for feeds, user-scoped lists, WebSocket connection lookups, and **geo-partitioned** access (geohash cells).
- Geohash (encode + neighbors) for partitioning by location; querying 9 cells instead of “all” so feed and fan-out scale with local activity.
- API Gateway WebSocket auth (JWT in query param at `$connect`) and pushing from Lambda via `ApiGatewayManagementApi.postToConnection`; sending optional lat/lng on connect for targeted push.
- CDK for not just compute and DB but also dashboards and gateway responses (e.g. CORS on 4xx/5xx).

## What's next for Spidey Social

- Notifications (e.g. push when someone swings in or replies).
- Richer Sense: filters by category, time-left, or “trending” in radius.
- Optional persistence: “save this chat” before the web expires.
- Moderation and reporting flows.

---

## Built with

| Category | Technologies |
|----------|---------------|
| **Frontend** | React, Vite, TypeScript, Tailwind CSS, AWS Amplify (Cognito), browser Geolocation API |
| **Hosting** | Amazon S3, Amazon CloudFront |
| **Auth** | Amazon Cognito (User Pools) |
| **API** | Amazon API Gateway (REST + WebSocket) |
| **Backend** | AWS Lambda (Node.js 20) |
| **Database** | Amazon DynamoDB (single-table, GSIs) |
| **IaC & Ops** | AWS CDK (TypeScript), Amazon CloudWatch (dashboards) |
