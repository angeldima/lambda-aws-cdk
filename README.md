# Creating a Serverless Application Using the AWS CDK

https://docs.aws.amazon.com/cdk/latest/guide/serverless_example.html#serverless_example_deploy_and_test

npm install -g aws-cdk
cdk --version

## Create a AWS CDK App

Create the app **ItemService** in the current folder.

```shell
	mkdir ItemService
	cd ItemService
	cdk init --language typescript
```

The important files in the blank project are as follows:

- bin/item_service.ts – Main entry point for the application
- lib/item_service-stack.ts – Defines the item service stack

Build the app and note that it synthesizes an empty stack.

```shell
	npm run build
	cdk synth
```

You should see output like the following, where CDK-VERSION is the version of the AWS CDK.

```shell
	Resources:
	  CDKMetadata:
		Type: AWS::CDK::Metadata
		Properties:
		  Modules: "@aws-cdk/cdk=CDK-VERSION,@aws-cdk/cx-api=CDK-VERSION,item_service=0.1.0"
```

## Create Lambda Functions
The next step is to create four Lambda functions to:

- List all items with GET
- Create a item with POST /{name}
- Get a item by name with GET /{name}
- Delete a item by name with DELETE /{name}

Create the resources directory in the project's main directory.

```shell
	mkdir resources
```

Create the following JavaScript file, items.js, in the resources directory.

```javascript
const AWS = require('aws-sdk');
const S3 = new AWS.S3();

const bucketName = process.env.BUCKET;

exports.main = async function(event, context) {
  try {
    var method = event.httpMethod;
    // Get name, if present
    var itemName = event.path.startsWith('/')
      ? event.path.substring(1)
      : event.path;

    if (method === 'GET') {
      // GET / to get the names of all items
      if (event.path === '/') {
        const data = await S3.listObjectsV2({ Bucket: bucketName }).promise();
        var body = {
          items: data.Contents.map(function(e) {
            return e.Key;
          })
        };
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(body)
        };
      }

      if (itemName) {
        // GET /name to get info on item name
        const data = await S3.getObject({
          Bucket: bucketName,
          Key: itemName
        }).promise();
        var body = data.Body.toString('utf-8');

        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(body)
        };
      }
    }

    if (method === 'POST') {
      // POST /name
      // Return error if we do not have a name
      if (!itemName) {
        return {
          statusCode: 400,
          headers: {},
          body: 'Item name missing'
        };
      }

      // Create some dummy data to populate object
      const now = new Date();
      var data = itemName + ' created: ' + now;

      var base64data = new Buffer(data, 'binary');

      await S3.putObject({
        Bucket: bucketName,
        Key: itemName,
        Body: base64data,
        ContentType: 'application/json'
      }).promise();

      return {
        statusCode: 200,
        headers: {},
        body: JSON.stringify(event.items)
      };
    }

    if (method === 'DELETE') {
      // DELETE /name
      // Return an error if we do not have a name
      if (!itemName) {
        return {
          statusCode: 400,
          headers: {},
          body: 'Item name missing'
        };
      }

      await S3.deleteObject({
        Bucket: bucketName,
        Key: itemName
      }).promise();

      return {
        statusCode: 200,
        headers: {},
        body: 'Successfully deleted item ' + itemName
      };
    }

    // We got something besides a GET, POST, or DELETE
    return {
      statusCode: 400,
      headers: {},
      body: 'We only accept GET, POST, and DELETE, not ' + method
    };
  } catch (error) {
    var body = error.stack || JSON.stringify(error, null, 2);
    return {
      statusCode: 400,
      headers: {},
      body: body
    };
  }
};
```

We haven't yet wired the Lambda functions to the AWS CDK app.

## Creating a Item Service

Add the API Gateway, Lambda, and Amazon S3 packages to the app.

```shell
	npm install @aws-cdk/aws-apigateway @aws-cdk/aws-lambda @aws-cdk/aws-s3
```

Create a new source file (_File: lib/item_service.ts_) to define the item service with the source code shown below.

```javascript
import * as core from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';

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

    // Get All items from bucket
    const getItemsIntegration = new apigateway.LambdaIntegration(handler, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' }
    });

    api.root.addMethod('GET', getItemsIntegration);

    const item = api.root.addResource('{id}');

    // Add new item to bucket with: POST /{id}
    const postItemIntegration = new apigateway.LambdaIntegration(handler);

    // Get a specific item from bucket with: GET /{id}
    const getItemIntegration = new apigateway.LambdaIntegration(handler);

    // Remove a specific item from the bucket with: DELETE /{id}
    const deleteItemIntegration = new apigateway.LambdaIntegration(handler);

    item.addMethod('POST', postItemIntegration);
    item.addMethod('GET', getItemIntegration);
    item.addMethod('DELETE', deleteItemIntegration);
  }
}
```

## Add the Service to the App

To add the item service to our AWS CDK app, we'll need to modify the source file that defines the stack to instantiate the service construct.
In the file _lib/item_service-stack.ts_ add the following line of code after the existing import statement

```javascript
import * as item_service from '../lib/item_service';
```

and replace the comment in the constructor with the following line of code.

```javascript
new item_service.ItemService(this, 'Items');
```

Be sure the app builds and synthesizes a stack

```javascript
	npm run build
	cdk synth
```

## Add Cognito Authorizer and protect the API

In your cdk app home directory create the file _app-settings.ts_ and add the following lines of code

```javascript
export class AppSettings {
  public static COGNITO_POOL_ARN =
    '*****YOUR_COGNITO_USER POOL_ARN_STRING*****';
}
```

Now, we will implort the settings file in our _item_service.ts_ file:

```javascript
import * as settings from '../app-settings';
```

in the same class, create an APIGateway authorizer in the constructor method

```javascript
const auth = new apigateway.CfnAuthorizer(this, 'APIGatewayAuthorizer', {
  name: 'customer-authorizer',
  identitySource: 'method.request.header.Authorization',
  providerArns: [settings.AppSettings.COGNITO_POOL_ARN],
  restApiId: api.restApiId,
  type: apigateway.AuthorizationType.COGNITO
});
```

in the end modify the APIGateway _addMethod_, added previously, in the following way:

```javascript
api.root.addMethod('GET', getItemsIntegration, {
	authorizationType: apigateway.AuthorizationType.COGNITO,
	authorizer: { authorizerId: auth.ref }
});
...
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
```

Be sure the app builds and synthesizes a stack

```shell
	npm run build
	cdk synth
```

## Deploy and Test the App

Before you can deploy your first AWS CDK app containing a lambda function, you must bootstrap your AWS environment. This creates a staging bucket that the AWS CDK uses to deploy stacks containing assets.

```shell
	cdk bootstrap
	cdk deploy
```

If the deployment succeeds, save the URL for your server. This URL appears in one of the last lines in the window, where **GUID** is an alphanumeric GUID and **REGION** is your AWS Region. All the API:

- GET https://GUID.execute-api-REGION.amazonaws.com/prod
- POST https://GUID.execute-api-REGION.amazonaws.com/prod/item1
- GET https://GUID.execute-api-REGION.amazonaws.com/prod/item1
- DELETE https://GUID.execute-api-REGION.amazonaws.com/prod/item1

Remember to test your app by using a valid Token granted by you AWS Cognito User Pool

## Clean Up

To avoid unexpected AWS charges, destroy your AWS CDK stack after you're done with this exercise.

```shell
	cdk destroy
```
