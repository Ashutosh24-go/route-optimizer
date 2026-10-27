import { CONFIG } from './config.js';
import { haversine, buildGraph, dijkstra } from './graph.js';
import {
  solveNearestNeighbor,
  solve2Opt,
  solveHeldKarp,
  solveBruteForce
} from './tsp.js';

/**
 * Seeded PRNG: mulberry32
 */
export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate random benchmark locations inside Delhi bounding box
 */
export function generateBenchmarkLocations(count, prng) {
  const { minLat, maxLat, minLng, maxLng } = CONFIG.DELHI_BBOX;
  const locations = [];

  // Depot is always index 0 at Central Delhi
  locations.push({
    id: 0,
    name: 'Depot (Benchmark Central)',
    lat: 28.6315,
    lng: 77.2167
  });

  for (let i = 1; i <= count; i++) {
    const lat = minLat + prng() * (maxLat - minLat);
    const lng = minLng + prng() * (maxLng - minLng);
    locations.push({
      id: i,
      name: `Benchmark Stop ${i}`,
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000
    });
  }

  return locations;
}

/**
 * Compute distance matrix for benchmark locations via Dijkstra on connected 4-NN graph
 */
export function getBenchmarkDistMatrix(locations) {
  const graph = buildGraph(locations);
  const n = locations.length;
  const distMatrix = Array.from({ length: n }, () => new Float64Array(n));

  for (let i = 0; i < n; i++) {
    const { dist } = dijkstra(graph, locations[i].id);
    for (let j = 0; j < n; j++) {
      distMatrix[i][j] = dist.get(locations[j].id);
    }
  }

  return distMatrix;
}

/**
 * Calculate median of array of numbers
 */
function getMedian(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Run comprehensive route comparison benchmark
 */
export function runBenchmark() {
  const sizes = [5, 10, 50, 100];
  const algorithms = [
    { name: 'Nearest neighbor', key: 'nearestNeighbor', limit: Infinity, solver: solveNearestNeighbor },
    { name: '2-opt', key: 'twoOpt', limit: Infinity, solver: solve2Opt },
    { name: 'Held-Karp', key: 'heldKarp', limit: CONFIG.LIMITS.HELD_KARP_MAX_STOPS, solver: solveHeldKarp },
    { name: 'Brute force', key: 'bruteForce', limit: CONFIG.LIMITS.BRUTE_FORCE_MAX_STOPS, solver: solveBruteForce }
  ];

  const resultsTable = [];
  const chartSeries = {
    computeTimeVsN: {},
    costVsN: {}
  };

  for (const alg of algorithms) {
    chartSeries.computeTimeVsN[alg.name] = [];
    chartSeries.costVsN[alg.name] = [];
  }

  // Pre-generate independent seeded instances for each size
  for (const n of sizes) {
    const prng = mulberry32(CONFIG.BENCHMARK_SEED + n * 100);
    const locations = generateBenchmarkLocations(n, prng);
    const distMatrix = getBenchmarkDistMatrix(locations);

    const sizeRow = {
      n,
      algorithms: {}
    };

    let optimalCost = null;

    // First, determine optimal cost if exact solver is allowed
    if (n <= CONFIG.LIMITS.HELD_KARP_MAX_STOPS) {
      const heldKarpResult = solveHeldKarp(distMatrix);
      optimalCost = heldKarpResult.distance;
    }

    for (const alg of algorithms) {
      if (n > alg.limit) {
        let reason = '';
        if (alg.key === 'heldKarp') {
          reason = `n = ${n} exceeds the ${CONFIG.LIMITS.HELD_KARP_MAX_STOPS}-stop limit; the state space is 2^${n}`;
        } else if (alg.key === 'bruteForce') {
          reason = `n = ${n} exceeds the ${CONFIG.LIMITS.BRUTE_FORCE_MAX_STOPS}-stop limit; ${n}! permutations`;
        }

        const entry = {
          algorithm: alg.name,
          n,
          status: 'did not finish',
          reason,
          costKm: null,
          computeTimeMs: null,
          gapFromOptimal: null
        };
        sizeRow.algorithms[alg.name] = entry;
        resultsTable.push(entry);
      } else {
        // Run 5 times and record median compute time
        const times = [];
        let lastResult = null;
        for (let r = 0; r < 5; r++) {
          const t0 = performance.now();
          lastResult = alg.solver(distMatrix);
          const t1 = performance.now();
          times.push(t1 - t0);
        }

        const medianTime = Math.round(getMedian(times) * 100) / 100;
        const costKm = Math.round(lastResult.distance * 10) / 10;

        let gap = null;
        if (optimalCost !== null && optimalCost > 0) {
          if (alg.key === 'heldKarp' || alg.key === 'bruteForce') {
            gap = 0.0;
          } else {
            gap =
              Math.round(
                ((lastResult.distance - optimalCost) / optimalCost) * 10000
              ) / 100;
          }
        }

        const entry = {
          algorithm: alg.name,
          n,
          status: 'completed',
          reason: null,
          costKm,
          computeTimeMs: medianTime,
          gapFromOptimal: gap
        };
        sizeRow.algorithms[alg.name] = entry;
        resultsTable.push(entry);

        chartSeries.computeTimeVsN[alg.name].push({ n, timeMs: medianTime });
        chartSeries.costVsN[alg.name].push({ n, costKm });
      }
    }
  }

  return {
    resultsTable,
    sizes,
    algorithms: algorithms.map((a) => a.name),
    chartSeries
  };
}

// Cached benchmark instance for immediate response
let benchmarkCache = null;

export function getCachedBenchmark() {
  if (!benchmarkCache) {
    benchmarkCache = runBenchmark();
  }
  return benchmarkCache;
}
