import test from 'node:test';
import assert from 'node:assert/strict';
import { withReadOnlyRoute, fetchReadOnlyResponse } from './read-only-routing.mjs';
const origin = 'http://127.0.0.1:8787';
function fakeRoute({
  method = 'GET',
  url = origin + '/api/teams?id=approved-existing',
  status = 200,
  headers = {},
  responseUrl = url,
} = {}) {
  const calls = { abort: 0, fetch: 0, continue: 0, handle: 0, json: 0, fulfill: 0 };
  const response = {
    status: () => status,
    headers: () => headers,
    url: () => responseUrl,
    json: async () => {
      calls.json++;
      return { display: true };
    },
  };
  const route = {
    request: () => ({ method: () => method, url: () => url }),
    abort: async (reason) => {
      assert.equal(reason, 'blockedbyclient');
      calls.abort++;
    },
    fetch: async (options) => {
      assert.deepEqual(options, { maxRedirects: 0 });
      calls.fetch++;
      return response;
    },
    continue: async () => {
      calls.continue++;
      throw new Error('Redirectable continue transport must never be called');
    },
    fulfill: async (options) => {
      assert.equal(options.response, response);
      calls.fulfill++;
    },
  };
  return { route, calls };
}
const handlers = {
  fallback: async (route, forbidden) => {
    const response = await fetchReadOnlyResponse(route, origin, forbidden);
    if (response) return route.fulfill({ response });
  },
  personal: async (route, forbidden) => {
    const response = await fetchReadOnlyResponse(route, origin, forbidden);
    if (!response) return;
    return route.fulfill({ response, json: await response.json() });
  },
  selectedTeam: async (route, forbidden) => {
    const response = await fetchReadOnlyResponse(route, origin, forbidden);
    if (!response) return;
    return route.fulfill({ response, json: await response.json() });
  },
  unselectedTeam: async (route, forbidden) => {
    const response = await fetchReadOnlyResponse(route, origin, forbidden);
    if (response) return route.fulfill({ response });
  },
};
for (const [name, handler] of Object.entries(handlers)) {
  for (const fixture of [
    { method: 'POST' },
    { method: 'DELETE' },
    { method: 'PUT' },
    { method: 'PATCH' },
    { url: 'https://unrelated.example/api/teams?id=approved-existing' },
    { method: 'HEAD', url: 'https://unrelated.example/api/academy' },
    { url: 'https://127.0.0.1:8787/api/academy' },
    { url: 'http://127.0.0.1:9999/api/academy' },
  ])
    test(name + ' refuses ' + JSON.stringify(fixture) + ' before transport', async () => {
      const { route, calls } = fakeRoute(fixture),
        forbidden = [];
      await withReadOnlyRoute(route, origin, forbidden, async (safe) => {
        calls.handle++;
        return handler(safe, forbidden);
      });
      assert.deepEqual(calls, { abort: 1, fetch: 0, continue: 0, handle: 0, json: 0, fulfill: 0 });
      assert.equal(forbidden.length, 1);
    });
  for (const fixture of [
    { status: 301, headers: { location: origin + '/same-origin-redirect' } },
    { status: 302, headers: { location: 'https://unrelated.example/redirect' } },
    { status: 303, headers: {} },
    { status: 304, headers: {} },
    { status: 307, headers: { Location: 'https://unrelated.example/redirect' } },
    { status: 308, headers: { location: origin + '/same-origin-redirect' } },
    { status: 200, headers: { Location: 'https://unrelated.example/unusual-response' } },
    { status: 200, headers: { location: '' } },
    { status: 200, responseUrl: 'https://unrelated.example/unexpected-response' },
    { status: 200, responseUrl: 'not a url' },
  ])
    test(name + ' rejects response ' + JSON.stringify(fixture) + ' before JSON or fulfill', async () => {
      const { route, calls } = fakeRoute(fixture),
        forbidden = [];
      await withReadOnlyRoute(route, origin, forbidden, async (safe) => {
        calls.handle++;
        return handler(safe, forbidden);
      });
      assert.deepEqual(calls, { abort: 1, fetch: 1, continue: 0, handle: 1, json: 0, fulfill: 0 });
      assert.equal(forbidden.length, 1);
      assert.equal(forbidden[0].kind, 'forbidden-response');
    });
  for (const method of ['GET', 'HEAD'])
    test(name + ' accepts guarded same-origin ' + method + ' response', async () => {
      const { route, calls } = fakeRoute({ method }),
        forbidden = [];
      await withReadOnlyRoute(route, origin, forbidden, async (safe) => {
        calls.handle++;
        return handler(safe, forbidden);
      });
      assert.equal(calls.abort, 0);
      assert.equal(calls.fetch, 1);
      assert.equal(calls.continue, 0);
      assert.equal(calls.handle, 1);
      assert.equal(calls.fulfill, 1);
      assert.deepEqual(forbidden, []);
    });
}
