import test from 'node:test';
import assert from 'node:assert/strict';

import { MinHeap } from '../src/heap.js';
import { haversine, dijkstra } from '../src/graph.js';
import { OrderStore, compareOrders } from '../src/orders.js';
import { DriverStore } from '../src/drivers.js';
import { StatusManager } from '../src/status.js';
import {
  solveNearestNeighbor,
  solve2Opt,
  solveBruteForce,
  solveHeldKarp
} from '../src/tsp.js';
import { runBenchmark, mulberry32 } from '../src/benchmark.js';

// ========================================================
// 1. MinHeap: extraction sorted; ties by deadline, then creation
// ========================================================
test('Heap: extraction order is sorted; ties broken by deadline, then creation order', () => {
  // Test basic numbers min-heap
  const numHeap = new MinHeap((a, b) => a - b);
  const values = [45, 12, 89, 3, 27, 12, 9];
  for (const v of values) numHeap.insert(v);

  const extractedNums = [];
  while (!numHeap.isEmpty()) {
    extractedNums.push(numHeap.extractMin());
  }
  assert.deepEqual(extractedNums, [3, 9, 12, 12, 27, 45, 89]);

  // Test Orders MinHeap with tie-breaking:
  // Priority: Urgent (0) < Normal (1) < Low (2)
  // Tie-breaker 1: Deadline (earliest first)
  // Tie-breaker 2: Creation order (smaller createdAt first)
  const orderHeap = new MinHeap(compareOrders);

  const orders = [
    { id: 'O1', priority: 'Low', deadline: '10:00 AM', createdAt: 5 },
    { id: 'O2', priority: 'Normal', deadline: '2:00 PM', createdAt: 3 },
    { id: 'O3', priority: 'Urgent', deadline: '1:00 PM', createdAt: 10 },
    { id: 'O4', priority: 'Urgent', deadline: '11:00 AM', createdAt: 8 },
    { id: 'O5', priority: 'Normal', deadline: '11:00 AM', createdAt: 1 },
    { id: 'O6', priority: 'Urgent', deadline: '11:00 AM', createdAt: 2 }, // Tie with O4 on priority & deadline, but O6 created earlier (2 < 8)
    { id: 'O7', priority: 'Low', deadline: '9:00 AM', createdAt: 9 }
  ];

  for (const o of orders) orderHeap.insert(o);

  const extracted = [];
  while (!orderHeap.isEmpty()) {
    extracted.push(orderHeap.extractMin().id);
  }

  // Expected order:
  // 1. O6: Urgent, 11:00 AM, createdAt: 2
  // 2. O4: Urgent, 11:00 AM, createdAt: 8
  // 3. O3: Urgent, 1:00 PM
  // 4. O5: Normal, 11:00 AM
  // 5. O2: Normal, 2:00 PM
  // 6. O7: Low, 9:00 AM
  // 7. O1: Low, 10:00 AM
  assert.deepEqual(extracted, ['O6', 'O4', 'O3', 'O5', 'O2', 'O7', 'O1']);
});

// ========================================================
// 2. Dijkstra equals a Floyd-Warshall oracle on 20 random graphs
// ========================================================
test('Dijkstra equals a Floyd-Warshall oracle on 20 random graphs', () => {
  // Floyd-Warshall oracle (lives in test file only)
  function floydWarshallOracle(n, edgeList) {
    const dist = Array.from({ length: n }, () => new Float64Array(n).fill(Infinity));
    for (let i = 0; i < n; i++) dist[i][i] = 0;
    for (const [u, v, w] of edgeList) {
      dist[u][v] = Math.min(dist[u][v], w);
      dist[v][u] = Math.min(dist[v][u], w);
    }
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (dist[i][k] + dist[k][j] < dist[i][j]) {
            dist[i][j] = dist[i][k] + dist[k][j];
          }
        }
      }
    }
    return dist;
  }

  const prng = mulberry32(99999);

  for (let run = 0; run < 20; run++) {
    const n = 5 + Math.floor(prng() * 6); // 5 to 10 nodes
    const edgeList = [];
    const adj = new Map();
    const locations = new Map();

    for (let i = 0; i < n; i++) {
      locations.set(i, { id: i, lat: 28.5 + i * 0.01, lng: 77.1 + i * 0.01 });
      adj.set(i, []);
    }

    // Ensure connectivity via simple spanning tree
    for (let i = 1; i < n; i++) {
      const parent = Math.floor(prng() * i);
      const weight = Math.round((1 + prng() * 20) * 100) / 100;
      edgeList.push([parent, i, weight]);
      adj.get(parent).push({ to: i, weight });
      adj.get(i).push({ to: parent, weight });
    }

    // Add extra random edges
    const extraEdges = Math.floor(prng() * n);
    for (let e = 0; e < extraEdges; e++) {
      const u = Math.floor(prng() * n);
      const v = Math.floor(prng() * n);
      if (u !== v) {
        const weight = Math.round((1 + prng() * 20) * 100) / 100;
        edgeList.push([u, v, weight]);
        adj.get(u).push({ to: v, weight });
        adj.get(v).push({ to: u, weight });
      }
    }

    const oracle = floydWarshallOracle(n, edgeList);
    const graph = { locations, adj };

    // Compare Dijkstra from every node against oracle
    for (let src = 0; src < n; src++) {
      const { dist } = dijkstra(graph, src);
      for (let dest = 0; dest < n; dest++) {
        const dDijkstra = dist.get(dest);
        const dOracle = oracle[src][dest];
        assert.ok(
          Math.abs(dDijkstra - dOracle) < 1e-6,
          `Graph ${run}: Dijkstra dist(${src}, ${dest}) = ${dDijkstra} != Oracle = ${dOracle}`
        );
      }
    }
  }
});

// ========================================================
// 3. Held-Karp cost equals brute-force cost on 20 random instances of 4 to 8 stops
// ========================================================
test('Held-Karp cost equals brute-force cost on 20 random instances of 4 to 8 stops', () => {
  const prng = mulberry32(54321);

  for (let run = 0; run < 20; run++) {
    const stopsCount = 4 + (run % 5); // 4, 5, 6, 7, 8 stops
    const totalLocations = stopsCount + 1; // including depot at 0

    // Generate random 2D points to form symmetric Euclidean/Haversine-like distance matrix
    const points = [];
    for (let i = 0; i < totalLocations; i++) {
      points.push({ x: prng() * 100, y: prng() * 100 });
    }

    const distMatrix = Array.from({ length: totalLocations }, () =>
      new Float64Array(totalLocations)
    );

    for (let i = 0; i < totalLocations; i++) {
      for (let j = 0; j < totalLocations; j++) {
        if (i === j) {
          distMatrix[i][j] = 0;
        } else {
          const dx = points[i].x - points[j].x;
          const dy = points[i].y - points[j].y;
          distMatrix[i][j] = Math.sqrt(dx * dx + dy * dy);
        }
      }
    }

    const bf = solveBruteForce(distMatrix);
    const hk = solveHeldKarp(distMatrix);

    assert.ok(
      Math.abs(hk.distance - bf.distance) < 1e-6,
      `Run ${run} (n=${stopsCount}): Held-Karp (${hk.distance}) does not equal Brute Force (${bf.distance})`
    );

    // Verify tour validity
    assert.equal(hk.tour[0], 0);
    assert.equal(hk.tour[hk.tour.length - 1], 0);
    assert.equal(hk.tour.length, stopsCount + 2);

    const visitedStops = new Set(hk.tour.slice(1, -1));
    assert.equal(visitedStops.size, stopsCount);
  }
});

// ========================================================
// 4. Nearest neighbor and 2-opt always return a valid tour; 2-opt <= nearest neighbor
// ========================================================
test('Nearest neighbor and 2-opt always return a valid tour; the 2-opt cost is never higher than nearest neighbor cost', () => {
  const prng = mulberry32(77777);
  const testSizes = [3, 5, 8, 12, 16, 25, 40];

  for (const n of testSizes) {
    const totalLocations = n + 1;
    const points = [];
    for (let i = 0; i < totalLocations; i++) {
      points.push({ x: prng() * 100, y: prng() * 100 });
    }

    const distMatrix = Array.from({ length: totalLocations }, () =>
      new Float64Array(totalLocations)
    );
    for (let i = 0; i < totalLocations; i++) {
      for (let j = 0; j < totalLocations; j++) {
        if (i === j) distMatrix[i][j] = 0;
        else {
          const dx = points[i].x - points[j].x;
          const dy = points[i].y - points[j].y;
          distMatrix[i][j] = Math.sqrt(dx * dx + dy * dy);
        }
      }
    }

    const nn = solveNearestNeighbor(distMatrix);
    const opt2 = solve2Opt(distMatrix);

    // 1. Verify NN tour validity
    assert.equal(nn.tour[0], 0);
    assert.equal(nn.tour[nn.tour.length - 1], 0);
    assert.equal(nn.tour.length, n + 2);
    const nnVisited = new Set(nn.tour.slice(1, -1));
    assert.equal(nnVisited.size, n, 'NN must visit each stop exactly once');

    // 2. Verify 2-opt tour validity
    assert.equal(opt2.tour[0], 0);
    assert.equal(opt2.tour[opt2.tour.length - 1], 0);
    assert.equal(opt2.tour.length, n + 2);
    const opt2Visited = new Set(opt2.tour.slice(1, -1));
    assert.equal(opt2Visited.size, n, '2-opt must visit each stop exactly once');

    // 3. 2-opt cost is NEVER higher than NN cost
    assert.ok(
      opt2.distance <= nn.distance + 1e-9,
      `Size ${n}: 2-opt distance (${opt2.distance}) is higher than NN distance (${nn.distance})`
    );
  }
});

// ========================================================
// 5. Assignment never exceeds driver capacity, and order that fits no driver stays Pending with reason
// ========================================================
test("Assignment never exceeds a driver's capacity, and an order that fits no driver stays Pending with a reason", () => {
  const orderStore = new OrderStore();
  const driverStore = new DriverStore();
  const statusManager = new StatusManager();

  const mockLocations = new Map([
    [1, { id: 1, name: 'L1' }],
    [2, { id: 2, name: 'L2' }],
    [3, { id: 3, name: 'L3' }],
    [4, { id: 4, name: 'L4' }]
  ]);

  driverStore.setDrivers([
    { id: 'D1', name: 'Driver 1', capacityKg: 20, assignedOrders: [], load: 0 },
    { id: 'D2', name: 'Driver 2', capacityKg: 15, assignedOrders: [], load: 0 }
  ]);

  // Order 1: 12 kg (Fits D1: 20 - 12 = 8 left)
  // Order 2: 10 kg (Doesn't fit D1 [8 left], fits D2 [15 - 10 = 5 left])
  // Order 3: 6 kg (Doesn't fit D1 [8 left] or D2 [5 left] -> wait, 6 <= 8! So fits D1! D1 has 2 left)
  // Order 4: 9 kg (Doesn't fit D1 [2 left] or D2 [5 left] -> Stays Pending!)
  orderStore.addOrder(
    { id: 'ORD-A', locationId: 1, weight: 12, priority: 'Urgent', deadline: '10:00 AM' },
    mockLocations
  );
  orderStore.addOrder(
    { id: 'ORD-B', locationId: 2, weight: 10, priority: 'Urgent', deadline: '11:00 AM' },
    mockLocations
  );
  orderStore.addOrder(
    { id: 'ORD-C', locationId: 3, weight: 6, priority: 'Normal', deadline: '12:00 PM' },
    mockLocations
  );
  orderStore.addOrder(
    { id: 'ORD-D', locationId: 4, weight: 9, priority: 'Low', deadline: '1:00 PM' },
    mockLocations
  );

  const result = driverStore.assignOrders(orderStore, statusManager);

  // Check assigned
  assert.equal(result.assigned.length, 3);
  assert.equal(result.assigned[0].orderId, 'ORD-A');
  assert.equal(result.assigned[0].driverId, 'D1');

  assert.equal(result.assigned[1].orderId, 'ORD-B');
  assert.equal(result.assigned[1].driverId, 'D2');

  assert.equal(result.assigned[2].orderId, 'ORD-C');
  assert.equal(result.assigned[2].driverId, 'D1');

  // Check pending with reason
  assert.equal(result.pending.length, 1);
  assert.equal(result.pending[0].orderId, 'ORD-D');
  assert.match(result.pending[0].reason, /No driver has 9 kg free/);

  // Verify driver capacities never exceeded
  const drivers = driverStore.getDrivers(orderStore);
  for (const d of drivers) {
    assert.ok(
      d.load <= d.capacityKg,
      `Driver ${d.id} load (${d.load}) exceeded capacity (${d.capacityKg})`
    );
  }

  // Verify ORD-D remains Pending in store
  const ordD = orderStore.getOrder('ORD-D');
  assert.equal(ordD.status, 'Pending');
  assert.equal(ordD.driverId, null);
});

// ========================================================
// 6. Status machine rejects illegal transitions with 409
// ========================================================
test('Status machine rejects illegal transitions with 409', () => {
  const statusManager = new StatusManager();

  const makeOrder = (status) => ({ id: 'ORD-999', status });

  // 1. Pending -> Delivered (illegal, must go Assigned -> In transit -> Delivered)
  assert.throws(
    () => statusManager.recordTransition(makeOrder('Pending'), 'Delivered'),
    (err) => err.status === 409
  );

  // 2. Assigned -> Delivered (illegal, must go via In transit)
  assert.throws(
    () => statusManager.recordTransition(makeOrder('Assigned'), 'Delivered'),
    (err) => err.status === 409
  );

  // 3. In transit -> Pending (illegal backward transition)
  assert.throws(
    () => statusManager.recordTransition(makeOrder('In transit'), 'Pending'),
    (err) => err.status === 409
  );

  // 4. In transit -> Cancelled (Cancel allowed ONLY from Pending or Assigned)
  assert.throws(
    () => statusManager.cancelOrder(makeOrder('In transit')),
    (err) => err.status === 409
  );

  // 5. Delivered -> Cancelled (illegal)
  assert.throws(
    () => statusManager.cancelOrder(makeOrder('Delivered')),
    (err) => err.status === 409
  );

  // 6. Cancelled -> Assigned (illegal)
  assert.throws(
    () => statusManager.recordTransition(makeOrder('Cancelled'), 'Assigned'),
    (err) => err.status === 409
  );

  // 7. Advance on Delivered -> 409
  assert.throws(
    () => statusManager.advanceOrder(makeOrder('Delivered')),
    (err) => err.status === 409
  );

  // 8. Advance on Cancelled -> 409
  assert.throws(
    () => statusManager.advanceOrder(makeOrder('Cancelled')),
    (err) => err.status === 409
  );
});

// ========================================================
// 7. Benchmark marks Held-Karp and brute force "did not finish" at 50 and 100
// ========================================================
test('The benchmark marks Held-Karp and brute force "did not finish" at 50 and 100', () => {
  const benchmark = runBenchmark();
  const { resultsTable } = benchmark;

  const row50HK = resultsTable.find((r) => r.n === 50 && r.algorithm === 'Held-Karp');
  const row50BF = resultsTable.find((r) => r.n === 50 && r.algorithm === 'Brute force');
  const row100HK = resultsTable.find((r) => r.n === 100 && r.algorithm === 'Held-Karp');
  const row100BF = resultsTable.find((r) => r.n === 100 && r.algorithm === 'Brute force');

  assert.ok(row50HK, 'Held-Karp n=50 row must exist');
  assert.equal(row50HK.status, 'did not finish');
  assert.ok(row50HK.reason && row50HK.reason.length > 0);

  assert.ok(row50BF, 'Brute force n=50 row must exist');
  assert.equal(row50BF.status, 'did not finish');
  assert.ok(row50BF.reason && row50BF.reason.length > 0);

  assert.ok(row100HK, 'Held-Karp n=100 row must exist');
  assert.equal(row100HK.status, 'did not finish');
  assert.ok(row100HK.reason && row100HK.reason.length > 0);

  assert.ok(row100BF, 'Brute force n=100 row must exist');
  assert.equal(row100BF.status, 'did not finish');
  assert.ok(row100BF.reason && row100BF.reason.length > 0);

  // At n=5 and n=10, all 4 must be completed
  for (const n of [5, 10]) {
    for (const alg of ['Nearest neighbor', '2-opt', 'Held-Karp', 'Brute force']) {
      const row = resultsTable.find((r) => r.n === n && r.algorithm === alg);
      assert.ok(row, `${alg} n=${n} must exist`);
      assert.equal(row.status, 'completed', `${alg} at n=${n} should complete`);
      assert.ok(row.computeTimeMs >= 0);
      assert.ok(row.costKm > 0);
    }
  }

  // At n=50 and n=100, Nearest Neighbor and 2-opt must be completed
  for (const n of [50, 100]) {
    for (const alg of ['Nearest neighbor', '2-opt']) {
      const row = resultsTable.find((r) => r.n === n && r.algorithm === alg);
      assert.ok(row, `${alg} n=${n} must exist`);
      assert.equal(row.status, 'completed', `${alg} at n=${n} should complete`);
      assert.ok(row.computeTimeMs >= 0);
      assert.ok(row.costKm > 0);
    }
  }
});
