import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';

export class SpideySocialStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly table: dynamodb.Table;
  public readonly webBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly restApi: apigateway.RestApi;
  public readonly webSocketApi: apigatewayv2.WebSocketApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- Cognito User Pool ---
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'spidey-social-users',
      signInCaseSensitive: false,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        preferredUsername: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'spidey-social-web',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      oAuth: undefined,
    });

    // --- DynamoDB single table ---
    this.table = new dynamodb.Table(this, 'Table', {
      tableName: 'SpideySocial',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttlEpoch',
    });

    // GSI1: nearby users by geohash, sorted by Aura (e.g. gsi1pk = GEOHASH#<hash>, gsi1sk = aura number)
    this.table.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: users by university + interest (gsi2pk = university, gsi2sk = interest category)
    this.table.addGlobalSecondaryIndex({
      indexName: 'gsi2',
      partitionKey: { name: 'gsi2pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi2sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- S3 bucket for static site ---
    this.webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: undefined, // let CDK generate
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Frontend: build with `cd frontend && npm run build`, then upload dist to WebBucket or use CI.

    // --- CloudFront (use Distribution for SPA and custom error) ---
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
      comment: 'Spidey Social Web App',
    });

    // --- API Gateway REST API (no routes yet; Lambdas in later slices) ---
    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: 'spidey-social-api',
      deployOptions: { stageName: 'prod' },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Placeholder resource so the API deploys (optional)
    this.restApi.root.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [{ statusCode: '200', responseTemplates: { 'application/json': '{"message":"Spidey Social API"}' } }],
    }), { methodResponses: [{ statusCode: '200' }] });

    // --- API Gateway WebSocket API (placeholder Lambdas for $connect / $disconnect) ---
    const wsConnectHandler = new lambda.Function(this, 'WsConnect', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => ({ statusCode: 200 });
      `),
    });

    const wsDisconnectHandler = new lambda.Function(this, 'WsDisconnect', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => ({ statusCode: 200 });
      `),
    });

    this.webSocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      apiName: 'spidey-social-ws',
      connectRouteOptions: { integration: new WebSocketLambdaIntegration('Connect', wsConnectHandler) },
      disconnectRouteOptions: { integration: new WebSocketLambdaIntegration('Disconnect', wsDisconnectHandler) },
    });

    new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi: this.webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId, description: 'Cognito User Pool ID' });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId, description: 'Cognito Client ID' });
    new cdk.CfnOutput(this, 'TableName', { value: this.table.tableName, description: 'DynamoDB Table Name' });
    new cdk.CfnOutput(this, 'WebBucketName', { value: this.webBucket.bucketName, description: 'S3 Web Bucket' });
    new cdk.CfnOutput(this, 'CloudFrontUrl', { value: `https://${this.distribution.distributionDomainName}`, description: 'CloudFront URL' });
    new cdk.CfnOutput(this, 'RestApiUrl', { value: this.restApi.url, description: 'REST API URL' });
    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: this.webSocketApi.apiEndpoint,
      description: 'WebSocket API endpoint (add /prod)',
    });
  }
}
