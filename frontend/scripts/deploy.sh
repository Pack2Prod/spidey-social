#!/usr/bin/env bash
set -e

STACK_NAME="SpideySocialMvpStack"

BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='WebBucketName'].OutputValue" --output text)
DIST_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='RestApiUrl'].OutputValue" --output text)
WS_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='WebSocketUrl'].OutputValue" --output text)
USER_POOL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)

# Inject stack outputs into build (Vite reads env at build time)
export VITE_API_URL="${VITE_API_URL:-$API_URL}"
export VITE_WS_URL="${VITE_WS_URL:-$WS_URL}"
export VITE_COGNITO_USER_POOL_ID="${VITE_COGNITO_USER_POOL_ID:-$USER_POOL}"
export VITE_COGNITO_CLIENT_ID="${VITE_COGNITO_CLIENT_ID:-$CLIENT_ID}"

echo "Building frontend (API=$VITE_API_URL, WS=$VITE_WS_URL)..."
npm run build

echo "Syncing to S3 (s3://$BUCKET)..."
aws s3 sync dist/ "s3://$BUCKET" --delete

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"

echo "Done. Site will update in ~1 min."
