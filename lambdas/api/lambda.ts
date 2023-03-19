const aws = require('aws-sdk');
// const { nanoid } = require('nanoid');

exports.createUserFunction = async (event: any = {}, context: any = {},): Promise<any> => {
  
    const ses = new aws.SES({ region: 'sa-east-1' });
    const documentClient = new aws.DynamoDB.DocumentClient({ region: 'us-east-1' });
    const sqs = new aws.SQS({ region: 'us-east-1' });
    
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    console.log(`createUserFunction:event`, event);
    console.log(`createUserFunction:context`, context);
    console.log(`createUserFunction:process.env`, process.env);

    const TABLE_NAME = process.env.USER_TABLE_NAME || 'UsersTable';

    if (!event.body) {
        return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
      }
      
      const { body } = event;
      const { name, email, phone, birthday } = JSON.parse(body);
      const userId = context.awsRequestId; 
      
      const user = {
        userId,
        name,
        email,
        phone,
        birthday
      }
    
      const putParams = {
        TableName: TABLE_NAME,
        Item:  user
      };
    
      try {
          await documentClient.put(putParams).promise();
          return {
              statusCode: 200,
              body: JSON.stringify({
                  message: 'Data saved successfully.',
                  user:user
              })
          };
      } catch (error) {
          return {
              statusCode: 500,
              body: JSON.stringify({
                  message: 'Error saving data. '+error,
                  putParams:putParams
              })
          };
      }

}
