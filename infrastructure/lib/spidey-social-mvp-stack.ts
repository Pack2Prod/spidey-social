/**
 * MVP Stack — S3 + DynamoDB + Cognito + API Gateway (Web Wall).
 */
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3StaticWebsiteOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class SpideySocialMvpStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly webBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly restApi: apigateway.RestApi;
  public readonly webSocketApi: apigatewayv2.WebSocketApi;
  /** URL to open the site (S3 static website) */
  public readonly websiteUrl: string;

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
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'spidey-social-web',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // --- DynamoDB table (GSI for listing webs) ---
    this.table = new dynamodb.Table(this, 'Table', {
      tableName: 'SpideySocialMvp',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttlEpoch',
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'gsi2',
      partitionKey: { name: 'gsi2pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi2sk', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- S3 bucket with static website hosting (no CloudFront, no autoDelete to avoid Lambda) ---
    this.webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA fallback
    });

    this.webBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'PublicReadGetObject',
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:GetObject'],
        resources: [`${this.webBucket.bucketArn}/*`],
      })
    );

    // --- CloudFront (HTTPS for geolocation) ---
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new S3StaticWebsiteOrigin(this.webBucket),
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      ],
    });

    this.websiteUrl = `https://${this.distribution.distributionDomainName}`;

    // --- Cognito authorizer for REST API ---
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [this.userPool],
      identitySource: 'method.request.header.Authorization',
    });

    // --- REST API ---
    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: 'spidey-social-api',
      deployOptions: { stageName: 'prod' },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const lambdasPath = path.join(__dirname, '../lambdas');

    const createWebFn = new lambda.Function(this, 'CreateWeb', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(lambdasPath, 'create-web')),
      environment: { TABLE_NAME: this.table.tableName },
      timeout: cdk.Duration.seconds(15),
    });
    this.table.grantReadWriteData(createWebFn);

    const listWebsFn = new lambda.Function(this, 'ListWebs', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(lambdasPath, 'list-webs')),
      environment: { TABLE_NAME: this.table.tableName },
    });
    this.table.grantReadData(listWebsFn);

    const swingInFn = new lambda.Function(this, 'SwingIn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(lambdasPath, 'swing-in')),
      environment: { TABLE_NAME: this.table.tableName },
    });
    this.table.grantReadWriteData(swingInFn);

    // WebSocket API (for live feed fan-out)
    const wsConnectFn = new lambda.Function(this, 'WsConnect', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(lambdasPath, 'ws-connect')),
      environment: { TABLE_NAME: this.table.tableName },
    });
    this.table.grantReadWriteData(wsConnectFn);

    const wsDisconnectFn = new lambda.Function(this, 'WsDisconnect', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(lambdasPath, 'ws-disconnect')),
      environment: { TABLE_NAME: this.table.tableName },
    });
    this.table.grantReadWriteData(wsDisconnectFn);

    this.webSocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      apiName: 'spidey-social-ws',
      connectRouteOptions: { integration: new WebSocketLambdaIntegration('Connect', wsConnectFn) },
      disconnectRouteOptions: { integration: new WebSocketLambdaIntegration('Disconnect', wsDisconnectFn) },
    });

    const wsStage = new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi: this.webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    const wsEndpoint = `https://${this.webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${wsStage.stageName}`;
    createWebFn.addEnvironment('WS_ENDPOINT', wsEndpoint);
    swingInFn.addEnvironment('WS_ENDPOINT', wsEndpoint);
    swingInFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: [`arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/*`],
      })
    );
    createWebFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: [`arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/*`],
      })
    );

    // Gateway Responses — add CORS headers to error responses (502, 403, etc.)
    const corsHeaders = {
      'Access-Control-Allow-Origin': "'*'",
      'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      'Access-Control-Allow-Methods': "'GET,POST,PUT,OPTIONS,DELETE,PATCH,HEAD'",
    };
    this.restApi.addGatewayResponse('Default4xx', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: corsHeaders,
    });
    this.restApi.addGatewayResponse('Default5xx', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: corsHeaders,
    });

    // REST routes
    const webs = this.restApi.root.addResource('webs');
    webs.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createWebFn, { proxy: true }),
      { authorizer }
    );
    webs.addMethod(
      'GET',
      new apigateway.LambdaIntegration(listWebsFn, { proxy: true })
    );
    const webId = webs.addResource('{webId}');
    const swingIn = webId.addResource('swing-in');
    swingIn.addMethod(
      'POST',
      new apigateway.LambdaIntegration(swingInFn, { proxy: true }),
      { authorizer }
    );

    // --- Outputs ---
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID — add to frontend .env as VITE_COGNITO_USER_POOL_ID',
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito Client ID — add to frontend .env as VITE_COGNITO_CLIENT_ID',
    });
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB table',
    });
    new cdk.CfnOutput(this, 'WebBucketName', {
      value: this.webBucket.bucketName,
      description: 'S3 bucket for the React app',
    });
    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: this.websiteUrl,
      description: 'HTTPS URL — use this for geolocation to work (after uploading frontend to S3)',
    });
    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID — used for cache invalidation',
    });
    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: this.restApi.url,
      description: 'REST API URL — add to frontend .env as VITE_API_URL',
    });
    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: `wss://${this.webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${wsStage.stageName}`,
      description: 'WebSocket URL — add to frontend .env as VITE_WS_URL',
    });
  }
}
