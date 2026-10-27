import { CONFIG } from './config.js';
import { parseDeadlineToMinutes } from './orders.js';
import { dijkstra, reconstructPath } from './graph.js';

/**
 * Format minutes from midnight to "h:mm A" string (e.g. 11:30 AM)
 */
export function formatMinutesToTime(totalMinutes) {
  let mins = Math.round(totalMinutes) % (24 * 60);
  let hours = Math.floor(mins / 60);
  const m = mins % 60;
  const meridian = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  const padM = m < 10 ? '0' + m : m;
  return `${hours}:${padM} ${meridian}`;
}

/**
 * Compute total distance for a tour [0, s1, s2, ..., sn, 0] given distMatrix
 */
export function computeTourDistance(tour, distMatrix) {
  let dist = 0;
  for (let i = 0; i < tour.length - 1; i++) {
    dist += distMatrix[tour[i]][tour[i + 1]];
  }
  return dist;
}

/**
 * Nearest Neighbor TSP (Greedy O(n^2), any size)
 */
export function solveNearestNeighbor(distMatrix) {
  const n = distMatrix.length - 1; // Number of stops excluding depot
  if (n === 0) return { tour: [0, 0], distance: 0 };
  if (n === 1) {
    const cost = distMatrix[0][1] + distMatrix[1][0];
    return { tour: [0, 1, 0], distance: cost };
  }

  const visited = new Set();
  const tour = [0];
  let curr = 0;

  for (let step = 0; step < n; step++) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (let candidate = 1; candidate <= n; candidate++) {
      if (!visited.has(candidate)) {
        const d = distMatrix[curr][candidate];
        if (d < nearestDist) {
          nearestDist = d;
          nearest = candidate;
        }
      }
    }
    visited.add(nearest);
    tour.push(nearest);
    curr = nearest;
  }

  tour.push(0); // Return to depot
  const distance = computeTourDistance(tour, distMatrix);
  return { tour, distance };
}

/**
 * 2-opt TSP (Start from Nearest Neighbor tour, iterative 2-opt swaps until local optimum)
 */
export function solve2Opt(distMatrix) {
  const n = distMatrix.length - 1;
  if (n <= 2) {
    return solveNearestNeighbor(distMatrix);
  }

  const nnResult = solveNearestNeighbor(distMatrix);
  let tour = [...nnResult.tour];
  let improved = true;

  while (improved) {
    improved = false;
    // tour indices 1 to n correspond to delivery stops; 0 and n+1 are depot
    for (let i = 1; i < n; i++) {
      for (let j = i + 1; j <= n; j++) {
        const u1 = tour[i - 1];
        const v1 = tour[i];
        const u2 = tour[j];
        const v2 = tour[j + 1];

        const oldDist = distMatrix[u1][v1] + distMatrix[u2][v2];
        const newDist = distMatrix[u1][u2] + distMatrix[v1][v2];

        if (newDist < oldDist - 1e-9) {
          // Reverse segment between i and j
          let left = i;
          let right = j;
          while (left < right) {
            const temp = tour[left];
            tour[left] = tour[right];
            tour[right] = temp;
            left++;
            right--;
          }
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  const distance = computeTourDistance(tour, distMatrix);
  return { tour, distance };
}

/**
 * Brute Force TSP (All permutations, allowed up to 10 stops)
 */
export function solveBruteForce(distMatrix) {
  const n = distMatrix.length - 1;
  if (n > CONFIG.LIMITS.BRUTE_FORCE_MAX_STOPS) {
    const err = new Error(
      `Brute force supports at most ${CONFIG.LIMITS.BRUTE_FORCE_MAX_STOPS} stops`
    );
    err.status = 400;
    throw err;
  }

  if (n === 0) return { tour: [0, 0], distance: 0 };
  if (n === 1) {
    const cost = distMatrix[0][1] + distMatrix[1][0];
    return { tour: [0, 1, 0], distance: cost };
  }

  const stops = Array.from({ length: n }, (_, i) => i + 1);
  let bestCost = Infinity;
  let bestTour = [];

  function permute(k) {
    if (k === 1) {
      let cost = distMatrix[0][stops[0]];
      for (let i = 0; i < n - 1; i++) {
        cost += distMatrix[stops[i]][stops[i + 1]];
      }
      cost += distMatrix[stops[n - 1]][0];

      if (cost < bestCost) {
        bestCost = cost;
        bestTour = [0, ...stops, 0];
      }
      return;
    }

    for (let i = 0; i < k; i++) {
      permute(k - 1);
      const swapIdx = k % 2 === 1 ? 0 : i;
      const tmp = stops[swapIdx];
      stops[swapIdx] = stops[k - 1];
      stops[k - 1] = tmp;
    }
  }

  permute(n);
  return { tour: bestTour, distance: bestCost };
}

/**
 * Held-Karp TSP (Dynamic Programming with Bitmask O(n^2 * 2^n), allowed up to 15 stops)
 * Uses typed arrays for memory efficiency
 */
export function solveHeldKarp(distMatrix) {
  const n = distMatrix.length - 1;
  if (n > CONFIG.LIMITS.HELD_KARP_MAX_STOPS) {
    const err = new Error(
      `Held-Karp supports at most ${CONFIG.LIMITS.HELD_KARP_MAX_STOPS} stops`
    );
    err.status = 400;
    throw err;
  }

  if (n === 0) return { tour: [0, 0], distance: 0 };
  if (n === 1) {
    const cost = distMatrix[0][1] + distMatrix[1][0];
    return { tour: [0, 1, 0], distance: cost };
  }

  const numMasks = 1 << n;
  const numStates = numMasks * n;
  const dp = new Float64Array(numStates).fill(Infinity);
  const parent = new Int8Array(numStates).fill(-1);

  // Base cases: mask with single stop i (0-indexed representing stop i+1)
  for (let i = 0; i < n; i++) {
    const mask = 1 << i;
    dp[mask * n + i] = distMatrix[0][i + 1];
  }

  // Iterate over all subsets of stops
  for (let mask = 1; mask < numMasks; mask++) {
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) === 0) continue;
      const currentCost = dp[mask * n + i];
      if (currentCost === Infinity) continue;

      // Extend to next unvisited stop j
      for (let j = 0; j < n; j++) {
        if ((mask & (1 << j)) !== 0) continue;
        const nextMask = mask | (1 << j);
        const nextCost = currentCost + distMatrix[i + 1][j + 1];
        const nextIdx = nextMask * n + j;

        if (nextCost < dp[nextIdx]) {
          dp[nextIdx] = nextCost;
          parent[nextIdx] = i;
        }
      }
    }
  }

  // Return to depot 0 from last stop
  const fullMask = numMasks - 1;
  let minCost = Infinity;
  let lastStop = -1;

  for (let i = 0; i < n; i++) {
    const totalCost = dp[fullMask * n + i] + distMatrix[i + 1][0];
    if (totalCost < minCost) {
      minCost = totalCost;
      lastStop = i;
    }
  }

  // Reconstruct optimal tour
  const stopsInOrder = [];
  let currMask = fullMask;
  let currStop = lastStop;

  while (currStop !== -1) {
    stopsInOrder.push(currStop + 1);
    const p = parent[currMask * n + currStop];
    currMask = currMask ^ (1 << currStop);
    currStop = p;
  }

  stopsInOrder.reverse();
  const tour = [0, ...stopsInOrder, 0];
  return { tour, distance: minCost };
}

/**
 * Plan a complete route for a given driver's assigned orders
 */
export function planRoute({
  algorithm = '2-opt',
  driver,
  orders,
  graph,
  locationsMap
}) {
  // Ordered stops array: index 0 is depot, indices 1..n are delivery stop orders
  const depotLoc = locationsMap.get(0);
  const deliveryOrders = [...orders];
  const n = deliveryOrders.length;

  // Build list of location IDs: [0, order1.locId, order2.locId, ...]
  const stopLocIds = [0, ...deliveryOrders.map((o) => o.locationId)];

  // Compute distance matrix using Dijkstra between all pairs
  const matrixSize = stopLocIds.length;
  const distMatrix = Array.from({ length: matrixSize }, () =>
    new Float64Array(matrixSize)
  );

  // Cache Dijkstra results for path reconstruction
  const dijkstraCache = new Map();
  for (let i = 0; i < matrixSize; i++) {
    const locId = stopLocIds[i];
    if (!dijkstraCache.has(locId)) {
      const { dist, prev } = dijkstra(graph, locId);
      dijkstraCache.set(locId, { dist, prev });
    }
  }

  for (let i = 0; i < matrixSize; i++) {
    const uLoc = stopLocIds[i];
    const { dist } = dijkstraCache.get(uLoc);
    for (let j = 0; j < matrixSize; j++) {
      const vLoc = stopLocIds[j];
      distMatrix[i][j] = dist.get(vLoc);
    }
  }

  // Validate algorithm and limits
  const algKey = algorithm.toLowerCase().replace(/[-_\s]/g, '');
  let solverFn;
  let canonicalName;

  if (algKey === 'nearestneighbor') {
    solverFn = solveNearestNeighbor;
    canonicalName = 'Nearest neighbor';
  } else if (algKey === '2opt' || algKey === 'twoopt') {
    solverFn = solve2Opt;
    canonicalName = '2-opt';
  } else if (algKey === 'heldkarp') {
    if (n > CONFIG.LIMITS.HELD_KARP_MAX_STOPS) {
      const err = new Error(
        `Held-Karp supports at most ${CONFIG.LIMITS.HELD_KARP_MAX_STOPS} stops`
      );
      err.status = 400;
      throw err;
    }
    solverFn = solveHeldKarp;
    canonicalName = 'Held-Karp';
  } else if (algKey === 'bruteforce') {
    if (n > CONFIG.LIMITS.BRUTE_FORCE_MAX_STOPS) {
      const err = new Error(
        `Brute force supports at most ${CONFIG.LIMITS.BRUTE_FORCE_MAX_STOPS} stops`
      );
      err.status = 400;
      throw err;
    }
    solverFn = solveBruteForce;
    canonicalName = 'Brute force';
  } else {
    const err = new Error(`Unknown algorithm: ${algorithm}`);
    err.status = 400;
    throw err;
  }

  // Measure performance
  const t0 = performance.now();
  const solverResult = solverFn(distMatrix);
  const t1 = performance.now();
  const computeTimeMs = Math.round((t1 - t0) * 100) / 100;

  // Run Nearest Neighbor baseline for comparison
  const tNN0 = performance.now();
  const nnResult = solveNearestNeighbor(distMatrix);
  const tNN1 = performance.now();

  const totalDistance = Math.round(solverResult.distance * 10) / 10;
  const nnDistance = Math.round(nnResult.distance * 10) / 10;
  const diffKm = Math.round((nnDistance - totalDistance) * 10) / 10;

  let comparisonText = '';
  if (canonicalName === 'Nearest neighbor') {
    comparisonText = `Nearest neighbor found ${totalDistance.toFixed(
      1
    )} km in ${Math.round(computeTimeMs)} ms.`;
  } else if (diffKm >= 0) {
    comparisonText = `${canonicalName} found ${totalDistance.toFixed(
      1
    )} km in ${Math.round(computeTimeMs)} ms. Nearest neighbor was ${nnDistance.toFixed(
      1
    )} km, so ${canonicalName} saves ${diffKm.toFixed(1)} km.`;
  } else {
    comparisonText = `${canonicalName} found ${totalDistance.toFixed(
      1
    )} km in ${Math.round(computeTimeMs)} ms. Nearest neighbor was ${nnDistance.toFixed(
      1
    )} km.`;
  }

  // Check if optimal is known (if exact solver was run)
  let gapFromOptimal = null;
  if (canonicalName === 'Held-Karp' || canonicalName === 'Brute force') {
    gapFromOptimal = 0;
  } else if (n <= CONFIG.LIMITS.HELD_KARP_MAX_STOPS) {
    // We can evaluate exact optimal using Held-Karp
    const exact = solveHeldKarp(distMatrix);
    if (exact.distance > 0) {
      gapFromOptimal =
        Math.round(
          ((solverResult.distance - exact.distance) / exact.distance) * 10000
        ) / 100;
    }
  }

  // Calculate planned arrival times and lateness
  // Start at SHIFT_START_TIME e.g. 09:00 (540 mins)
  const shiftStartMins = parseDeadlineToMinutes(CONFIG.SHIFT_START_TIME);
  let currentMinutes = shiftStartMins;

  // Build the visited stops in sequence (excluding starting depot, but tracking indices)
  const visitedStops = [];
  const tour = solverResult.tour; // [0, s1, s2, ..., sn, 0]

  for (let k = 1; k < tour.length - 1; k++) {
    const prevLocIdx = tour[k - 1];
    const currLocIdx = tour[k];
    const legDist = distMatrix[prevLocIdx][currLocIdx];

    // Travel time in minutes = (legDist / SPEED_KMH) * 60
    const travelTimeMins = (legDist / CONFIG.SPEED_KMH) * 60;
    currentMinutes += travelTimeMins;

    const order = deliveryOrders[currLocIdx - 1];
    const deadlineMins = parseDeadlineToMinutes(order.deadline);
    const plannedArrival = formatMinutesToTime(currentMinutes);
    const isLate = currentMinutes > deadlineMins;

    const loc = locationsMap.get(order.locationId);

    visitedStops.push({
      stopNumber: k,
      orderId: order.id,
      address: loc ? loc.name : `Location ${order.locationId}`,
      lat: loc ? loc.lat : 0,
      lng: loc ? loc.lng : 0,
      priority: order.priority,
      weight: order.weight,
      deadline: order.deadline,
      status: order.status,
      plannedArrival,
      plannedMinutes: Math.round(currentMinutes),
      deadlineMinutes: deadlineMins,
      isLate,
      legDistanceKm: Math.round(legDist * 10) / 10
    });

    // Add service time at this stop
    currentMinutes += CONFIG.SERVICE_TIME_MIN;
  }

  // Construct Dijkstra polyline path
  const polylineNodes = [];
  for (let k = 0; k < tour.length - 1; k++) {
    const uLocId = stopLocIds[tour[k]];
    const vLocId = stopLocIds[tour[k + 1]];
    const { prev } = dijkstraCache.get(uLocId);
    const nodePath = reconstructPath(prev, uLocId, vLocId);

    const startIndex = k === 0 ? 0 : 1;
    for (let p = startIndex; p < nodePath.length; p++) {
      const nId = nodePath[p];
      const loc = locationsMap.get(nId);
      if (loc) {
        polylineNodes.push({
          lat: loc.lat,
          lng: loc.lng,
          id: loc.id,
          name: loc.name
        });
      }
    }
  }

  return {
    algorithm: canonicalName,
    stopsCount: n,
    totalDistance,
    computeTimeMs,
    stops: visitedStops,
    polyline: polylineNodes,
    comparison: {
      nnDistance,
      diffKm,
      text: comparisonText
    },
    gapFromOptimal,
    depot: {
      id: depotLoc ? depotLoc.id : 0,
      name: depotLoc ? depotLoc.name : 'Central Depot',
      lat: depotLoc ? depotLoc.lat : 28.6315,
      lng: depotLoc ? depotLoc.lng : 77.2167
    }
  };
}
