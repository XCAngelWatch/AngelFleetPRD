import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonical, digest } from './fixture-digests.mjs';

const docs = new URL('../docs/', import.meta.url);
const input = process.argv[2] ?? new URL('examples/node-metric-read.v1.json', docs);
const [source, firstSample, contract] = await Promise.all([
  readFile(input, 'utf8'),
  readFile(new URL('examples/go-agent-first-sample.json', docs), 'utf8'),
  readFile(new URL('go-agent-interface-contract.md', docs), 'utf8')
]);
const fixture = JSON.parse(source);
const ga01 = JSON.parse(firstSample);
const http = new Map(fixture.http.map(exchange => [exchange.id, exchange]));
const frames = new Map(fixture.websocket.map(frame => [frame.id, frame]));
const requests = ['empty.metrics.read', 's1.create', 's1.command.read', 's1.metrics.read',
  's2.create', 's2.command.read', 's2.metrics.read', 'offline.metrics.read',
  'unauthenticated.metrics.read', 'forbidden.metrics.read', 'mismatch.metrics.read', 'invalid.metrics.read', 'unavailable.metrics.read'];
assert.deepEqual(fixture.http.map(x => x.id).sort(), [...requests].sort());
assert.deepEqual([...frames.keys()], ['s1.result','s2.result']);
assert.equal(fixture.websocket.length, 2);
assert.deepEqual(fixture.timeline, ['empty.metrics.read', 's1.create', 's1.result', 's1.command.read',
  's1.metrics.read', 's2.create', 's2.result', 's2.command.read', 's2.metrics.read']);

const version = 'node-metric-read.v1';
assert.equal(fixture.contractVersion, version);
assert.equal(fixture.exampleOrigin, ga01.exampleOrigin);
const originalCreate = ga01.http.find(x => x.id === 'command.create');
const originalResult = ga01.websocket.find(x => x.id === 'command.result');
const originalRead = ga01.http.find(x => x.id === 'command.read');
assert.deepEqual(http.get('s1.create'), {...originalCreate, id:'s1.create'});
assert.deepEqual(frames.get('s1.result'), {...originalResult, id:'s1.result'});
assert.deepEqual(http.get('s1.command.read').response.body, originalRead.response.body);
const {tenantId,nodeId,nodeIncarnation} = originalResult.message;
const identity = {tenantId,nodeId,nodeIncarnation};
const tenant = '/v1/tenants/' + tenantId;
const node = tenant + '/nodes/' + nodeId;
const path = node + '/metrics/latest';
const query = '?nodeIncarnation=' + nodeIncarnation;
const metricNames = ['cpuUsedPercent','memoryUsedBytes'];
const member = originalCreate.request.headers.Cookie;

const noReading = unit => ({unit,lastGood:null,latestValid:null,stale:true,errorCode:null});
const empty = {
  contractVersion:version, ...identity, connectionState:'ONLINE', projectionRevision:'0', latestAttempt:null,
  metrics:{cpuUsedPercent:noReading('percent'), memoryUsedBytes:noReading('bytes')}
};
function newModel() {
  return {body:structuredClone(empty), goodOrders:new Map()};
}
function applyResult(model, sampleOrder, event) {
  const body = model.body;
  const order = BigInt(sampleOrder);
  const newest = order > BigInt(body.latestAttempt?.sampleOrder ?? '0');
  let changed = newest;
  if (newest) body.latestAttempt = {commandId:event.commandId,sampleOrder,state:event.state};
  for (const name of metricNames) {
    const raw = event.result.metrics[name];
    const metric = body.metrics[name];
    assert.equal(raw.unit, metric.unit);
    if (newest) {
      metric.latestValid = raw.valid;
      metric.stale = !raw.valid;
      metric.errorCode = raw.errorCode ?? null;
    }
    if (raw.valid && order > (model.goodOrders.get(name) ?? 0n)) {
      metric.lastGood = {value:raw.value,sampledAt:raw.sampledAt,commandId:event.commandId};
      model.goodOrders.set(name, order);
      changed = true;
    }
  }
  if (changed) body.projectionRevision = String(BigInt(body.projectionRevision) + 1n);
}
function checkRead(id, expected) {
  const {request, response} = http.get(id);
  assert.deepEqual([request.method, request.path, request.headers.Cookie, response.status], ['GET',path + query,member,200], id);
  assert.deepEqual(response.body, expected, id + ' body');
}
checkRead('empty.metrics.read', empty);

const partial = ga01.cases.find(x => x.id === 'partial-collection');
const secondRaw = frames.get('s2.result').message.result;
assert.deepEqual(secondRaw.metrics.cpuUsedPercent, partial.display.cpuUsedPercent);
assert.deepEqual(secondRaw.metrics.memoryUsedBytes, {
  value:null,unit:'bytes',sampledAt:null,valid:false,stale:true,errorCode:'COLLECTION_FAILED'
});
assert.equal(secondRaw.sampledAt, partial.attemptedAt);
const ids = new Set();
const keys = new Set();
const forward = newModel();
for (const ordinal of [1,2]) {
  const step = 's' + ordinal;
  const frame = frames.get(step + '.result');
  const event = frame.message;
  const {request, response} = http.get(step + '.create');
  const receipt = response.body;
  const createHeaders = new Headers(request.headers);
  assert.deepEqual([request.method, request.path, response.status], ['POST',node + '/commands',202]);
  assert.deepEqual(request.body, originalCreate.request.body);
  for (const name of ['Cookie','Origin','X-CSRF-Token','Content-Type']) {
    assert.equal(createHeaders.get(name), new Headers(originalCreate.request.headers).get(name), step + ' ' + name);
  }
  const key = createHeaders.get('Idempotency-Key');
  assert(key?.trim() && !keys.has(key), 'The two captures need distinct idempotency keys');
  keys.add(key);
  assert(receipt.commandId && !ids.has(receipt.commandId));
  ids.add(receipt.commandId);
  assert.deepEqual([receipt.state, receipt.idempotencyReplay], ['QUEUED', false]);
  assert.deepEqual([event.type, frame.direction, event.state, event.commandId], [
    'command.result', originalResult.direction, 'SUCCEEDED', receipt.commandId
  ]);
  for (const [field, value] of Object.entries(identity)) assert.equal(event[field], value);
  const intent = {...identity,...request.body,expiresAt:receipt.expiresAt};
  assert.equal(event.intentHash, digest(canonical(intent)), step + ' intent digest');
  const eventKeys = Object.keys(ga01.digestVectors.event3.input);
  const evidence = Object.fromEntries(eventKeys.map(k => [k, event[k]]));
  assert.equal(event.contentHash, digest(canonical(evidence)), step + ' event digest');
  const detail = http.get(step + '.command.read');
  assert.deepEqual([detail.request.method,detail.request.path,detail.request.headers.Cookie,detail.response.status],
    ['GET',tenant + '/commands/' + receipt.commandId,member,200]);
  const body = detail.response.body;
  assert.deepEqual([body.tenantId,body.nodeId,body.nodeIncarnation], Object.values(identity));
  assert.deepEqual([body.commandId,body.intentHash,body.operation,body.state,body.result],
    [event.commandId,event.intentHash,'node.inspect',event.state,event.result], step + ' original result');

  applyResult(forward, String(ordinal), event);
  checkRead(step + '.metrics.read', forward.body);
}
// The order belongs to command admission. Reverse only the arrival of the two terminal events.
const reversed = newModel();
const second = frames.get('s2.result').message;
applyResult(reversed, '2', second);
assert.equal(reversed.body.projectionRevision, '1');
assert.equal(reversed.body.metrics.cpuUsedPercent.lastGood.commandId, second.commandId);
assert.equal(reversed.body.metrics.memoryUsedBytes.lastGood, null);
applyResult(reversed, '1', frames.get('s1.result').message);
checkRead('s2.metrics.read', reversed.body);
applyResult(reversed, '2', second);
checkRead('s2.metrics.read', reversed.body);
const offline = structuredClone(forward.body);
offline.connectionState = 'OFFLINE';
for (const metric of Object.values(offline.metrics)) metric.stale = true;
checkRead('offline.metrics.read', offline);

for (const [id, status, code, endpoint, cookie] of [
  ['unauthenticated.metrics.read',401,'UNAUTHORIZED',path + query,null],
  ['forbidden.metrics.read',403,'NODE_FORBIDDEN',path + query,'af_session=${USER_B_SESSION}'],
  ['mismatch.metrics.read',409,'NODE_INCARNATION_MISMATCH',path + '?nodeIncarnation=inc-old',member],
  ['invalid.metrics.read',400,'INVALID_REQUEST',path,member],
  ['unavailable.metrics.read',503,'STORAGE_UNAVAILABLE',path + query,member]
]) {
  const {request, response} = http.get(id);
  assert.deepEqual([request.method, request.path, new Headers(request.headers).get('Cookie'), response.status],
    ['GET', endpoint, cookie, status], id);
  assert.deepEqual(Object.keys(response.body).sort(), ['errorCode','traceId'], id + ' leaked fields');
  assert.equal(response.body.errorCode, code);
  assert(response.body.traceId?.trim());
}
const traces = new Set();
for (const id of requests.filter(id => id.endsWith('.metrics.read'))) {
  const {response} = http.get(id);
  const headers = new Headers(response.headers);
  assert.equal(headers.get('Cache-Control'), 'private, no-store', id + ' cache policy');
  assert.equal(headers.get('Content-Type'), 'application/json', id + ' content type');
  const trace = headers.get('X-Trace-Id');
  assert(trace?.trim() && !traces.has(trace), id + ' needs a unique read trace');
  traces.add(trace);
  if (response.status >= 400) assert.equal(response.body.traceId, trace, id + ' error trace');
}
const section = contract.split('## 5.3 逐指标读取与冷启动展示')[1]?.split(/^#{1,2} /m)[0];
const publishedTrace = section?.match(/^X-Trace-Id: ([^\s]+)\r?$/m)?.[1];
assert.equal(publishedTrace, new Headers(http.get('s2.metrics.read').response.headers).get('X-Trace-Id'), 'Published success trace');
const example = section?.match(/^```json\s*\r?\n([\s\S]*?)\r?\n```/m);
assert(example, 'Section 5.3 must publish the full cold-read response');
assert.deepEqual(JSON.parse(example[1]), http.get('s2.metrics.read').response.body, 'Published cold-read example');
console.log('Verified node-metric-read.v1: S1/S2 command digests, per-metric sources, ordered/reversed/replayed results, cold and offline reads, trace IDs, failure responses and published JSON.');
