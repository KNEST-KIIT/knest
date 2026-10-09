// CloudFront Function, viewer-request, runtime cloudfront-js-2.0.
//
// 1. Redirects the alternate hostnames to the canonical https://kiitnest.com,
//    permanently, keeping the path and the query string. Any other hostname (for
//    example the distribution's own *.cloudfront.net name used during private
//    verification) passes through untouched.
// 2. Optional access gate for the private-first phase (HTTP Basic): when
//    ACCESS_HASH is not empty, a request must carry credentials whose SHA-256 hex
//    digest of "user:password" equals it, otherwise 401. The credentials
//    themselves are never in this file or in a template, only their digest. The
//    gate also removes the Authorization header so the origin never sees it.
//
// ACCESS_HASH is replaced by CloudFormation (edge.yaml); an empty value means the
// site is public. A test (infra/edge/viewer-request.test.ts) keeps this file and
// the template's inline copy identical.

var crypto = require('crypto');
var Buffer = require('buffer').Buffer;

var CANONICAL_HOST = 'kiitnest.com';
var REDIRECT_HOSTS = ['www.kiitnest.com', 'kiitnest.in', 'www.kiitnest.in'];
var ACCESS_HASH = '__ACCESS_HASH__';

function queryString(querystring) {
  var parts = [];
  for (var key in querystring) {
    var entry = querystring[key];
    if (entry.multiValue) {
      for (var i = 0; i < entry.multiValue.length; i++) {
        parts.push(entry.multiValue[i].value === '' ? key : key + '=' + entry.multiValue[i].value);
      }
    } else {
      parts.push(entry.value === '' ? key : key + '=' + entry.value);
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

function unauthorized() {
  return {
    statusCode: 401,
    statusDescription: 'Unauthorized',
    headers: {
      'www-authenticate': { value: 'Basic realm="KNEST (restricted)", charset="UTF-8"' },
      'cache-control': { value: 'no-store' },
    },
  };
}

function handler(event) {
  var request = event.request;
  var hostHeader = request.headers.host ? request.headers.host.value : '';
  var host = hostHeader.toLowerCase().split(':')[0];

  if (REDIRECT_HOSTS.indexOf(host) !== -1) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: 'https://' + CANONICAL_HOST + request.uri + queryString(request.querystring) },
        'cache-control': { value: 'public, max-age=3600' },
      },
    };
  }

  if (ACCESS_HASH !== '') {
    var authorization = request.headers.authorization ? request.headers.authorization.value : '';
    if (authorization.slice(0, 6) !== 'Basic ') return unauthorized();
    var decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    var digest = crypto.createHash('sha256').update(decoded).digest('hex');
    if (digest !== ACCESS_HASH) return unauthorized();
    delete request.headers.authorization;
  }

  return request;
}
