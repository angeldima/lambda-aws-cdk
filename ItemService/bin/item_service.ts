#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ItemServiceStack } from '../lib/item_service-stack';

const app = new cdk.App();
new ItemServiceStack(app, 'ItemServiceStack');
