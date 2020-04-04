import * as core from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import * as settings from '../app-settings';

export class ItemService extends core.Construct {
  constructor(scope: core.Construct, id: string) {
    super(scope, id);

    const bucket = new s3.Bucket(this, 'ItemStore');

    const handler = new lambda.Function(this, 'ItemHandler', {
      runtime: lambda.Runtime.NODEJS_10_X, // So we can use async in item.js
      code: lambda.Code.asset('resources'),
      handler: 'items.main',
      environment: {
        BUCKET: bucket.bucketName
      }
    });

    bucket.grantReadWrite(handler); // was: handler.role);

    const api = new apigateway.RestApi(this, 'items-api', {
      restApiName: 'Item Service',
      description: 'This service serves items.'
    });

    const auth = new apigateway.CfnAuthorizer(this, 'APIGatewayAuthorizer', {
      name: 'customer-authorizer',
      identitySource: 'method.request.header.Authorization',
      providerArns: [settings.AppSettings.COGNITO_POOL_ARN],
      restApiId: api.restApiId,
      type: apigateway.AuthorizationType.COGNITO
    });

    // Get All item from S3 bucket
    const getItemsIntegration = new apigateway.LambdaIntegration(handler, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' }
    });

    api.root.addMethod('GET', getItemsIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: { authorizerId: auth.ref }
    });

    const item = api.root.addResource('{id}');

    // Add new item to bucket with: POST /{id}
    const postItemIntegration = new apigateway.LambdaIntegration(handler);

    // Get a specific item from bucket with: GET /{id}
    const getItemIntegration = new apigateway.LambdaIntegration(handler);

    // Remove a specific item from the bucket with: DELETE /{id}
    const deleteItemIntegration = new apigateway.LambdaIntegration(handler);

    item.addMethod('POST', postItemIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: { authorizerId: auth.ref }
    });
    item.addMethod('GET', getItemIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: { authorizerId: auth.ref }
    });
    item.addMethod('DELETE', deleteItemIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: { authorizerId: auth.ref }
    });
  }
}
