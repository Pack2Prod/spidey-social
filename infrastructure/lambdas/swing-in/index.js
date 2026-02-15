const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;
const WS_ENDPOINT = process.env.WS_ENDPOINT;
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function parseBody(body) {
  try {
    return JSON.parse(body || '{}');
  } catch {
    return {};
  }
}

function haversineMi(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

exports.handler = async (event) => {
  const claims = event.requestContext?.authorizer?.claims || {};
  const userId = claims.sub || 'anonymous';
  const webId = event.pathParameters?.webId;

  if (!webId) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'webId required' }),
    };
  }

  const getResult = await dynamodb.get({
    TableName: TABLE_NAME,
    Key: { pk: `WEB#${webId}`, sk: 'META' },
  }).promise();

  if (!getResult.Item) {
    return {
      statusCode: 404,
      headers: CORS,
      body: JSON.stringify({ error: 'Web not found' }),
    };
  }

  const web = getResult.Item;
  const webOwnerId = web.userId || web.user_id;
  if (webOwnerId && webOwnerId === userId) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: "You can't swing to your own post" }),
    };
  }

  const swingInKey = { pk: `WEB#${webId}`, sk: `SWINGIN#${userId}` };
  const existing = await dynamodb.get({ TableName: TABLE_NAME, Key: swingInKey }).promise();

  if (existing.Item) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ message: 'Already swung in' }),
    };
  }

  const createdAt = Date.now();
  await dynamodb.put({
    TableName: TABLE_NAME,
    Item: {
      ...swingInKey,
      userId,
      webOwnerId: webOwnerId || web.userId || web.user_id,
      createdAt,
      ttlEpoch: web.ttlEpoch,
      gsi2pk: `USER#${userId}`,
      gsi2sk: createdAt,
    },
  }).promise();

  await dynamodb.update({
    TableName: TABLE_NAME,
    Key: { pk: `WEB#${webId}`, sk: 'META' },
    UpdateExpression: 'SET joinedCount = if_not_exists(joinedCount, :zero) + :one',
    ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
  }).promise();

  // Notify web owner via WebSocket (respecting stealth / notify radius)
  if (WS_ENDPOINT && webOwnerId && webOwnerId !== userId) {
    try {
      const prefsResult = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${webOwnerId}`, sk: 'PREFS' },
      }).promise();
      const prefs = prefsResult.Item || {};
      const stealthMode = prefs.stealthMode === true;
      const notifyRadiusMi = prefs.notifyRadiusMi;

      let shouldNotify = false;
      if (!stealthMode) {
        if (notifyRadiusMi == null) {
          shouldNotify = true;
        } else {
          const body = parseBody(event.body);
          const swingerLat = body.lat != null ? parseFloat(String(body.lat)) : null;
          const swingerLng = body.lng != null ? parseFloat(String(body.lng)) : null;
          const webLat = web.lat;
          const webLng = web.lng;
          if (
            swingerLat != null &&
            !Number.isNaN(swingerLat) &&
            swingerLng != null &&
            !Number.isNaN(swingerLng) &&
            webLat != null &&
            webLng != null
          ) {
            const dist = haversineMi(swingerLat, swingerLng, webLat, webLng);
            shouldNotify = dist <= notifyRadiusMi;
          }
        }
      }

      if (shouldNotify) {
        const conns = await dynamodb.query({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': `WS#USER#${webOwnerId}` },
        }).promise();

        const connCount = conns.Items?.length ?? 0;
        if (connCount === 0) {
          console.warn('[SwingIn] No WebSocket connections for owner', webOwnerId);
        }

        const wsApi = new AWS.ApiGatewayManagementApi({
          endpoint: WS_ENDPOINT.replace('wss://', 'https://'),
        });
        const payload = JSON.stringify({
          type: 'swing_in',
          webId,
          swingerId: userId,
          content: web.content?.slice(0, 80),
        });

        for (const row of conns.Items || []) {
          try {
            await wsApi
              .postToConnection({ ConnectionId: row.connectionId, Data: payload })
              .promise();
          } catch (e) {
            if (e.statusCode === 410) {
              await dynamodb.delete({
                TableName: TABLE_NAME,
                Key: { pk: `WS#USER#${webOwnerId}`, sk: row.sk },
              }).promise();
            }
          }
        }
      }
    } catch (e) {
      console.warn('[SwingIn] notify failed:', e.message);
    }
  }

  return {
    statusCode: 201,
    headers: CORS,
    body: JSON.stringify({ message: 'Swung in!' }),
  };
};
