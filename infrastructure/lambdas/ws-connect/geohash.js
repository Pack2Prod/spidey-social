/**
 * Minimal geohash (base32) for location partitioning. Precision 5 ≈ 4.9km cells.
 * Used by create-web, list-webs, ws-connect for geo-indexed queries and fan-out.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

// Neighbor direction lookups (even bits = lng, odd = lat). From standard geohash neighbor tables.
const NEIGHBOR = {
  n: { even: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy', odd: 'bcdefghjkmnpqrstuvwxyz0123456789' },
  s: { even: '14365h7k9dcfesgujnmqp0r2twvyx8z', odd: '238967debcpqrstuvwxyz0145ghjkmn' },
  e: { even: 'bcdefghjkmnpqrstuvwxyz0123456789', odd: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy' },
  w: { even: '238967debcpqrstuvwxyz0145ghjkmn', odd: '14365h7k9dcfesgujnmqp0r2twvyx8z' },
};

const BORDER = {
  n: { even: 'prxz', odd: 'bcfguvyz' },
  s: { even: '028b', odd: '0145hjnp' },
  e: { even: 'bcfguvyz', odd: 'prxz' },
  w: { even: '0145hjnp', odd: '028b' },
};

function encode(lat, lng, precision) {
  precision = precision || 5;
  let idx = 0;
  let bit = 0;
  let even = 1;
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = '';

  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng > mid) {
        idx |= (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat > mid) {
        idx |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }
    even = 1 - even;
    bit++;
    if (bit === 5) {
      hash += BASE32[idx];
      idx = 0;
      bit = 0;
    }
  }
  return hash;
}

function adjacent(hash, direction) {
  const last = hash.slice(-1);
  const parent = hash.slice(0, -1);
  const isEven = hash.length % 2 === 0;
  const table = NEIGHBOR[direction];
  const border = BORDER[direction];
  const type = isEven ? 'even' : 'odd';
  if (border[type].indexOf(last) !== -1 && parent) {
    return adjacent(parent, direction) + BASE32[table[type].indexOf(last)];
  }
  return parent + BASE32[table[type].indexOf(last)];
}

/**
 * @param {string} geohash
 * @returns {string[]} center + 8 neighbors (9 cells for 3x3 grid)
 */
function neighbors(geohash) {
  if (!geohash || geohash.length === 0) return [];
  const n = adjacent(geohash, 'n');
  const s = adjacent(geohash, 's');
  return [
    adjacent(s, 'w'), s, adjacent(s, 'e'),
    adjacent(geohash, 'w'), geohash, adjacent(geohash, 'e'),
    adjacent(n, 'w'), n, adjacent(n, 'e'),
  ];
}

module.exports = { encode, neighbors };
