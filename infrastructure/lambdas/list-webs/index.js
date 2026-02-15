const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { encode: geohashEncode, neighbors: geohashNeighbors } = require('./geohash');

const TABLE_NAME = process.env.TABLE_NAME;
const PER_CELL_LIMIT = 25;
const MAX_WEBS = 50;

function parseQuery(query) {
  const lat = query?.lat != null ? parseFloat(query.lat) : null;
  const lng = query?.lng != null ? parseFloat(query.lng) : null;
  const radius = query?.radius != null ? parseFloat(query.radius) : null;
  return {
    lat: Number.isNaN(lat) ? null : lat,
    lng: Number.isNaN(lng) ? null : lng,
    radius: Number.isNaN(radius) || radius <= 0 ? null : radius,
  };
}

function haversineMi(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(item, userLat, userLng) {
  if (userLat == null || userLng == null || item.lat == null || item.lng == null) return { str: '—', mi: Infinity };
  const mi = haversineMi(userLat, userLng, item.lat, item.lng);
  let str = '—';
  if (mi < 0.01) str = 'here';
  else if (mi < 0.1) str = (mi * 5280).toFixed(0) + 'ft';
  else str = mi.toFixed(1) + 'mi';
  return { str, mi };
}

exports.handler = async (event) => {
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const q = event.queryStringParameters || {};
  const { lat, lng, radius } = parseQuery(q);

  let items;

  if (lat != null && lng != null) {
    // Geo-indexed path: query webs in user's cell + 8 neighbors
    const geohash5 = geohashEncode(lat, lng, 5);
    const cells = geohashNeighbors(geohash5);
    const byWebId = new Map();

    for (const cell of cells) {
      const result = await dynamodb.query({
        TableName: TABLE_NAME,
        IndexName: 'gsi_geo',
        KeyConditionExpression: 'gsi_geopk = :pk',
        ExpressionAttributeValues: { ':pk': 'GEO#' + cell },
        ScanIndexForward: false,
        Limit: PER_CELL_LIMIT,
      }).promise();

      for (const item of result.Items || []) {
        if (!item.webId || (item.ttlEpoch && item.ttlEpoch <= nowSec)) continue;
        if (!byWebId.has(item.webId)) byWebId.set(item.webId, item);
      }
    }

    items = Array.from(byWebId.values())
      .map((item) => ({ item, dist: formatDistance(item, lat, lng) }))
      .filter(({ item, dist }) => {
        if (item.lat == null || item.lng == null) return false;
        if (radius != null && dist.mi > radius) return false;
        const maxVisible = item.visibilityRadiusMi ?? 10;
        if (dist.mi > maxVisible) return false;
        return true;
      })
      .sort((a, b) => a.dist.mi - b.dist.mi)
      .slice(0, MAX_WEBS)
      .map(({ item }) => item);
  } else {
    // No location: fallback to global recent (GSI1)
    const result = await dynamodb.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': 'WEB' },
      ScanIndexForward: false,
      Limit: MAX_WEBS,
    }).promise();

    items = (result.Items || []).filter((item) => item.ttlEpoch && item.ttlEpoch > nowSec);
  }


  const webs = items.map((item) => formatWeb(item, lat, lng));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ webs }),
  };
};

function bearingRad(lat1, lng1, lat2, lng2) {
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon);
  return Math.atan2(y, x);
}

function formatWeb(item, userLat, userLng) {
  const ttlRemaining = Math.max(0, Math.floor((item.ttlEpoch * 1000 - Date.now()) / 60000));
  const dist = formatDistance(item, userLat, userLng);
  const out = {
    id: item.webId,
    userId: item.userId,
    userName: item.userName,
    userHandle: item.userHandle,
    userUniversity: item.userUniversity,
    userAura: item.userAura,
    content: item.content,
    category: item.category,
    distance: dist.str,
    timestamp: formatTimestamp(item.createdAt),
    ttl: ttlRemaining,
    joinedCount: item.joinedCount || 0,
    isExpiring: ttlRemaining < 10,
  };
  if (userLat != null && userLng != null && item.lat != null && item.lng != null) {
    const mi = dist.mi === Infinity ? 0 : dist.mi;
    const maxMi = 2;
    const r = Math.min(mi / maxMi, 1) * 0.4;
    const bear = bearingRad(userLat, userLng, item.lat, item.lng);
    out.radarX = 0.5 + r * Math.sin(bear);
    out.radarY = 0.5 - r * Math.cos(bear);
  }
  return out;
}

function formatTimestamp(ms) {
  const diff = Date.now() - ms;
  if (diff < 60000) return Math.floor(diff / 1000) + 's';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  return Math.floor(diff / 3600000) + 'h';
}
