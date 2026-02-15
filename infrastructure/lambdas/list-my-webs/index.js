const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function safeResponse(statusCode, body) {
  return {
    statusCode,
    headers: CORS,
    body: typeof body === 'string' ? body : JSON.stringify(body || {}),
  };
}

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
    console.warn('[ListMyWebs] getUserId error:', e.message);
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

function formatWeb(item) {
  if (!item || !item.webId) return null;
  try {
    const ttlEpoch = item.ttlEpoch || 0;
    const ttlRemaining = Math.max(0, Math.floor((ttlEpoch * 1000 - Date.now()) / 60000));
    return {
      id: item.webId,
      userId: item.userId || '',
      userName: item.userName || '—',
      userHandle: item.userHandle || '—',
      userUniversity: item.userUniversity || '—',
      userAura: item.userAura || 0,
      content: item.content || '',
      category: item.category || 'General',
      distance: '—',
      timestamp: formatTimestamp(item.createdAt),
      ttl: ttlRemaining,
      joinedCount: item.joinedCount || 0,
      isExpiring: ttlRemaining < 10,
    };
  } catch (e) {
    console.warn('[ListMyWebs] formatWeb error:', e.message);
    return null;
  }
}

exports.handler = async (event) => {
  let result;
  try {
    const userId = getUserId(event);
    if (!userId) {
      return safeResponse(401, { error: 'Unauthorized' });
    }
    if (!TABLE_NAME) {
      return safeResponse(500, { error: 'Configuration error' });
    }

    const now = Math.floor(Date.now() / 1000);
    const items = [];
    let lastKey = null;

    do {
      const scanParams = {
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(pk, :prefix) AND userId = :uid AND ttlEpoch > :now',
        ExpressionAttributeValues: { ':prefix': 'WEB#', ':uid': userId, ':now': now },
        Limit: 100,
      };
      if (lastKey) scanParams.ExclusiveStartKey = lastKey;

      const scanResult = await dynamodb.scan(scanParams).promise();
      items.push(...(scanResult.Items || []));
      lastKey = scanResult.LastEvaluatedKey;
    } while (lastKey && items.length < 100);

    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const webs = items.map(formatWeb).filter(Boolean);

    result = safeResponse(200, { webs });
  } catch (err) {
    console.error('[ListMyWebs] Error:', err.code || err.name, err.message);
    result = safeResponse(500, { error: 'ServerError', message: String(err.message || 'Unknown error') });
  }
  return result;
};
