import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const fixturePath = process.argv[2] || new URL('../docs/examples/go-agent-first-sample.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
const states = JSON.parse(await readFile(new URL('../docs/command-state.json', import.meta.url), 'utf8'));
const http = Object.fromEntries(fixture.http.map(entry => [entry.id, entry]));
const ws = Object.fromEntries(fixture.websocket.map(entry => [entry.id, entry.message]));
const cases = Object.fromEntries(fixture.cases.map(entry => [entry.id, entry]));
const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object[key]]));
const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

// Only the RFC 8785 subset used by these published vectors is exercised here.
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const pairs = Object.keys(value).sort().map(key => {
    assert.match(key, /^[\x20-\x7e]+$/, 'Fixture keys must be ASCII');
    return JSON.stringify(key) + ':' + canonical(value[key]);
  });
  return '{' + pairs.join(',') + '}';
}

const timeline = [
  'node.create', 'enrollment.issue', 'enroll.challenge', 'enroll.prove',
  'connect.challenge', 'connect.prove', 'connect.upgrade', 'hello', 'welcome', 'ready', 'ready.ack',
  'command.create', 'command.dispatch', 'command.accepted', 'command.started', 'localObservation',
  'command.result', 'result.received', 'result.committed', 'nodes.list', 'node.read', 'command.read'
];
assert.equal(fixture.contractVersion, 'ga01.v1');
assert.deepEqual(fixture.timeline, timeline);
assert.deepEqual([...fixture.http, ...fixture.websocket].map(e => e.id).sort(),
  timeline.filter(id => id !== 'localObservation').sort());
const enrolled = http['enroll.prove'].response.body;
const identityKeys = ['tenantId', 'nodeId', 'nodeIncarnation'];
const identity = pick(enrolled, identityKeys);
const dispatch = ws['command.dispatch'];
const result = ws['command.result'];
const tenant = '/v1/tenants/' + identity.tenantId;
const node = tenant + '/nodes/' + identity.nodeId;
const command = tenant + '/commands/' + dispatch.commandId;
const endpoints = [
  ['node.create', 'POST', tenant + '/nodes', 201], ['enrollment.issue', 'POST', tenant + '/enrollments', 201],
  ['enroll.challenge', 'POST', '/v1/agents/enroll', 200], ['enroll.prove', 'POST', '/v1/agents/enroll', 201],
  ['connect.challenge', 'POST', '/v1/agents/connect-ticket', 200], ['connect.prove', 'POST', '/v1/agents/connect-ticket', 200],
  ['connect.upgrade', 'GET', '/v1/agents/connect', 101], ['command.create', 'POST', node + '/commands', 202],
  ['nodes.list', 'GET', tenant + '/nodes', 200], ['node.read', 'GET', node, 200], ['command.read', 'GET', command, 200]
];
for (const [id, method, path, status] of endpoints) {
  const {request, response} = http[id];
  assert.deepEqual([request.method, request.path, response.status], [method, path, status], id);
  const headers = new Headers(request.headers);
  if (path.startsWith(tenant + '/')) {
    assert.equal(headers.get('Cookie'), 'af_session=${USER_SESSION}', id + ' tenant session');
    if (method === 'POST') {
      assert.equal(headers.get('Origin'), fixture.exampleOrigin, id + ' same origin');
      assert.equal(headers.get('X-CSRF-Token'), '${CSRF_TOKEN}', id + ' session CSRF');
      assert(headers.get('Idempotency-Key')?.trim(), id + ' idempotency key');
    }
  }
}

const issued = http['enrollment.issue'];
assert.equal(issued.request.body.nodeId, http['node.create'].response.body.nodeId);
assert.equal(issued.response.body.nodeId, identity.nodeId);
assert.equal(issued.request.body.nodeId, identity.nodeId);
const connected = http['connect.prove'].response.body;
assert.deepEqual(pick(connected, [...identityKeys, 'keyVersion']), pick(enrolled, [...identityKeys, 'keyVersion']));
assert.equal(connected.protocolVersion, http['connect.prove'].request.body.protocolVersion);
for (const id of ['enrollment.issue','enroll.challenge','enroll.prove','connect.challenge','connect.prove']) {
  assert.equal(new Headers(http[id].response.headers).get('Cache-Control'), 'no-store', id + ' cache policy');
}
assert(issued.response.body.ticket && connected.connectTicket);
const upgrade = http['connect.upgrade'];
assert.equal(new Headers(upgrade.request.headers).get('Authorization'), 'Bearer ' + connected.connectTicket);
for (const side of [upgrade.request, upgrade.response]) {
  const headers = new Headers(side.headers);
  assert.equal(headers.get('Sec-WebSocket-Protocol'), 'angelfleet.v1');
  assert.equal(headers.get('Upgrade')?.toLowerCase(), 'websocket');
  assert.equal(headers.get('Connection')?.toLowerCase(), 'upgrade');
}

function decodeBase64Url(encoded) {
  const bytes = Buffer.from(encoded, 'base64url');
  assert.equal(bytes.toString('base64url'), encoded, 'Expected unpadded base64url');
  return bytes;
}
const rawKey = http['enroll.challenge'].request.body.publicKey;
const rawBytes = decodeBase64Url(rawKey);
assert.equal(rawBytes.length, 32);
assert.equal(enrolled.publicKeyHash, digest(rawBytes));
const key = await webcrypto.subtle.importKey('raw', rawBytes, 'Ed25519', false, ['verify']);
const recovery = cases['recover-lost-enroll-response'].exchanges;
const challengesSeen = new Set();
const noncesSeen = new Set();
for (const [challenge, prove, purpose] of [
  [http['enroll.challenge'], http['enroll.prove'], 'enroll'],
  [http['connect.challenge'], http['connect.prove'], 'connect'],
  [recovery[0], recovery[1], 'enroll']
]) {
  const offer = challenge.response.body;
  const proof = prove.request.body;
  const bytes = decodeBase64Url(offer.proofInput);
  const signed = JSON.parse(bytes.toString('utf8'));
  assert.equal(bytes.toString('utf8'), canonical(signed));
  assert.equal(offer.algorithm, 'Ed25519');
  assert.equal(challenge.request.body.phase, 'challenge');
  const {phase, signature, challengeId, ...echo} = proof;
  assert.equal(phase, 'prove');
  assert.deepEqual({...echo, phase:'challenge'}, challenge.request.body);
  assert.equal(signed.challengeId, challengeId);
  assert.equal(signed.challengeId, offer.challengeId);
  assert.equal(signed.domain, 'angelfleet.node-proof.v1');
  assert.equal(signed.audience, fixture.exampleOrigin);
  assert.equal(signed.purpose, purpose);
  assert.equal(signed.publicKeyHash, enrolled.publicKeyHash);
  assert.equal(signed.requestId, proof.requestId);
  assert.equal(signed.expiresAt, offer.expiresAt);
  assert(!challengesSeen.has(challengeId) && !noncesSeen.has(signed.nonce), 'Challenge and nonce must be fresh');
  challengesSeen.add(challengeId);
  noncesSeen.add(signed.nonce);
  if (purpose === 'enroll') {
    for (const {request} of [challenge, prove]) {
      assert.equal(new Headers(request.headers).get('Authorization'), 'Bearer ' + issued.response.body.ticket);
    }
    assert.equal(proof.publicKey, rawKey);
    assert.equal(signed.enrollmentId, http['enrollment.issue'].response.body.enrollmentId);
    assert.equal(proof.enrollmentId, signed.enrollmentId);
    assert.equal(proof.requestId, http['enroll.challenge'].request.body.requestId);
  } else {
    const fields = ['nodeId', 'nodeIncarnation', 'keyVersion'];
    assert.deepEqual(pick(signed, fields), pick(enrolled, fields));
    assert.deepEqual(pick(proof, fields), pick(signed, fields));
    assert.equal(signed.protocolVersion, proof.protocolVersion);
  }
  const signatureBytes = decodeBase64Url(signature);
  assert.equal(signatureBytes.length, 64);
  assert(await webcrypto.subtle.verify('Ed25519', key, signatureBytes, bytes),
    'Invalid Ed25519 signature for ' + challengeId);
}
assert.equal(recovery[1].response.status, 200);
assert.deepEqual(recovery[1].response.body, enrolled);
assert.deepEqual(cases['recover-lost-enroll-response'].assert, {newBindings:0, newSuccessAudits:0});

const epoch = ws.welcome.connectionEpoch;
const sequence = new Map();
const messageIds = new Set();
const fromConnector = new Set(['hello', 'ready', 'command.accepted', 'command.started', 'command.result']);
assert(BigInt(epoch) > BigInt(ws.hello.highestEpoch));
for (const {id, direction, message} of fixture.websocket) {
  assert.equal(message.type, id);
  assert.equal(message.version, 1);
  assert(!messageIds.has(message.messageId));
  messageIds.add(message.messageId);
  assert.deepEqual(pick(message, identityKeys), identity);
  assert.equal(direction, fromConnector.has(id) ? 'connector → AgentConn' : 'AgentConn → connector');
  if (id === 'hello') continue;
  assert.equal(message.connectionEpoch, epoch);
  const next = (sequence.get(direction) || 0) + 1;
  assert.equal(message.sequence, String(next), id + ' sequence');
  sequence.set(direction, next);
}

const submitted = http['command.create'];
assert.equal(dispatch.operation, 'node.inspect');
assert.deepEqual(pick(dispatch, ['operation','payload','resourceVersion']), submitted.request.body);
assert.equal(dispatch.commandId, submitted.response.body.commandId);
assert.equal(dispatch.expiresAt, submitted.response.body.expiresAt);
const intent = {...identity, ...submitted.request.body, expiresAt:dispatch.expiresAt};
function checkVector(name, input, hash) {
  assert.deepEqual(fixture.digestVectors[name], {input, hash}, 'Published vector differs from wire fields: ' + name);
  assert.equal(digest(canonical(input)), hash, name + ' digest');
}
checkVector('intent', intent, dispatch.intentHash);
const transitionExists = (from,to) => states.transitions.some(edge => edge.from === from && edge.to === to);
assert.equal(submitted.response.body.state, 'QUEUED');
assert(transitionExists('QUEUED', 'DISPATCHED'));
let previous = 'DISPATCHED';
const eventIds = new Set();
for (const [n, [id, state]] of [['command.accepted','RECEIVED'], ['command.started','RUNNING'], ['command.result','SUCCEEDED']].entries()) {
  const event = ws[id];
  assert.equal(event.commandId, dispatch.commandId);
  assert.equal(event.intentHash, dispatch.intentHash);
  assert.equal(event.state, state);
  assert(transitionExists(previous, state), previous + ' → ' + state);
  previous = state;
  assert.equal(event.agentEventSequence, String(n + 1));
  assert(!eventIds.has(event.eventId));
  eventIds.add(event.eventId);
  const body = pick(event, [...identityKeys, 'commandId','eventId','agentEventSequence','state','intentHash']);
  if (id === 'command.result') body.result = event.result;
  checkVector('event' + (n + 1), body, event.contentHash);
}
const referenceKeys = ['commandId','eventId','agentEventSequence','contentHash'];
const resultRef = pick(result, referenceKeys);
for (const id of ['result.received','result.committed']) assert.deepEqual(pick(ws[id], referenceKeys), resultRef);
assert.equal(ws['result.committed'].applyState, 'APPLIED');
const commandView = http['command.read'].response.body;
assert.deepEqual(pick(commandView, [...identityKeys,'commandId','intentHash','state','result']),
  pick(result, [...identityKeys,'commandId','intentHash','state','result']));
assert.equal(ws['result.committed'].appliedRevision, commandView.revision);

const {adapterEvidence, sourceProjection} = fixture.localObservation;
const {sampledAt, metrics} = result.result;
const detail = http['node.read'].response.body;
const offline = cases['offline-after-good-sample'];
assert.deepEqual(pick(adapterEvidence,[...identityKeys,'commandId']), pick(result,[...identityKeys,'commandId']));
assert.equal(sampledAt, adapterEvidence.sampledAt);
assert(dispatch.issuedAt <= sampledAt && sampledAt < dispatch.expiresAt);
assert.equal(detail.sampledAt, sampledAt);
assert.equal(detail.lastSampleCommandId, dispatch.commandId);
assert.deepEqual(http['nodes.list'].response.body.items, [detail]);
assert.deepEqual(offline.response.body, {...detail, connectionState:'OFFLINE', stale:true}, 'Offline must preserve last successful sample');
for (const [metric, source, unit] of [['cpuUsedPercent','cpuUsedPercent','percent'], ['memoryUsedBytes','memoryUsed','bytes']]) {
  assert.equal(adapterEvidence.validity[source], true);
  assert.deepEqual(metrics[metric], {value:sourceProjection[source], unit, sampledAt, valid:true, stale:false});
  assert.deepEqual(offline.display[metric], {...metrics[metric], stale:true});
}
const partial = cases['partial-collection'];
assert(partial.attemptedAt > sampledAt);
assert.deepEqual(partial.display.cpuUsedPercent, {...metrics.cpuUsedPercent, value:0, sampledAt:partial.attemptedAt});
assert.deepEqual(partial.display.memoryUsedBytes, {...metrics.memoryUsedBytes, valid:false, stale:true, errorCode:'COLLECTION_FAILED'});
assert.deepEqual(cases['no-prior-sample'].display.memoryUsedBytes, {...partial.display.memoryUsedBytes, value:null, sampledAt:null});
for (const [id,status,code] of [['expired-enrollment',401,'AUTH_EXPIRED'], ['conflicting-enrollment',409,'ENROLLMENT_CONFLICT'],
  ['command-key-mismatch',409,'IDEMPOTENCY_REQUEST_MISMATCH'], ['unauthorized-node',403,'NODE_FORBIDDEN']]) {
  assert.deepEqual([cases[id].response.status,cases[id].response.body.errorCode], [status,code], id);
}
assert.deepEqual(cases['stale-epoch'].input, ws.ready);
assert(BigInt(cases['stale-epoch'].assert.highestEpoch) > BigInt(epoch));
assert.deepEqual(cases['stale-epoch'].output, {webSocketCloseCode:1008, reason:'STALE_EPOCH'});
assert.deepEqual(cases['replay-command'].request, submitted.request);
assert.equal(cases['replay-command'].response.status, submitted.response.status);
assert.deepEqual(cases['replay-command'].response.body, {...submitted.response.body, idempotencyReplay:true});
const mismatch = cases['command-key-mismatch'].request;
assert.notEqual(mismatch.body.resourceVersion, submitted.request.body.resourceVersion);
assert.deepEqual(mismatch, {...submitted.request, body:{...submitted.request.body, resourceVersion:mismatch.body.resourceVersion}});
assert.equal(cases['unauthorized-node'].request.path, http['command.read'].request.path);
assert.deepEqual(cases['await-d1-commit'].assert, {sendResultCommitted:false, keepLocalResult:true, resendIdentity:resultRef});
console.log('Verified GA-01 HTTP/WS timeline, 3 Ed25519 proofs, 4 SHA-256 vectors, command states and sampling cases.');
