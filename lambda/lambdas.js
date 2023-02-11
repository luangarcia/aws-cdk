const aws = require('aws-sdk');
const { nanoid } = require('nanoid');

const ses = new aws.SES({ region: 'sa-east-1' });
const documentClient = new aws.DynamoDB.DocumentClient({ region: 'us-east-1' });
const sqs = new aws.SQS({ region: 'us-east-1' });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

exports.processBirthday = async (event) => {

    console.log('processBirthday', event);
    //get birthdays and send email
    const today = new Date();
    const birthday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    console.log('processBirthday:birthday', birthday);
    
    const ORDER_TABLE_NAME = process.env.ORDER_TABLE_NAME;

    const params = {
      TableName: ORDER_TABLE_NAME,
      FilterExpression: 'birthday = :birthday',
      ExpressionAttributeValues: {
        ':birthday': birthday.toISOString()
      }
    };
    
    documentClient.scan(params, (err, data) => {
      if (err) {
        console.error('processBirthday:errors',err);
      } else {
        console.log('processBirthdayQyery: ', data.Items);
      }
    });

}
exports.createOrder = async (event) => {
    // obtain env variables
    const ORDER_TABLE_NAME = process.env.ORDER_TABLE_NAME;
    const ORDER_PROCESSING_QUEUE_URL = process.env.ORDER_PROCESSING_QUEUE_URL;
    const { body } = event;
    const { orderName, items, user } = JSON.parse(body);
    const orderId = nanoid();

    const order = {
        orderId,
        orderName,
        orderItems: items,
        user: user
    };


    const putParams = {
        TableName: ORDER_TABLE_NAME,
        Item: order
    };
    // persist order in dynamoDb
    await documentClient.put(putParams).promise();

    console.log(`Order ${orderId} created`);

    // add the persisted order in the queue which will notify the administrator
    const { MessageId } = await sqs.sendMessage({
        QueueUrl: ORDER_PROCESSING_QUEUE_URL,
        MessageBody: JSON.stringify({ order, admin: ADMIN_EMAIL })
    }).promise()

    console.log(`Message ${MessageId} sent to queue`);

    return {
        statusCode: 200,
        body: JSON.stringify({
            order,
            messageId: MessageId,
        })
    }
};

exports.processOrder = async (event) => {
    const SOURCE_EMAIL = 'luan.garcia@gmail.com';
    const recordPromises = event.Records.map(async (record) => {
        const { body } = record;
        const { order, admin } = JSON.parse(body);
        const { orderName, orderItems } = order;

        const joinedItems = orderItems.join(', ');

        const orderMessage = `
            New order received: ${orderName}
            Items: ${joinedItems}
        `;
        const sesParams = {
            Message: {
                Body: {
                    Text: {
                        Data: orderMessage,
                        Charset: 'UTF-8'
                    }
                },
                Subject: {
                    Data: 'New order received',
                    Charset: 'UTF-8'
                }
            },
            Source: SOURCE_EMAIL,
            Destination: {
                ToAddresses: [admin]
            }
        };
        await ses.sendEmail(sesParams).promise();
    });
    await Promise.all(recordPromises);
}