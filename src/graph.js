import { MinHeap } from './heap.js';

/**
 * Calculate the Haversine distance between two points in km
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Union-Find data structure for connected components
 */
class UnionFind {
  constructor(elements) {
    this.parent = new Map();
    for (const el of elements) {
      this.parent.set(el, el);
    }
  }

  find(i) {
    if (this.parent.get(i) === i) return i;
    const root = this.find(this.parent.get(i));
    this.parent.set(i, root);
    return root;
  }

  union(i, j) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent.set(rootI, rootJ);
      return true;
    }
    return false;
  }
}

/**
 * Build graph from locations:
 * - Each node connects to its 4 nearest neighbors (undirected).
 * - Ensures graph is fully connected by joining components with shortest missing edge.
 */
export function buildGraph(locations) {
  const locMap = new Map();
  for (const loc of locations) {
    locMap.set(loc.id, loc);
  }

  const adj = new Map();
  for (const loc of locations) {
    adj.set(loc.id, []);
  }

  const addEdge = (u, v, weight) => {
    if (!adj.get(u).some((e) => e.to === v)) {
      adj.get(u).push({ to: v, weight });
    }
    if (!adj.get(v).some((e) => e.to === u)) {
      adj.get(v).push({ to: u, weight });
    }
  };

  const locList = Array.from(locations);
  const n = locList.length;

  if (n <= 1) {
    return { locations: locMap, adj };
  }

  // 1. Connect each node to its 4 nearest neighbors (undirected)
  const kNearest = Math.min(4, n - 1);
  for (let i = 0; i < n; i++) {
    const u = locList[i];
    const distances = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const v = locList[j];
      const dist = haversine(u.lat, u.lng, v.lat, v.lng);
      distances.push({ id: v.id, dist });
    }
    distances.sort((a, b) => a.dist - b.dist);
    for (let k = 0; k < kNearest; k++) {
      addEdge(u.id, distances[k].id, distances[k].dist);
    }
  }

  // 2. Ensure graph is connected
  const uf = new UnionFind(locList.map((l) => l.id));
  for (const [u, edges] of adj.entries()) {
    for (const edge of edges) {
      uf.union(u, edge.to);
    }
  }

  // Find components
  const getComponentCount = () => {
    const roots = new Set();
    for (const loc of locList) {
      roots.add(uf.find(loc.id));
    }
    return roots.size;
  };

  while (getComponentCount() > 1) {
    let shortestDist = Infinity;
    let bestPair = null;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const u = locList[i].id;
        const v = locList[j].id;
        if (uf.find(u) !== uf.find(v)) {
          const dist = haversine(
            locList[i].lat,
            locList[i].lng,
            locList[j].lat,
            locList[j].lng
          );
          if (dist < shortestDist) {
            shortestDist = dist;
            bestPair = [u, v];
          }
        }
      }
    }

    if (bestPair) {
      const [u, v] = bestPair;
      addEdge(u, v, shortestDist);
      uf.union(u, v);
    } else {
      break;
    }
  }

  return { locations: locMap, adj };
}

/**
 * Dijkstra's shortest path algorithm using custom MinHeap
 */
export function dijkstra(graph, startId) {
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();

  for (const id of graph.locations.keys()) {
    dist.set(id, Infinity);
    prev.set(id, null);
  }
  dist.set(startId, 0);

  const heap = new MinHeap((a, b) => a.dist - b.dist);
  heap.insert({ id: startId, dist: 0 });

  while (!heap.isEmpty()) {
    const current = heap.extractMin();
    const u = current.id;

    if (visited.has(u)) continue;
    visited.add(u);

    const neighbors = graph.adj.get(u) || [];
    for (const edge of neighbors) {
      const v = edge.to;
      if (visited.has(v)) continue;

      const alt = dist.get(u) + edge.weight;
      if (alt < dist.get(v)) {
        dist.set(v, alt);
        prev.set(v, u);
        heap.insert({ id: v, dist: alt });
      }
    }
  }

  return { dist, prev };
}

/**
 * Reconstruct node path from Dijkstra prev map
 */
export function reconstructPath(prev, startId, targetId) {
  if (startId === targetId) return [startId];
  const path = [];
  let curr = targetId;
  while (curr !== null) {
    path.push(curr);
    if (curr === startId) break;
    curr = prev.get(curr);
  }
  if (path[path.length - 1] !== startId) {
    return []; // No path found
  }
  return path.reverse();
}

/**
 * Build distance matrix and polyline route paths for a list of stop IDs
 */
export function getRouteMatrixAndPaths(graph, stopIds) {
  const allDijkstra = new Map();
  for (const id of stopIds) {
    allDijkstra.set(id, dijkstra(graph, id));
  }

  const n = stopIds.length;
  const distMatrix = Array.from({ length: n }, () => new Float64Array(n));

  for (let i = 0; i < n; i++) {
    const u = stopIds[i];
    const { dist } = allDijkstra.get(u);
    for (let j = 0; j < n; j++) {
      const v = stopIds[j];
      distMatrix[i][j] = dist.get(v);
    }
  }

  const getPathBetween = (u, v) => {
    const { prev } = allDijkstra.get(u);
    return reconstructPath(prev, u, v);
  };

  return { distMatrix, allDijkstra, getPathBetween };
}
