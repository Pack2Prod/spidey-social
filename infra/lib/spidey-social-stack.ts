import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as path from 'path';

export class SpideySocialStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stackName = 'spidey-social';

    // DynamoDB table: PK (string), SK (string), TTL expiresAt
    const table = new dynamodb.Table(this, 'Table', {
      tableName: `${stackName}-data`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Cognito User Pool (email sign-in)
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${stackName}-users`,
      signInAliases: { email: true, username: false },
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('UserPoolClient', {
      userPoolClientName: `${stackName}-client`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // S3 bucket (private)
    const bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: `${stackName}-assets-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront distribution in front of S3 (private bucket, OAC)
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
      },
      comment: `${stackName} assets`,
    });

    // Lambda health handler
    const healthHandler = new lambdaNodejs.NodejsFunction(this, 'HealthHandler', {
      entry: path.join(__dirname, '../lambda/health.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
    });

    // API Gateway REST API with GET /health
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${stackName}-api`,
    });

    const healthResource = api.root.addResource('health');
    healthResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(healthHandler)
    );

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: `${stackName}-apiUrl`,
    });
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${stackName}-userPoolId`,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${stackName}-userPoolClientId`,
    });
    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
      description: 'DynamoDB table name',
      exportName: `${stackName}-tableName`,
    });
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket name',
      exportName: `${stackName}-bucketName`,
    });
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: `${stackName}-distributionDomainName`,
    });
  }
}
