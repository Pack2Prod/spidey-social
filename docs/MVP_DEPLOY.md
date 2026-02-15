# Deploy MVP (minimal infrastructure)

The MVP stack creates **only**:

1. **S3 bucket** — static website hosting for the React app  
2. **DynamoDB table** — one table (pk, sk) for data later  

No Cognito, API Gateway, Lambda, or CloudFront — fewer permissions required.

---

## Permissions needed

Your IAM user needs at least:

- **CloudFormation**: create/update stack
- **S3**: CreateBucket, PutBucketPolicy, PutBucketWebsite, GetBucketLocation, DeleteBucket
- **DynamoDB**: CreateTable, DescribeTable, DeleteTable

A policy like this is enough (or use **AmazonS3FullAccess** + **AmazonDynamoDBFullAccess** for learning):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "dynamodb:*",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Deploy

```bash
cd infrastructure
npm install
npx cdk bootstrap    # once per account/region
npx cdk deploy --require-approval never
```

---

## After deploy

1. Note the outputs: **WebBucketName**, **WebsiteUrl**, **TableName**.
2. Build and upload the frontend:

   ```bash
   cd ../frontend
   npm run build
   aws s3 sync dist/ s3://<WebBucketName> --delete
   ```

3. Open **WebsiteUrl** in your browser (it will be `http://...` — S3 static websites use HTTP, not HTTPS).

---

## Add more later

When you have broader permissions, switch to the full stack:

- Edit `bin/app.ts` to use `SpideySocialStack` instead of `SpideySocialMvpStack`.
- The full stack adds Cognito, API Gateway, CloudFront, Lambda.
