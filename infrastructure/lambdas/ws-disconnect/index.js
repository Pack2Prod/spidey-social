const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  const connectionId = event.requestContext?.connectionId;

  if (connectionId) {
    const conn = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { pk: 'WS#CONNECTION', sk: connectionId },
    }).promise();

    const userId = conn.Item?.userId;
    const requests = [
      { DeleteRequest: { Key: { pk: 'WS#CONNECTION', sk: connectionId } } },
    ];
    if (userId) {
      requests.push({
        DeleteRequest: { Key: { pk: `WS#USER#${userId}`, sk: connectionId } },
      });
    }
    await dynamodb.batchWrite({
      RequestItems: { [TABLE_NAME]: requests },
    }).promise();
  }

  return { statusCode: 200, body: 'Disconnected' };
};
