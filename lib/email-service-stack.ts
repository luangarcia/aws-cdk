import { Stack, StackProps, Duration, aws_events, aws_events_targets, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';



export class EmailServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    // provision the DynamoDB order table
    const DynamoUserTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: false,
      stream: dynamodb.StreamViewType.NEW_IMAGE, // Habilita o stream na tabela
      removalPolicy: RemovalPolicy.DESTROY //process.env.environment === 'staging' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN

    });
    // create the lambda responsible for welcomeUserFunction orders
    const welcomeUserFunction = new lambda.Function(this, 'welcomeUserFunction', {
      code: lambda.Code.fromAsset('lambdas/notifications'),
      handler: 'lambda.welcomeUser',
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        USER_TABLE_NAME: DynamoUserTable.tableName,
        CDK_DEFAULT_REGION: process.env.CDK_DEFAULT_ACCOUNT!
      }
    });
    // create the lambda responsible for processing orders
    const createUserFunction = new lambda.Function(this, 'createUserFunction', {
      code: lambda.Code.fromAsset('lambdas/notifications'),
      handler: 'lambda.createUserFunction',
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        USER_TABLE_NAME: DynamoUserTable.tableName,
        CDK_DEFAULT_REGION: process.env.CDK_DEFAULT_ACCOUNT!
      }
    });


    // grant the order process lambda permission to invoke SES
    welcomeUserFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendRawEmail', 'ses:SendTemplatedEmail', 'ses:SendEmail'],
      resources: ['*'],
      sid: 'SendEmailPolicySid',
    }));

    welcomeUserFunction.addEventSource(new DynamoEventSource(DynamoUserTable, {
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 1
    }));

    DynamoUserTable.grantReadWriteData(createUserFunction); // allow the createOrder lambda function to write to the order table
    DynamoUserTable.grantReadWriteData(welcomeUserFunction); // allow the createOrder lambda function to write to the order table
    // creates an API Gateway REST API
    const restApi = new apigateway.RestApi(this, 'EmailServiceApi', {
      restApiName: 'EmailService',
    });

    // create an api gateway resource '/user/create'
    const createUser = restApi.root.addResource('user').addResource('create');
    // creating a POST method for the new order resource that integrates with the createOrder Lambda function
    createUser.addMethod('POST', new apigateway.LambdaIntegration(createUserFunction), {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

   
  }
}
