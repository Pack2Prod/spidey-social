const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  const connectionId = event.requestContext?.connectionId;
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || 'anonymous';

  if (!connectionId) {
    return { statusCode: 400, body: 'Missing connectionId' };
  }

  const now = Date.now();
  await dynamodb.batchWrite({
    RequestItems: {
      [TABLE_NAME]: [
        {
          PutRequest: {
            Item: {
              pk: 'WS#CONNECTION',
              sk: connectionId,
              connectionId,
              userId,
              createdAt: now,
            },
          },
        },
        {
          PutRequest: {
            Item: {
              pk: `WS#USER#${userId}`,
              sk: connectionId,
              connectionId,
              userId,
              createdAt: now,
            },
          },
        },
      ],
    },
  }).promise();

  return { statusCode: 200, body: 'Connected' };
};
