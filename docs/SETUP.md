# Spidey Social - Infrastructure Setup Guide

This guide walks you through setting up and deploying the Spidey Social backend infrastructure (Slice 1) using AWS CDK.

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or later) – [Download](https://nodejs.org/)
2. **AWS CLI** – [Install guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
3. **AWS Account** – You need an AWS account to deploy resources
4. **npm** – Comes with Node.js

> Docker is not required; the Lambda handler is bundled locally with esbuild.

## Step 1: Configure AWS Credentials

Configure the AWS CLI with your credentials so CDK can deploy to your account:

```bash
aws configure
```

You will be prompted for:
- **AWS Access Key ID** – From IAM in the AWS Console
- **AWS Secret Access Key** – From the same place
- **Default region** – e.g. `us-east-1`
- **Default output format** – `json` is fine

To create access keys: AWS Console → IAM → Users → Your user → Security credentials → Create access key.

## Step 2: Install Dependencies

From the project root:

```bash
cd infra
npm install
```

## Step 3: Bootstrap CDK (One-time per account/region)

CDK needs a bootstrap stack in your AWS account. Run this once per AWS account and region:

```bash
cdk bootstrap
```

You should see output like: `Successfully deployed CDK bootstrap stack`.

## Step 4: Deploy the Stack

Deploy the Spidey Social infrastructure:

```bash
cdk deploy
```

When prompted, type `y` and press Enter to confirm. Deployment may take several minutes. When done, CDK will print the stack outputs (API URL, User Pool ID, etc.).

## Step 5: Test the Health Endpoint

After deployment, you'll see an output like:

```
SpideySocialStack.ApiUrl = https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/
```

Test the health endpoint:

```bash
curl https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/health
```

You should get a response like:

```json
{"ok":true,"timestamp":"2025-02-14T...","message":"spidey-social foundation"}
```

Replace the URL with the `ApiUrl` value from your deploy output.

## Step 6: Tear Down (Optional)

To remove all resources and avoid charges:

```bash
cdk destroy
```

Type `y` to confirm. This deletes the DynamoDB table, S3 bucket, Lambda, API Gateway, Cognito User Pool, and CloudFront distribution.

---

## Stack Outputs

After `cdk deploy`, you get these outputs:

| Output                   | Description                         |
|--------------------------|-------------------------------------|
| `ApiUrl`                 | API Gateway base URL                |
| `UserPoolId`             | Cognito User Pool ID                |
| `UserPoolClientId`       | Cognito app client ID               |
| `TableName`              | DynamoDB table name                 |
| `BucketName`             | S3 bucket name                      |
| `DistributionDomainName` | CloudFront distribution domain      |

## Troubleshooting

- **"Need to perform AWS calls for account"** – Run `aws configure` and ensure credentials work with `aws sts get-caller-identity`
- **Bootstrap required** – Run `cdk bootstrap` in the same region you're deploying to
- **Deploy fails** – Check the error message; common causes: quota limits, missing IAM permissions, or region restrictions
