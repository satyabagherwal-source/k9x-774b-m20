import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HeadlessApiRouter } from '../src/core/engine.mjs';

describe('Headless API Suite', () => {
  it('Feature 1: Dispatches registered route', () => {
    const router = new HeadlessApiRouter();
    router.register('GET', '/api/health', () => ({ status: 'healthy' }));
    const res = router.handle({ method: 'GET', path: '/api/health' });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { status: 'healthy' });
  });

  it('Feature 2: Returns RFC 7807 problem details on 404', () => {
    const router = new HeadlessApiRouter();
    const res = router.handle({ method: 'GET', path: '/unknown' });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.title, 'Not Found');
  });
});
