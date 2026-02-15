"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpideySocialMvpStack = void 0;
/**
 * MVP Stack — S3 + DynamoDB + Cognito + API Gateway (Web Wall).
 */
const path = __importStar(require("path"));
const cdk = __importStar(require("aws-cdk-lib"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const aws_cloudfront_origins_1 = require("aws-cdk-lib/aws-cloudfront-origins");
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const aws_apigatewayv2_integrations_1 = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
class SpideySocialMvpStack extends cdk.Stack {
    table;
    webBucket;
    distribution;
    userPool;
    userPoolClient;
    restApi;
    webSocketApi;
    /** URL to open the site (S3 static website) */
    websiteUrl;
    constructor(scope, id, props) {
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
        this.table.addGlobalSecondaryIndex({
            indexName: 'gsi_geo',
            partitionKey: { name: 'gsi_geopk', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'gsi_geosk', type: dynamodb.AttributeType.NUMBER },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        this.table.addGlobalSecondaryIndex({
            indexName: 'gsi_conn_geo',
            partitionKey: { name: 'gsi_conn_geopk', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'gsi_conn_geosk', type: dynamodb.AttributeType.STRING },
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
        this.webBucket.addToResourcePolicy(new iam.PolicyStatement({
            sid: 'PublicReadGetObject',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['s3:GetObject'],
            resources: [`${this.webBucket.bucketArn}/*`],
        }));
        // --- CloudFront (HTTPS for geolocation) ---
        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin: new aws_cloudfront_origins_1.S3StaticWebsiteOrigin(this.webBucket),
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
        const listMyWebsFn = new lambda.Function(this, 'ListMyWebs', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(lambdasPath, 'list-my-webs')),
            environment: { TABLE_NAME: this.table.tableName },
            timeout: cdk.Duration.seconds(15),
        });
        this.table.grantReadData(listMyWebsFn);
        const sendMessageFn = new lambda.Function(this, 'SendMessage', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(lambdasPath, 'send-message')),
            environment: { TABLE_NAME: this.table.tableName },
            timeout: cdk.Duration.seconds(10),
        });
        this.table.grantReadWriteData(sendMessageFn);
        const listMessagesFn = new lambda.Function(this, 'ListMessages', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(lambdasPath, 'list-messages')),
            environment: { TABLE_NAME: this.table.tableName },
            timeout: cdk.Duration.seconds(10),
        });
        this.table.grantReadData(listMessagesFn);
        const listMySwingsFn = new lambda.Function(this, 'ListMySwings', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(lambdasPath, 'list-my-swings')),
            environment: { TABLE_NAME: this.table.tableName },
            timeout: cdk.Duration.seconds(15),
        });
        this.table.grantReadData(listMySwingsFn);
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
            environment: {
                TABLE_NAME: this.table.tableName,
                COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
            },
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
            connectRouteOptions: { integration: new aws_apigatewayv2_integrations_1.WebSocketLambdaIntegration('Connect', wsConnectFn) },
            disconnectRouteOptions: { integration: new aws_apigatewayv2_integrations_1.WebSocketLambdaIntegration('Disconnect', wsDisconnectFn) },
        });
        const wsStage = new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
            webSocketApi: this.webSocketApi,
            stageName: 'prod',
            autoDeploy: true,
        });
        const wsEndpoint = `https://${this.webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${wsStage.stageName}`;
        createWebFn.addEnvironment('WS_ENDPOINT', wsEndpoint);
        swingInFn.addEnvironment('WS_ENDPOINT', wsEndpoint);
        sendMessageFn.addEnvironment('WS_ENDPOINT', wsEndpoint);
        swingInFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [`arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/*`],
        }));
        sendMessageFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [`arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/*`],
        }));
        createWebFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [`arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/*`],
        }));
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
        webs.addMethod('POST', new apigateway.LambdaIntegration(createWebFn, { proxy: true }), { authorizer });
        webs.addMethod('GET', new apigateway.LambdaIntegration(listWebsFn, { proxy: true }));
        const webId = webs.addResource('{webId}');
        const swingIn = webId.addResource('swing-in');
        swingIn.addMethod('POST', new apigateway.LambdaIntegration(swingInFn, { proxy: true }), { authorizer });
        const users = this.restApi.root.addResource('users');
        const me = users.addResource('me');
        const meWebs = me.addResource('webs');
        meWebs.addMethod('GET', new apigateway.LambdaIntegration(listMyWebsFn, { proxy: true }), { authorizer });
        const meSwings = me.addResource('swings');
        meSwings.addMethod('GET', new apigateway.LambdaIntegration(listMySwingsFn, { proxy: true }), { authorizer });
        const chats = this.restApi.root.addResource('chats');
        const chatWebId = chats.addResource('{webId}');
        const chatMessages = chatWebId.addResource('messages');
        chatMessages.addMethod('GET', new apigateway.LambdaIntegration(listMessagesFn, { proxy: true }), { authorizer });
        chatMessages.addMethod('POST', new apigateway.LambdaIntegration(sendMessageFn, { proxy: true }), { authorizer });
        // --- CloudWatch Dashboard (operational metrics) ---
        const dashboard = new cloudwatch.Dashboard(this, 'OpsDashboard', {
            dashboardName: 'SpideySocialMvp-Ops',
            defaultInterval: cdk.Duration.hours(3),
        });
        const lambdaFunctions = [
            createWebFn,
            listWebsFn,
            listMyWebsFn,
            listMessagesFn,
            listMySwingsFn,
            swingInFn,
            sendMessageFn,
            wsConnectFn,
            wsDisconnectFn,
        ];
        dashboard.addWidgets(new cloudwatch.Row(new cloudwatch.GraphWidget({
            title: 'Lambda Invocations',
            left: lambdaFunctions.map((fn) => fn.metricInvocations({ statistic: 'Sum' })),
            width: 12,
            period: cdk.Duration.minutes(5),
        }), new cloudwatch.GraphWidget({
            title: 'Lambda Duration (ms) — Latency',
            left: lambdaFunctions.map((fn) => fn.metricDuration({ statistic: 'Average' })),
            width: 12,
            period: cdk.Duration.minutes(5),
        })), new cloudwatch.Row(new cloudwatch.GraphWidget({
            title: 'Lambda Errors',
            left: lambdaFunctions.map((fn) => fn.metricErrors({ statistic: 'Sum' })),
            width: 12,
            period: cdk.Duration.minutes(5),
        }), new cloudwatch.GraphWidget({
            title: 'Lambda Concurrent Executions',
            left: [lambda.Function.metricAllConcurrentExecutions()],
            width: 12,
            period: cdk.Duration.minutes(1),
        })), new cloudwatch.Row(new cloudwatch.GraphWidget({
            title: 'REST API — Request Count',
            left: [this.restApi.metricCount({ statistic: 'Sum' })],
            width: 12,
            period: cdk.Duration.minutes(5),
        }), new cloudwatch.GraphWidget({
            title: 'REST API — Latency (ms)',
            left: [this.restApi.metricLatency({ statistic: 'Average' })],
            width: 12,
            period: cdk.Duration.minutes(5),
        })), new cloudwatch.Row(new cloudwatch.GraphWidget({
            title: 'REST API — 4xx / 5xx Errors',
            left: [
                this.restApi.metric('4XXError', { statistic: 'Sum' }),
                this.restApi.metric('5XXError', { statistic: 'Sum' }),
            ],
            width: 12,
            period: cdk.Duration.minutes(5),
        }), new cloudwatch.GraphWidget({
            title: 'DynamoDB — Consumed Read/Write Capacity',
            left: [
                this.table.metricConsumedReadCapacityUnits({ statistic: 'Sum' }),
                this.table.metricConsumedWriteCapacityUnits({ statistic: 'Sum' }),
            ],
            width: 12,
            period: cdk.Duration.minutes(5),
        })));
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
        new cdk.CfnOutput(this, 'OpsDashboardUrl', {
            value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=SpideySocialMvp-Ops`,
            description: 'CloudWatch Ops Dashboard — latency, invocations, errors, resource usage',
        });
    }
}
exports.SpideySocialMvpStack = SpideySocialMvpStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BpZGV5LXNvY2lhbC1tdnAtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvc3BpZGV5LXNvY2lhbC1tdnAtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7R0FFRztBQUNILDJDQUE2QjtBQUM3QixpREFBbUM7QUFDbkMsdUVBQXlEO0FBQ3pELCtFQUEyRTtBQUMzRSx1RUFBeUQ7QUFDekQsMkVBQTZEO0FBQzdELDZGQUF1RjtBQUN2Rix1RUFBeUQ7QUFDekQsaUVBQW1EO0FBQ25ELG1FQUFxRDtBQUNyRCx5REFBMkM7QUFDM0MsK0RBQWlEO0FBQ2pELHVEQUF5QztBQUd6QyxNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pDLEtBQUssQ0FBaUI7SUFDdEIsU0FBUyxDQUFZO0lBQ3JCLFlBQVksQ0FBMEI7SUFDdEMsUUFBUSxDQUFtQjtJQUMzQixjQUFjLENBQXlCO0lBQ3ZDLE9BQU8sQ0FBcUI7SUFDNUIsWUFBWSxDQUE0QjtJQUN4RCwrQ0FBK0M7SUFDL0IsVUFBVSxDQUFTO0lBRW5DLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsNEJBQTRCO1FBQzVCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDckQsWUFBWSxFQUFFLHFCQUFxQjtZQUNuQyxtQkFBbUIsRUFBRSxLQUFLO1lBQzFCLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtZQUM5QixVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO1lBQzNCLGtCQUFrQixFQUFFO2dCQUNsQixLQUFLLEVBQUUsRUFBRSxRQUFRLEVB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U0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDcEMsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVO1lBQ3RCLFdBQVcsRUFBRSwrRUFBK0U7U0FDN0YsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNsRCxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjO1lBQ3ZDLFdBQVcsRUFBRSwwREFBMEQ7U0FDeEUsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDcEMsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRztZQUN2QixXQUFXLEVBQUUscURBQXFEO1NBQ25FLENBQUMsQ0FBQztRQUNILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSxTQUFTLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxnQkFBZ0IsSUFBSSxDQUFDLE1BQU0sa0JBQWtCLE9BQU8sQ0FBQyxTQUFTLEVBQUU7WUFDdkcsV0FBVyxFQUFFLHFEQUFxRDtTQUNuRSxDQUFDLENBQUM7UUFDSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxXQUFXLElBQUksQ0FBQyxNQUFNLGtEQUFrRCxJQUFJLENBQUMsTUFBTSxzQ0FBc0M7WUFDaEksV0FBVyxFQUFFLHlFQUF5RTtTQUN2RixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFwYkQsb0RBb2JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBNVlAgU3RhY2sg4oCUIFMzICsgRHluYW1vREIgKyBDb2duaXRvICsgQVBJIEdhdGV3YXkgKFdlYiBXYWxsKS5cbiAqL1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCB7IFMzU3RhdGljV2Vic2l0ZU9yaWdpbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mic7XG5pbXBvcnQgeyBXZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djItaW50ZWdyYXRpb25zJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgU3BpZGV5U29jaWFsTXZwU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgd2ViQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgcHVibGljIHJlYWRvbmx5IHJlc3RBcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IHdlYlNvY2tldEFwaTogYXBpZ2F0ZXdheXYyLldlYlNvY2tldEFwaTtcbiAgLyoqIFVSTCB0byBvcGVuIHRoZSBzaXRlIChTMyBzdGF0aWMgd2Vic2l0ZSkgKi9cbiAgcHVibGljIHJlYWRvbmx5IHdlYnNpdGVVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyAtLS0gQ29nbml0byBVc2VyIFBvb2wgLS0tXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogJ3NwaWRleS1zb2NpYWwtdXNlcnMnLFxuICAgICAgc2lnbkluQ2FzZVNlbnNpdGl2ZTogZmFsc2UsXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHsgZW1haWw6IHRydWUgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHsgZW1haWw6IHRydWUgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogdHJ1ZSB9LFxuICAgICAgICBwcmVmZXJyZWRVc2VybmFtZTogeyByZXF1aXJlZDogZmFsc2UsIG11dGFibGU6IHRydWUgfSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgdGhpcy51c2VyUG9vbENsaWVudCA9IHRoaXMudXNlclBvb2wuYWRkQ2xpZW50KCdXZWJDbGllbnQnLCB7XG4gICAgICB1c2VyUG9vbENsaWVudE5hbWU6ICdzcGlkZXktc29jaWFsLXdlYicsXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcbiAgICB9KTtcblxuICAgIC8vIC0tLSBEeW5hbW9EQiB0YWJsZSAoR1NJIGZvciBsaXN0aW5nIHdlYnMpIC0tLVxuICAgIHRoaXMudGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnU3BpZGV5U29jaWFsTXZwJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncGsnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnc2snLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAndHRsRXBvY2gnLFxuICAgIH0pO1xuICAgIHRoaXMudGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnZ3NpMScsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2dzaTFwaycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdnc2kxc2snLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICB9KTtcbiAgICB0aGlzLnRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2dzaTInLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdnc2kycGsnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZ3NpMnNrJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXG4gICAgfSk7XG4gICAgdGhpcy50YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdnc2lfZ2VvJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZ3NpX2dlb3BrJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2dzaV9nZW9zaycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuICAgIHRoaXMudGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnZ3NpX2Nvbm5fZ2VvJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZ3NpX2Nvbm5fZ2VvcGsnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZ3NpX2Nvbm5fZ2Vvc2snLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICB9KTtcblxuICAgIC8vIC0tLSBTMyBidWNrZXQgd2l0aCBzdGF0aWMgd2Vic2l0ZSBob3N0aW5nIChubyBDbG91ZEZyb250LCBubyBhdXRvRGVsZXRlIHRvIGF2b2lkIExhbWJkYSkgLS0tXG4gICAgdGhpcy53ZWJCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdXZWJCdWNrZXQnLCB7XG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogbmV3IHMzLkJsb2NrUHVibGljQWNjZXNzKHtcbiAgICAgICAgYmxvY2tQdWJsaWNBY2xzOiBmYWxzZSxcbiAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IGZhbHNlLFxuICAgICAgICBpZ25vcmVQdWJsaWNBY2xzOiBmYWxzZSxcbiAgICAgICAgcmVzdHJpY3RQdWJsaWNCdWNrZXRzOiBmYWxzZSxcbiAgICAgIH0pLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHdlYnNpdGVJbmRleERvY3VtZW50OiAnaW5kZXguaHRtbCcsXG4gICAgICB3ZWJzaXRlRXJyb3JEb2N1bWVudDogJ2luZGV4Lmh0bWwnLCAvLyBTUEEgZmFsbGJhY2tcbiAgICB9KTtcblxuICAgIHRoaXMud2ViQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIHNpZDogJ1B1YmxpY1JlYWRHZXRPYmplY3QnLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLkFueVByaW5jaXBhbCgpXSxcbiAgICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbYCR7dGhpcy53ZWJCdWNrZXQuYnVja2V0QXJufS8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyAtLS0gQ2xvdWRGcm9udCAoSFRUUFMgZm9yIGdlb2xvY2F0aW9uKSAtLS1cbiAgICB0aGlzLmRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnRGlzdHJpYnV0aW9uJywge1xuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgIG9yaWdpbjogbmV3IFMzU3RhdGljV2Vic2l0ZU9yaWdpbih0aGlzLndlYkJ1Y2tldCksXG4gICAgICB9LFxuICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHsgaHR0cFN0YXR1czogNDAzLCByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCwgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJywgdHRsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygwKSB9LFxuICAgICAgICB7IGh0dHBTdGF0dXM6IDQwNCwgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsIHR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMCkgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICB0aGlzLndlYnNpdGVVcmwgPSBgaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YDtcblxuICAgIC8vIC0tLSBDb2duaXRvIGF1dGhvcml6ZXIgZm9yIFJFU1QgQVBJIC0tLVxuICAgIGNvbnN0IGF1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcih0aGlzLCAnQXV0aG9yaXplcicsIHtcbiAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFt0aGlzLnVzZXJQb29sXSxcbiAgICAgIGlkZW50aXR5U291cmNlOiAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb24nLFxuICAgIH0pO1xuXG4gICAgLy8gLS0tIFJFU1QgQVBJIC0tLVxuICAgIHRoaXMucmVzdEFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ1Jlc3RBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogJ3NwaWRleS1zb2NpYWwtYXBpJyxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHsgc3RhZ2VOYW1lOiAncHJvZCcgfSxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGxhbWJkYXNQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYXMnKTtcblxuICAgIGNvbnN0IGNyZWF0ZVdlYkZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ3JlYXRlV2ViJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKGxhbWJkYXNQYXRoLCAnY3JlYXRlLXdlYicpKSxcbiAgICAgIGVudmlyb25tZW50OiB7IFRBQkxFX05BTUU6IHRoaXMudGFibGUudGFibGVOYW1lIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxNSksXG4gICAgfSk7XG4gICAgdGhpcy50YWJsZS5ncmFudFJlYWRXcml0ZURhdGEoY3JlYXRlV2ViRm4pO1xuXG4gICAgY29uc3QgbGlzdFdlYnNGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xpc3RXZWJzJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKGxhbWJkYXNQYXRoLCAnbGlzdC13ZWJzJykpLFxuICAgICAgZW52aXJvbm1lbnQ6IHsgVEFCTEVfTkFNRTogdGhpcy50YWJsZS50YWJsZU5hbWUgfSxcbiAgICB9KTtcbiAgICB0aGlzLnRhYmxlLmdyYW50UmVhZERhdGEobGlzdFdlYnNGbik7XG5cbiAgICBjb25zdCBsaXN0TXlXZWJzRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMaXN0TXlXZWJzJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKGxhbWJkYXNQYXRoLCAnbGlzdC1teS13ZWJzJykpLFxuICAgICAgZW52aXJvbm1lbnQ6IHsgVEFCTEVfTkFNRTogdGhpcy50YWJsZS50YWJsZU5hbWUgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcbiAgICB9KTtcbiAgICB0aGlzLnRhYmxlLmdyYW50UmVhZERhdGEobGlzdE15V2Vic0ZuKTtcblxuICAgIGNvbnN0IHNlbmRNZXNzYWdlRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTZW5kTWVzc2FnZScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihsYW1iZGFzUGF0aCwgJ3NlbmQtbWVzc2FnZScpKSxcbiAgICAgIGVudmlyb25tZW50OiB7IFRBQkxFX05BTUU6IHRoaXMudGFibGUudGFibGVOYW1lIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgfSk7XG4gICAgdGhpcy50YWJsZS5ncmFudFJlYWRXcml0ZURhdGEoc2VuZE1lc3NhZ2VGbik7XG5cbiAgICBjb25zdCBsaXN0TWVzc2FnZXNGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xpc3RNZXNzYWdlcycsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihsYW1iZGFzUGF0aCwgJ2xpc3QtbWVzc2FnZXMnKSksXG4gICAgICBlbnZpcm9ubWVudDogeyBUQUJMRV9OQU1FOiB0aGlzLnRhYmxlLnRhYmxlTmFtZSB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pO1xuICAgIHRoaXMudGFibGUuZ3JhbnRSZWFkRGF0YShsaXN0TWVzc2FnZXNGbik7XG5cbiAgICBjb25zdCBsaXN0TXlTd2luZ3NGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xpc3RNeVN3aW5ncycsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihsYW1iZGFzUGF0aCwgJ2xpc3QtbXktc3dpbmdzJykpLFxuICAgICAgZW52aXJvbm1lbnQ6IHsgVEFCTEVfTkFNRTogdGhpcy50YWJsZS50YWJsZU5hbWUgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcbiAgICB9KTtcbiAgICB0aGlzLnRhYmxlLmdyYW50UmVhZERhdGEobGlzdE15U3dpbmdzRm4pO1xuXG4gICAgY29uc3Qgc3dpbmdJbkZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3dpbmdJbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihsYW1iZGFzUGF0aCwgJ3N3aW5nLWluJykpLFxuICAgICAgZW52aXJvbm1lbnQ6IHsgVEFCTEVfTkFNRTogdGhpcy50YWJsZS50YWJsZU5hbWUgfSxcbiAgICB9KTtcbiAgICB0aGlzLnRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzd2luZ0luRm4pO1xuXG4gICAgLy8gV2ViU29ja2V0IEFQSSAoZm9yIGxpdmUgZmVlZCBmYW4tb3V0KVxuICAgIGNvbnN0IHdzQ29ubmVjdEZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnV3NDb25uZWN0Jywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKGxhbWJkYXNQYXRoLCAnd3MtY29ubmVjdCcpKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IHRoaXMudGFibGUudGFibGVOYW1lLFxuICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBDT0dOSVRPX0NMSUVOVF9JRDogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICB0aGlzLnRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh3c0Nvbm5lY3RGbik7XG5cbiAgICBjb25zdCB3c0Rpc2Nvbm5lY3RGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1dzRGlzY29ubmVjdCcsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihsYW1iZGFzUGF0aCwgJ3dzLWRpc2Nvbm5lY3QnKSksXG4gICAgICBlbnZpcm9ubWVudDogeyBUQUJMRV9OQU1FOiB0aGlzLnRhYmxlLnRhYmxlTmFtZSB9LFxuICAgIH0pO1xuICAgIHRoaXMudGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHdzRGlzY29ubmVjdEZuKTtcblxuICAgIHRoaXMud2ViU29ja2V0QXBpID0gbmV3IGFwaWdhdGV3YXl2Mi5XZWJTb2NrZXRBcGkodGhpcywgJ1dlYlNvY2tldEFwaScsIHtcbiAgICAgIGFwaU5hbWU6ICdzcGlkZXktc29jaWFsLXdzJyxcbiAgICAgIGNvbm5lY3RSb3V0ZU9wdGlvbnM6IHsgaW50ZWdyYXRpb246IG5ldyBXZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbignQ29ubmVjdCcsIHdzQ29ubmVjdEZuKSB9LFxuICAgICAgZGlzY29ubmVjdFJvdXRlT3B0aW9uczogeyBpbnRlZ3JhdGlvbjogbmV3IFdlYlNvY2tldExhbWJkYUludGVncmF0aW9uKCdEaXNjb25uZWN0Jywgd3NEaXNjb25uZWN0Rm4pIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB3c1N0YWdlID0gbmV3IGFwaWdhdGV3YXl2Mi5XZWJTb2NrZXRTdGFnZSh0aGlzLCAnV2ViU29ja2V0U3RhZ2UnLCB7XG4gICAgICB3ZWJTb2NrZXRBcGk6IHRoaXMud2ViU29ja2V0QXBpLFxuICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXG4gICAgICBhdXRvRGVwbG95OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgd3NFbmRwb2ludCA9IGBodHRwczovLyR7dGhpcy53ZWJTb2NrZXRBcGkuYXBpSWR9LmV4ZWN1dGUtYXBpLiR7dGhpcy5yZWdpb259LmFtYXpvbmF3cy5jb20vJHt3c1N0YWdlLnN0YWdlTmFtZX1gO1xuICAgIGNyZWF0ZVdlYkZuLmFkZEVudmlyb25tZW50KCdXU19FTkRQT0lOVCcsIHdzRW5kcG9pbnQpO1xuICAgIHN3aW5nSW5Gbi5hZGRFbnZpcm9ubWVudCgnV1NfRU5EUE9JTlQnLCB3c0VuZHBvaW50KTtcbiAgICBzZW5kTWVzc2FnZUZuLmFkZEVudmlyb25tZW50KCdXU19FTkRQT0lOVCcsIHdzRW5kcG9pbnQpO1xuICAgIHN3aW5nSW5Gbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnMnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OiR7dGhpcy53ZWJTb2NrZXRBcGkuYXBpSWR9LypgXSxcbiAgICAgIH0pXG4gICAgKTtcbiAgICBzZW5kTWVzc2FnZUZuLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydleGVjdXRlLWFwaTpNYW5hZ2VDb25uZWN0aW9ucyddLFxuICAgICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpleGVjdXRlLWFwaToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHt0aGlzLndlYlNvY2tldEFwaS5hcGlJZH0vKmBdLFxuICAgICAgfSlcbiAgICApO1xuICAgIGNyZWF0ZVdlYkZuLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydleGVjdXRlLWFwaTpNYW5hZ2VDb25uZWN0aW9ucyddLFxuICAgICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpleGVjdXRlLWFwaToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHt0aGlzLndlYlNvY2tldEFwaS5hcGlJZH0vKmBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR2F0ZXdheSBSZXNwb25zZXMg4oCUIGFkZCBDT1JTIGhlYWRlcnMgdG8gZXJyb3IgcmVzcG9uc2VzICg1MDIsIDQwMywgZXRjLilcbiAgICBjb25zdCBjb3JzSGVhZGVycyA9IHtcbiAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiLFxuICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBcIidDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbidcIixcbiAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInR0VULFBPU1QsUFVULE9QVElPTlMsREVMRVRFLFBBVENILEhFQUQnXCIsXG4gICAgfTtcbiAgICB0aGlzLnJlc3RBcGkuYWRkR2F0ZXdheVJlc3BvbnNlKCdEZWZhdWx0NHh4Jywge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuREVGQVVMVF80WFgsXG4gICAgICByZXNwb25zZUhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgIH0pO1xuICAgIHRoaXMucmVzdEFwaS5hZGRHYXRld2F5UmVzcG9uc2UoJ0RlZmF1bHQ1eHgnLCB7XG4gICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5ERUZBVUxUXzVYWCxcbiAgICAgIHJlc3BvbnNlSGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgfSk7XG5cbiAgICAvLyBSRVNUIHJvdXRlc1xuICAgIGNvbnN0IHdlYnMgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnd2VicycpO1xuICAgIHdlYnMuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY3JlYXRlV2ViRm4sIHsgcHJveHk6IHRydWUgfSksXG4gICAgICB7IGF1dGhvcml6ZXIgfVxuICAgICk7XG4gICAgd2Vicy5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxpc3RXZWJzRm4sIHsgcHJveHk6IHRydWUgfSlcbiAgICApO1xuICAgIGNvbnN0IHdlYklkID0gd2Vicy5hZGRSZXNvdXJjZSgne3dlYklkfScpO1xuICAgIGNvbnN0IHN3aW5nSW4gPSB3ZWJJZC5hZGRSZXNvdXJjZSgnc3dpbmctaW4nKTtcbiAgICBzd2luZ0luLmFkZE1ldGhvZChcbiAgICAgICdQT1NUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN3aW5nSW5GbiwgeyBwcm94eTogdHJ1ZSB9KSxcbiAgICAgIHsgYXV0aG9yaXplciB9XG4gICAgKTtcblxuICAgIGNvbnN0IHVzZXJzID0gdGhpcy5yZXN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3VzZXJzJyk7XG4gICAgY29uc3QgbWUgPSB1c2Vycy5hZGRSZXNvdXJjZSgnbWUnKTtcbiAgICBjb25zdCBtZVdlYnMgPSBtZS5hZGRSZXNvdXJjZSgnd2VicycpO1xuICAgIG1lV2Vicy5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxpc3RNeVdlYnNGbiwgeyBwcm94eTogdHJ1ZSB9KSxcbiAgICAgIHsgYXV0aG9yaXplciB9XG4gICAgKTtcbiAgICBjb25zdCBtZVN3aW5ncyA9IG1lLmFkZFJlc291cmNlKCdzd2luZ3MnKTtcbiAgICBtZVN3aW5ncy5hZGRNZXRob2QoXG4gICAgICAnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxpc3RNeVN3aW5nc0ZuLCB7IHByb3h5OiB0cnVlIH0pLFxuICAgICAgeyBhdXRob3JpemVyIH1cbiAgICApO1xuXG4gICAgY29uc3QgY2hhdHMgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnY2hhdHMnKTtcbiAgICBjb25zdCBjaGF0V2ViSWQgPSBjaGF0cy5hZGRSZXNvdXJjZSgne3dlYklkfScpO1xuICAgIGNvbnN0IGNoYXRNZXNzYWdlcyA9IGNoYXRXZWJJZC5hZGRSZXNvdXJjZSgnbWVzc2FnZXMnKTtcbiAgICBjaGF0TWVzc2FnZXMuYWRkTWV0aG9kKFxuICAgICAgJ0dFVCcsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsaXN0TWVzc2FnZXNGbiwgeyBwcm94eTogdHJ1ZSB9KSxcbiAgICAgIHsgYXV0aG9yaXplciB9XG4gICAgKTtcbiAgICBjaGF0TWVzc2FnZXMuYWRkTWV0aG9kKFxuICAgICAgJ1BPU1QnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2VuZE1lc3NhZ2VGbiwgeyBwcm94eTogdHJ1ZSB9KSxcbiAgICAgIHsgYXV0aG9yaXplciB9XG4gICAgKTtcblxuICAgIC8vIC0tLSBDbG91ZFdhdGNoIERhc2hib2FyZCAob3BlcmF0aW9uYWwgbWV0cmljcykgLS0tXG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdPcHNEYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiAnU3BpZGV5U29jaWFsTXZwLU9wcycsXG4gICAgICBkZWZhdWx0SW50ZXJ2YWw6IGNkay5EdXJhdGlvbi5ob3VycygzKSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGxhbWJkYUZ1bmN0aW9ucyA9IFtcbiAgICAgIGNyZWF0ZVdlYkZuLFxuICAgICAgbGlzdFdlYnNGbixcbiAgICAgIGxpc3RNeVdlYnNGbixcbiAgICAgIGxpc3RNZXNzYWdlc0ZuLFxuICAgICAgbGlzdE15U3dpbmdzRm4sXG4gICAgICBzd2luZ0luRm4sXG4gICAgICBzZW5kTWVzc2FnZUZuLFxuICAgICAgd3NDb25uZWN0Rm4sXG4gICAgICB3c0Rpc2Nvbm5lY3RGbixcbiAgICBdO1xuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5Sb3coXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogJ0xhbWJkYSBJbnZvY2F0aW9ucycsXG4gICAgICAgICAgbGVmdDogbGFtYmRhRnVuY3Rpb25zLm1hcCgoZm4pID0+IGZuLm1ldHJpY0ludm9jYXRpb25zKHsgc3RhdGlzdGljOiAnU3VtJyB9KSksXG4gICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgdGl0bGU6ICdMYW1iZGEgRHVyYXRpb24gKG1zKSDigJQgTGF0ZW5jeScsXG4gICAgICAgICAgbGVmdDogbGFtYmRhRnVuY3Rpb25zLm1hcCgoZm4pID0+IGZuLm1ldHJpY0R1cmF0aW9uKHsgc3RhdGlzdGljOiAnQXZlcmFnZScgfSkpLFxuICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KVxuICAgICAgKSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlJvdyhcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgIHRpdGxlOiAnTGFtYmRhIEVycm9ycycsXG4gICAgICAgICAgbGVmdDogbGFtYmRhRnVuY3Rpb25zLm1hcCgoZm4pID0+IGZuLm1ldHJpY0Vycm9ycyh7IHN0YXRpc3RpYzogJ1N1bScgfSkpLFxuICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgIHRpdGxlOiAnTGFtYmRhIENvbmN1cnJlbnQgRXhlY3V0aW9ucycsXG4gICAgICAgICAgbGVmdDogW2xhbWJkYS5GdW5jdGlvbi5tZXRyaWNBbGxDb25jdXJyZW50RXhlY3V0aW9ucygpXSxcbiAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgfSlcbiAgICAgICksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5Sb3coXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogJ1JFU1QgQVBJIOKAlCBSZXF1ZXN0IENvdW50JyxcbiAgICAgICAgICBsZWZ0OiBbdGhpcy5yZXN0QXBpLm1ldHJpY0NvdW50KHsgc3RhdGlzdGljOiAnU3VtJyB9KV0sXG4gICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgdGl0bGU6ICdSRVNUIEFQSSDigJQgTGF0ZW5jeSAobXMpJyxcbiAgICAgICAgICBsZWZ0OiBbdGhpcy5yZXN0QXBpLm1ldHJpY0xhdGVuY3koeyBzdGF0aXN0aWM6ICdBdmVyYWdlJyB9KV0sXG4gICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pXG4gICAgICApLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guUm93KFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgdGl0bGU6ICdSRVNUIEFQSSDigJQgNHh4IC8gNXh4IEVycm9ycycsXG4gICAgICAgICAgbGVmdDogW1xuICAgICAgICAgICAgdGhpcy5yZXN0QXBpLm1ldHJpYygnNFhYRXJyb3InLCB7IHN0YXRpc3RpYzogJ1N1bScgfSksXG4gICAgICAgICAgICB0aGlzLnJlc3RBcGkubWV0cmljKCc1WFhFcnJvcicsIHsgc3RhdGlzdGljOiAnU3VtJyB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgIHRpdGxlOiAnRHluYW1vREIg4oCUIENvbnN1bWVkIFJlYWQvV3JpdGUgQ2FwYWNpdHknLFxuICAgICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICAgIHRoaXMudGFibGUubWV0cmljQ29uc3VtZWRSZWFkQ2FwYWNpdHlVbml0cyh7IHN0YXRpc3RpYzogJ1N1bScgfSksXG4gICAgICAgICAgICB0aGlzLnRhYmxlLm1ldHJpY0NvbnN1bWVkV3JpdGVDYXBhY2l0eVVuaXRzKHsgc3RhdGlzdGljOiAnU3VtJyB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KVxuICAgICAgKVxuICAgICk7XG5cbiAgICAvLyAtLS0gT3V0cHV0cyAtLS1cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEIOKAlCBhZGQgdG8gZnJvbnRlbmQgLmVudiBhcyBWSVRFX0NPR05JVE9fVVNFUl9QT09MX0lEJyxcbiAgICB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gQ2xpZW50IElEIOKAlCBhZGQgdG8gZnJvbnRlbmQgLmVudiBhcyBWSVRFX0NPR05JVE9fQ0xJRU5UX0lEJyxcbiAgICB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMudGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiB0YWJsZScsXG4gICAgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlYkJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy53ZWJCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgYnVja2V0IGZvciB0aGUgUmVhY3QgYXBwJyxcbiAgICB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2Vic2l0ZVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLndlYnNpdGVVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0hUVFBTIFVSTCDigJQgdXNlIHRoaXMgZm9yIGdlb2xvY2F0aW9uIHRvIHdvcmsgKGFmdGVyIHVwbG9hZGluZyBmcm9udGVuZCB0byBTMyknLFxuICAgIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIElEIOKAlCB1c2VkIGZvciBjYWNoZSBpbnZhbGlkYXRpb24nLFxuICAgIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZXN0QXBpVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMucmVzdEFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JFU1QgQVBJIFVSTCDigJQgYWRkIHRvIGZyb250ZW5kIC5lbnYgYXMgVklURV9BUElfVVJMJyxcbiAgICB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2ViU29ja2V0VXJsJywge1xuICAgICAgdmFsdWU6IGB3c3M6Ly8ke3RoaXMud2ViU29ja2V0QXBpLmFwaUlkfS5leGVjdXRlLWFwaS4ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tLyR7d3NTdGFnZS5zdGFnZU5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2ViU29ja2V0IFVSTCDigJQgYWRkIHRvIGZyb250ZW5kIC5lbnYgYXMgVklURV9XU19VUkwnLFxuICAgIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdPcHNEYXNoYm9hcmRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT1TcGlkZXlTb2NpYWxNdnAtT3BzYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRXYXRjaCBPcHMgRGFzaGJvYXJkIOKAlCBsYXRlbmN5LCBpbnZvY2F0aW9ucywgZXJyb3JzLCByZXNvdXJjZSB1c2FnZScsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==