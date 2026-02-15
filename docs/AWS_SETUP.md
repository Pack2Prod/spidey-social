# AWS setup (first time)

Do this **once** before deploying the Spidey Social stack. You need an AWS account and the AWS CLI configured on your PC.

---

## Step 1: Create an AWS account (if you don’t have one)

1. Go to [https://aws.amazon.com](https://aws.amazon.com) and click **Create an AWS Account**.
2. Follow the sign-up flow (email, password, payment method, identity check).
3. **Free tier:** New accounts get 12 months of free tier (limited usage of EC2, Lambda, DynamoDB, etc.). Our stack stays within free tier for learning/small use.
4. Sign in to the **AWS Management Console**: [https://console.aws.amazon.com](https://console.aws.amazon.com).

---

## Step 2: Create an IAM user (recommended)

Using the **root** account for daily work is not recommended. Create a separate **IAM user** for development:

1. In the AWS Console, open **IAM**: search for “IAM” in the top search bar and open **IAM**.
2. In the left sidebar, click **Users** → **Create user**.
3. **User name:** e.g. `spidey-dev` (or any name you like).
4. Click **Next**.
5. **Permissions:** Choose **Attach policies directly**, then select **AdministratorAccess** (for learning; in production you’d use a narrower policy).
6. Click **Next** → **Next** → **Create user**.
7. Click on the new user name.
8. Open the **Security credentials** tab.
9. Under **Access keys**, click **Create access key**.
10. Choose **Command Line Interface (CLI)** → check the box → **Next** → **Create access key**.
11. **Important:** Copy the **Access key ID** and **Secret access key** and store them somewhere safe (e.g. password manager). You cannot see the secret again after leaving this page.
12. Click **Done**.

You now have:
- **Access key ID** (like `AKIA...`)
- **Secret access key** (long random string)

These are what we’ll use to “connect” your PC to AWS — no API key is stored in the project.

---

## Step 3: Install the AWS CLI on your PC

- **macOS (Homebrew):**
  ```bash
  brew install awscli
  ```
- **Windows:**  
  Download and run the installer: [AWS CLI v2 for Windows](https://awscli.amazonaws.com/AWSCLIV2.msi).
- **Or:** See [Install or update the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

Check it’s installed:
```bash
aws --version
```
You should see something like `aws-cli/2.x.x`.

---

## Step 4: Configure the AWS CLI with your credentials

In a terminal, run:

```bash
aws configure
```

You’ll be prompted for:

| Prompt              | What to enter |
|---------------------|----------------|
| **AWS Access Key ID**     | Your Access key ID (e.g. `AKIA...`) |
| **AWS Secret Access Key** | Your Secret access key |
| **Default region name**   | e.g. `us-east-1` (or `us-east-2`, `ap-south-1`, etc.) |
| **Default output format** | Just press Enter (or type `json`) |

Credentials are stored under your user folder (e.g. `~/.aws/credentials`). The project repo does **not** contain these; they stay on your machine.

---

## Step 5: Verify it works

Run:

```bash
aws sts get-caller-identity
```

You should see JSON with your **Account** id and **Arn** (your IAM user). If that works, your PC is correctly configured to use your AWS account.

---

## Step 6: Bootstrap CDK (once per account/region)

Before the first CDK deploy, run:

```bash
cd infrastructure
npm install
npx cdk bootstrap
```

Use the same region you set in `aws configure` (e.g. `us-east-1`). This creates a small S3 bucket and roles in your account so CDK can deploy. You only need to do this once per AWS account per region.

---

## You’re ready

After this:

- You have an AWS account.
- You have an IAM user with access keys.
- The AWS CLI on your PC is configured with those keys.
- CDK is bootstrapped.

Next step is to **deploy the stack** (`npx cdk deploy` from the `infrastructure/` folder). If you want, we can go through that deploy step by step after you finish this setup.
