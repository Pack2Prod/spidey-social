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
    console.warn('[ListMySwings] getUserId error:', e.message);
  }
  return null;
}

function formatTimestamp(ms) {
  if (ms == null || typeof ms !== 'number') return '—';
  const diff = Date.now() - ms;
  if (diff < 60000) return Math.floor(diff / 1000) + 's';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  return Math.floor(diff / 3600000) + 'h';
}

exports.handler = async (event) => {
  try {
    const userId = getUserId(event);
    if (!userId) {
      return {
        statusCode: 401,
        headers: CORS,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }
    if (!TABLE_NAME) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: 'Configuration error' }),
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const swingsResult = await dynamodb.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi2',
      KeyConditionExpression: 'gsi2pk = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${userId}` },
      ScanIndexForward: false,
      Limit: 50,
    }).promise();

    const swings = swingsResult.Items || [];
    const swingsWithWeb = [];

    for (const swing of swings) {
      if (!swing.pk || !swing.pk.startsWith('WEB#')) continue;
      const webId = swing.pk.replace('WEB#', '');
      const webMeta = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: { pk: `WEB#${webId}`, sk: 'META' },
      }).promise();

      const web = webMeta.Item;
      if (!web || !web.ttlEpoch || web.ttlEpoch <= now) continue;

      const ttlRemaining = Math.max(0, Math.floor((web.ttlEpoch - now) / 60));
      swingsWithWeb.push({
        webId,
        webOwnerId: web.userId || web.user_id,
        userName: web.userName || '—',
        userHandle: web.userHandle || '—',
        content: (web.content || '').slice(0, 80),
        category: web.category || 'General',
        timestamp: formatTimestamp(swing.createdAt),
        ttl: ttlRemaining,
      });
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ swings: swingsWithWeb }),
    };
  } catch (err) {
    console.error('[ListMySwings] Error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'ServerError', message: String(err.message || 'Unknown error') }),
    };
  }
};
