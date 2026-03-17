'use node';

import crypto from 'crypto';

// Generate RSA key pair
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

// Convert public key to JWK format
const publicKeyBuffer = crypto.createPublicKey(publicKey);
const jwk = {
  kty: 'RSA',
  use: 'sig',
  alg: 'RS256',
  n: publicKeyBuffer.export({ format: 'jwk' }).n,
  e: publicKeyBuffer.export({ format: 'jwk' }).e,
  kid: crypto.randomBytes(16).toString('hex'),
};

const jwks = JSON.stringify({ keys: [jwk] });

// Output the keys
process.stdout.write(
  `JWT_PRIVATE_KEY="${privateKey.trimEnd().replace(/\n/g, ' ')}"`,
);
process.stdout.write('\n');
process.stdout.write(`JWKS=${jwks}`);
process.stdout.write('\n');
