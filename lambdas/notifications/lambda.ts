const aws = require('aws-sdk');

exports.welcomeUser = async (event: any = {}, context: any = {}): Promise<any> => {
    const ses = new aws.SES({ region: 'sa-east-1' });

    const SOURCE_EMAIL = 'luan.garcia@gmail.com';
    const SEND_TO_EMAIL = SOURCE_EMAIL;//force for test

    const recordPromises = event.Records.map(async (record: any) => {

        console.log('welcomeUser:record.dynamodb.NewImage', record.dynamodb.NewImage)

        const { name, email} = record.dynamodb.NewImage 

        const body = `
            Hello ${name.S} : ${email.S}
            Welcome to our App! 
        `;
        const sesParams = {
            Message: {
                Body: {
                    Text: {
                        Data: body,
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
                ToAddresses: [SEND_TO_EMAIL]
            }
        };
        await ses.sendEmail(sesParams).promise();
    });
    await Promise.all(recordPromises);
}