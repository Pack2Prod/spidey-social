const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;
const WS_ENDPOINT = process.env.WS_ENDPOINT;
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function getUserId(event) {
  if (!event || typeof event !== 'object') return null;
  try {
    const auth = event.requestContext?.authorizer || {};
    const claims = auth.claims || auth;
    const userId = claims && claims.sub;
    if (userId) return String(userId);
    const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
    const token = (authHeader && authHeader.replace(/^Bearer\s+/i, '').trim()) || '';
    if (token && token.includes('.')) {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload && payload.sub) return String(payload.sub);
    }
  } catch (e) {
    console.warn('[SendMessage] getUserId error:', e.message);
  }
  return null;
}

function getUserName(event) {
  try {
    const auth = event.requestContext?.authorizer?.claims || {};
    const email = auth.email || '';
    return (auth.name || email.split('@')[0] || 'Hero').toUpperCase();
  } catch {
    return 'Hero';
  }
}

function parseBody(body) {
  try {
    return JSON.parse(body || '{}');
  } catch {
    return {};
  }
}

async function canAccessChat(userId, webId) {
  const [swingRes, webRes] = await Promise.all([
    dynamodb.get({
      TableName: TABLE_NAME,
      Key: { pk: `WEB#${webId}`, sk: `SWINGIN#${userId}` },
    }).promise(),
    dynamodb.get({
      TableName: TABLE_NAME,
      Key: { pk: `WEB#${webId}`, sk: 'META' },
    }).promise(),
  ]);
  if (swingRes.Item) return true;
  const web = webRes.Item;
  if (web && (web.userId === userId || web.user_id === userId)) return true;
  return false;
}

exports.handler = async (event) => {
  try {
    const userId = getUserId(event);
    if (!userId) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    const webId = event.pathParameters?.webId;
    if (!webId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'webId required' }) };
    }

    const body = parseBody(event.body);
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content || content.length > 500) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'content required (max 500 chars)' }) };
    }

    const allowed = await canAccessChat(userId, webId);
    if (!allowed) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Not in this chat' }) };
    }

    const webMeta = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { pk: `WEB#${webId}`, sk: 'META' },
    }).promise();
    const web = webMeta.Item;
    const ttlEpoch = web?.ttlEpoch || Math.floor(Date.now() / 1000) + 86400 * 7;

    const createdAt = Date.now();
    const userName = getUserName(event);
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        pk: `CHAT#${webId}`,
        sk: `MSG#${createdAt}`,
        userId,
        userName,
        content: content.slice(0, 500),
        createdAt,
        ttlEpoch,
      },
    }).promise();

    // Push new message to all chat participants via WebSocket
    const msg = {
      id: `MSG#${createdAt}`,
      userId,
      userName,
      content: content.slice(0, 500),
      createdAt,
    };
    if (WS_ENDPOINT && web) {
      try {
        const participantIds = new Set();
        participantIds.add(web.userId || web.user_id);
        const swingRes = await dynamodb.query({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
          ExpressionAttributeValues: { ':pk': `WEB#${webId}`, ':sk': 'SWINGIN#' },
        }).promise();
        for (const row of swingRes.Items || []) {
          if (row.userId) participantIds.add(row.userId);
        }
        participantIds.delete(userId); // sender gets optimistic update from client
        const wsApi = new AWS.ApiGatewayManagementApi({
          endpoint: WS_ENDPOINT.replace('wss://', 'https://').replace(/\/$/, ''),
        });
        const payload = JSON.stringify({ type: 'message_new', webId, message: msg });
        for (const pid of participantIds) {
          const conns = await dynamodb.query({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': `WS#USER#${pid}` },
          }).promise();
          for (const row of conns.Items || []) {
            try {
              await wsApi.postToConnection({ ConnectionId: row.connectionId, Data: payload }).promise();
            } catch (e) {
              if (e.statusCode === 410) {
                await dynamodb.delete({
                  TableName: TABLE_NAME,
                  Key: { pk: `WS#USER#${pid}`, sk: row.sk },
                }).promise();
              }
            }
          }
        }
      } catch (e) {
        console.warn('[SendMessage] WebSocket push failed:', e.message);
      }
    }

    return {
      statusCode: 201,
      headers: CORS,
      body: JSON.stringify({
        id: `MSG#${createdAt}`,
        userId,
        userName,
        content: content.slice(0, 500),
        createdAt,
      }),
    };
  } catch (err) {
    console.error('[SendMessage] Error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'ServerError', message: String(err.message || 'Unknown error') }),
    };
  }
};
