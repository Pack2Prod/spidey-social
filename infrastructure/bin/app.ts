#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SpideySocialMvpStack } from '../lib/spidey-social-mvp-stack';

const app = new cdk.App();
new SpideySocialMvpStack(app, 'SpideySocialMvpStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'Spidey Social MVP — S3 website + DynamoDB only',
});
