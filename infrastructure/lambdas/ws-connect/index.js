const AWS = require('aws-sdk');
const { CognitoJwtVerifier } = require('aws-jwt-verify');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

let verifier = null;
function getVerifier() {
  if (!verifier && USER_POOL_ID && CLIENT_ID) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: USER_POOL_ID,
      tokenUse: 'id',
      clientId: CLIENT_ID,
    });
  }
  return verifier;
}

exports.handler = async (event) => {
  const connectionId = event.requestContext?.connectionId;
  const queryParams = event.queryStringParameters || {};
  const token = queryParams.token;

  if (!connectionId) {
    return { statusCode: 400, body: 'Missing connectionId' };
  }

  let userId = 'anonymous';
  if (token) {
    const v = getVerifier();
    if (v) {
      try {
        const payload = await v.verify(token);
        userId = payload.sub || userId;
      } catch (e) {
        console.warn('[WsConnect] JWT verify failed:', e.message);
        return { statusCode: 401, body: 'Unauthorized' };
      }
    }
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
