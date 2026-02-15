const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;
const WS_ENDPOINT = process.env.WS_ENDPOINT;

function parseBody(body) {
  try {
    return JSON.parse(body || '{}');
  } catch {
    return {};
  }
}

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

exports.handler = async (event) => {
  try {
    return await handleCreateWeb(event);
  } catch (err) {
    console.error('[CreateWeb] error:', err.message, err.stack);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};

async function handleCreateWeb(event) {
  const claims = event.requestContext?.authorizer?.claims || {};
  const userId = claims.sub || 'anonymous';
  const email = claims.email || 'unknown';
  const handle = '@' + (email.split('@')[0] || 'hero');
  const userName = (claims.name || email.split('@')[0] || 'Anonymous').toUpperCase();

  const body = parseBody(event.body);
  const { content, category = 'General', ttl = 60, lat, lng, visibilityRadius } = body;

  if (!content || content.trim().length === 0) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'content required' }),
    };
  }

  const webId = 'web-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  const ttlMinutes = Math.min(Math.max(parseInt(String(ttl), 10) || 60, 30), 120);
  const ttlEpoch = Math.floor(now / 1000) + ttlMinutes * 60;

  const item = {
    pk: `WEB#${webId}`,
    sk: 'META',
    webId,
    content: String(content).slice(0, 280),
    category: String(category).slice(0, 50),
    userId,
    userName,
    userHandle: handle,
    userUniversity: '—',
    userAura: 100,
    ttlMinutes,
    ttlEpoch,
    createdAt: now,
    joinedCount: 0,
    gsi1pk: 'WEB',
    gsi1sk: now,
    gsi2pk: `USER#${userId}`,
    gsi2sk: now,
  };
  const parsedLat = lat != null ? parseFloat(String(lat)) : null;
  const parsedLng = lng != null ? parseFloat(String(lng)) : null;
  const VALID_RADII = [0.5, 1, 2, 5, 10];
  const parsedRadius = visibilityRadius != null ? parseFloat(String(visibilityRadius)) : 2;
  const visibilityMi = VALID_RADII.includes(parsedRadius) ? parsedRadius : 2;
  if (typeof parsedLat === 'number' && !Number.isNaN(parsedLat) && typeof parsedLng === 'number' && !Number.isNaN(parsedLng)) {
    item.lat = parsedLat;
    item.lng = parsedLng;
    item.visibilityRadiusMi = visibilityMi;
  }

  await dynamodb.put({ TableName: TABLE_NAME, Item: item }).promise();

  // Fan out to WebSocket connections
  if (WS_ENDPOINT) {
    try {
      const conns = await dynamodb.query({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'WS#CONNECTION' },
      }).promise();

      const wsApi = new AWS.ApiGatewayManagementApi({ endpoint: WS_ENDPOINT.replace('wss://', 'https://') });
      const payload = JSON.stringify({ type: 'web_added', web: formatWeb(item, null, null) });

      for (const row of conns.Items || []) {
        try {
          await wsApi.postToConnection({ ConnectionId: row.sk, Data: payload }).promise();
        } catch (e) {
          if (e.statusCode === 410) {
            await dynamodb.delete({
              TableName: TABLE_NAME,
              Key: { pk: 'WS#CONNECTION', sk: row.sk },
            }).promise();
          }
        }
      }
    } catch (e) {
      console.warn('WebSocket fan-out failed:', e.message);
    }
  }

  return {
    statusCode: 201,
    headers: CORS,
    body: JSON.stringify({ webId, ...formatWeb(item, item.lat, item.lng) }),
  };
}

function formatDistance(item, userLat, userLng) {
  if (userLat == null || userLng == null || item.lat == null || item.lng == null) return '—';
  const mi = haversineMi(userLat, userLng, item.lat, item.lng);
  if (mi < 0.01) return 'here';
  if (mi < 0.1) return (mi * 5280).toFixed(0) + 'ft';
  return mi.toFixed(1) + 'mi';
}

function haversineMi(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatWeb(item, userLat, userLng) {
  const ttlRemaining = Math.max(0, Math.floor((item.ttlEpoch * 1000 - Date.now()) / 60000));
  return {
    id: item.webId,
    userId: item.userId,
    userName: item.userName,
    userHandle: item.userHandle,
    userUniversity: item.userUniversity,
    userAura: item.userAura,
    content: item.content,
    category: item.category,
    distance: formatDistance(item, userLat, userLng),
    timestamp: formatTimestamp(item.createdAt),
    ttl: ttlRemaining,
    joinedCount: item.joinedCount || 0,
    isExpiring: ttlRemaining < 10,
  };
}

function formatTimestamp(ms) {
  const diff = Date.now() - ms;
  if (diff < 60000) return Math.floor(diff / 1000) + 's';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  return Math.floor(diff / 3600000) + 'h';
}
