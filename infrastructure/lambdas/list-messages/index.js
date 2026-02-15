const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;
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
    console.warn('[ListMessages] getUserId error:', e.message);
  }
  return null;
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

    const allowed = await canAccessChat(userId, webId);
    if (!allowed) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Not in this chat' }) };
    }

    const q = event.queryStringParameters || {};
    const limit = Math.min(parseInt(q.limit, 10) || 50, 100);

    const result = await dynamodb.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': `CHAT#${webId}`, ':prefix': 'MSG#' },
      ScanIndexForward: false,
      Limit: limit,
    }).promise();
    const messages = (result.Items || []).map((m) => ({
      id: m.sk,
      userId: m.userId,
      userName: m.userName || '—',
      content: m.content || '',
      createdAt: m.createdAt,
    }));

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ messages: messages.reverse() }),
    };
  } catch (err) {
    console.error('[ListMessages] Error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'ServerError', message: String(err.message || 'Unknown error') }),
    };
  }
};
