import * as cdk from '@aws-cdk/core';
import * as item_service from '../lib/item_service';

export class ItemServiceStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new item_service.ItemService(this, 'Items');
  }
}
