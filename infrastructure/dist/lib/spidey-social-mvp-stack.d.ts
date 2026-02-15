import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
export declare class SpideySocialMvpStack extends cdk.Stack {
    readonly table: dynamodb.Table;
    readonly webBucket: s3.Bucket;
    readonly distribution: cloudfront.Distribution;
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly restApi: apigateway.RestApi;
    readonly webSocketApi: apigatewayv2.WebSocketApi;
    /** URL to open the site (S3 static website) */
    readonly websiteUrl: string;
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
