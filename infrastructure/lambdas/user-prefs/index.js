const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

const RADII_MI = [0.5, 1, 2, 5, 10];

function parseBody(body) {
  try {
    return JSON.parse(body || '{}');
  } catch {
    return {};
  }
}

function getUserId(event) {
  if (!event || typeof event !== 'object') return null;
  try {
    const auth = event.requestContext?.authorizer || {};
    const claims = auth.claims || auth;
    let userId = claims && claims.sub;
    if (userId) return String(userId);
    const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
    const token = (authHeader && authHeader.replace(/^Bearer\s+/i, '').trim()) || '';
    if (token && token.includes('.')) {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload && payload.sub) return String(payload.sub);
    }
  } catch (e) {
    console.warn('[UserPrefs] getUserId error:', e.message);
  }
  return null;
}

function reply(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(typeof body === 'string' ? { error: body } : body) };
}

exports.handler = async (event) => {
  try {
    if (!TABLE_NAME) {
      console.error('[UserPrefs] TABLE_NAME not set');
      return reply(500, { error: 'ServerError', message: 'Configuration error' });
    }
    if (!event || typeof event !== 'object') {
      return reply(500, { error: 'ServerError', message: 'Invalid request' });
    }

    const userId = getUserId(event);
    if (!userId) {
      return reply(401, { error: 'Unauthorized', message: 'Missing or invalid token' });
    }

    const pk = `USER#${userId}`;
    const sk = 'PREFS';

    if (event.httpMethod === 'GET') {
      const result = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: { pk, sk },
        ConsistentRead: true,
      }).promise();

      const item = result.Item || {};
      const stealth = item.stealthMode;
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          stealthMode: stealth === true || stealth === 'true',
          notifyRadiusMi: item.notifyRadiusMi ?? null,
        }),
      };
    }

    if (event.httpMethod === 'PUT') {
      const body = parseBody(event.body);
      const stealthMode = body.stealthMode === true || body.stealthMode === 'true';
      let notifyRadiusMi = body.notifyRadiusMi;
      if (notifyRadiusMi != null) {
        const r = parseFloat(String(notifyRadiusMi));
        notifyRadiusMi = RADII_MI.includes(r) ? r : null;
      } else {
        notifyRadiusMi = null;
      }

      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: {
          pk,
          sk,
          stealthMode,
          notifyRadiusMi,
          updatedAt: Date.now(),
        },
      }).promise();

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ stealthMode, notifyRadiusMi }),
      };
    }

    return reply(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[UserPrefs] Error:', err);
    return reply(500, { error: 'ServerError', message: err.message || 'Failed to save preferences' });
  }
};
