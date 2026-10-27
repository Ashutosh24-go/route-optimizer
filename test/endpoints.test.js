import test from 'node:test';
import assert from 'node:assert/strict';

import { app, server } from '../server.js';

test('Verification: call every API endpoint once and verify status codes', async (t) => {
  const address = server.address();
  const port = address ? address.port : 3000;
  const baseUrl = `http://localhost:${port}`;

  console.log(`\nTesting all API endpoints against ${baseUrl}...`);

  const results = [];

  // 1. GET /api/config
  {
    const res = await fetch(`${baseUrl}/api/config`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok('mapsApiKey' in data);
    results.push({ endpoint: 'GET /api/config', status: res.status });
  }

  // 2. GET /api/orders
  {
    const res = await fetch(`${baseUrl}/api/orders?sort=deadline`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.orders));
    results.push({ endpoint: 'GET /api/orders', status: res.status });
  }

  // 3. POST /api/orders
  let createdOrderId = null;
  {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId: 1,
        weight: 6.5,
        priority: 'Normal',
        deadline: '3:30 PM'
      })
    });
    const data = await res.json();
    assert.equal(res.status, 201);
    assert.ok(data.order && data.order.id);
    createdOrderId = data.order.id;
    results.push({ endpoint: 'POST /api/orders', status: res.status });
  }

  // 4. POST /api/orders/:id/cancel
  {
    const res = await fetch(`${baseUrl}/api/orders/${createdOrderId}/cancel`, {
      method: 'POST'
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.order.status, 'Cancelled');
    results.push({ endpoint: `POST /api/orders/:id/cancel`, status: res.status });
  }

  // 5. GET /api/queue
  {
    const res = await fetch(`${baseUrl}/api/queue`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.queue));
    results.push({ endpoint: 'GET /api/queue', status: res.status });
  }

  // 6. POST /api/queue/dispatch
  {
    const res = await fetch(`${baseUrl}/api/queue/dispatch`, {
      method: 'POST'
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.dispatched);
    results.push({ endpoint: 'POST /api/queue/dispatch', status: res.status });
  }

  // 7. GET /api/drivers
  {
    const res = await fetch(`${baseUrl}/api/drivers`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.drivers));
    results.push({ endpoint: 'GET /api/drivers', status: res.status });
  }

  // 8. POST /api/assign
  {
    const res = await fetch(`${baseUrl}/api/assign`, {
      method: 'POST'
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.assigned));
    assert.ok(Array.isArray(data.pending));
    results.push({ endpoint: 'POST /api/assign', status: res.status });
  }

  // 9. GET /api/route?driverId=&algorithm=
  {
    const res = await fetch(`${baseUrl}/api/route?driverId=DRV-1&algorithm=2-opt`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.stops && Array.isArray(data.stops));
    assert.ok(data.polyline && Array.isArray(data.polyline));
    assert.ok(data.comparison && data.comparison.text);
    results.push({ endpoint: 'GET /api/route', status: res.status });
  }

  // 10. POST /api/status/:id/advance
  {
    // Advance ORD-103 which was In transit to Delivered
    const res = await fetch(`${baseUrl}/api/status/ORD-103/advance`, {
      method: 'POST'
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.order.status, 'Delivered');
    results.push({ endpoint: 'POST /api/status/:id/advance', status: res.status });
  }

  // 11. GET /api/status
  {
    const res = await fetch(`${baseUrl}/api/status`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.groups);
    assert.ok(Array.isArray(data.changeLog));
    results.push({ endpoint: 'GET /api/status', status: res.status });
  }

  // 12. GET /api/benchmark
  {
    const res = await fetch(`${baseUrl}/api/benchmark`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.resultsTable));
    assert.ok(data.chartSeries);
    results.push({ endpoint: 'GET /api/benchmark', status: res.status });
  }

  // 13. GET /api/locations
  {
    const res = await fetch(`${baseUrl}/api/locations`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.locations));
    results.push({ endpoint: 'GET /api/locations', status: res.status });
  }

  // Close server when done
  server.close();

  console.log('\n--- Endpoint Status Codes ---');
  results.forEach((r) => {
    console.log(`${r.status} ${r.endpoint}`);
  });
  console.log('-----------------------------\n');
});
