import * as jwt from 'jsonwebtoken';
import { AppConfig } from '../config/config';


const secret = AppConfig.authSecret;
const iss = AppConfig.validIssuers[0];
const exp = 1980992788


const m2mPayload = {
  iss,
  sub: 'enjw1810eDz3XTwSO2Rn2Y9cQTrspn3B@clients',
  aud: 'https://m2m.topcoder-dev.com/',
  iat: 1550906388,
  exp,
  azp: 'enjw1810eDz3XTwSO2Rn2Y9cQTrspn3B',
  scope: 'all:connect_project,all:projects,all:project-members,all:project-invites,all:customer-payments',
  gty: 'client-credentials'
}

console.log('------------ Full M2M Token ------------')
console.log(jwt.sign(m2mPayload, secret))


const adminPayload = {
  roles: [
    'Topcoder User',
    'Connect Support',
    'administrator',
    'testRole',
    'aaa',
    'tony_test_1',
    'Connect Manager',
    'Connect Admin',
    'copilot',
    'Connect Copilot Manager'
  ],
  iss,
  handle: 'TonyJ',
  exp,
  userId: '8547899',
  iat: 1549791611,
  email: 'tjefts+fix@topcoder.com',
  jti: 'f94d1e26-3d0e-46ca-8115-8754544a08f1'
}

console.log('------------ Admin Token ------------')
console.log(jwt.sign(adminPayload, secret))


const userPayload = {
  roles: [
    'Topcoder User'
  ],
  iss,
  handle: 'phead',
  exp,
  userId: '22742764',
  iat: 1549799569,
  email: 'email@domain.com.z',
  jti: '9c4511c5-c165-4a1b-899e-b65ad0e02b55'
}

console.log('------------ User Token ------------')
console.log(jwt.sign(userPayload, secret))


const expiredToken = {
  roles: [
    'Topcoder User'
  ],
  iss,
  handle: 'phead',
  // one minute before now
  exp: Date.now() / 1000 - 60,
  userId: '22742764',
  iat: 1549799569,
  email: 'email@domain.com.z',
  jti: '9c4511c5-c165-4a1b-899e-b65ad0e02b55'
}

console.log('------------ Expired Token ------------')
console.log(jwt.sign(expiredToken, secret))
