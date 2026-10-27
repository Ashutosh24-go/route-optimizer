import { MinHeap } from './heap.js';

export function parseDeadlineToMinutes(str) {
  if (!str) return 0;
  const s = String(str).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[3] ? match[3].toUpperCase() : null;
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  return 0;
}

export function compareOrders(a, b) {
  const pMap = { Urgent: 0, Normal: 1, Low: 2 };
  const pA = pMap[a.priority] !== undefined ? pMap[a.priority] : 1;
  const pB = pMap[b.priority] !== undefined ? pMap[b.priority] : 1;
  if (pA !== pB) return pA - pB;

  const dA = parseDeadlineToMinutes(a.deadline);
  const dB = parseDeadlineToMinutes(b.deadline);
  if (dA !== dB) return dA - dB;

  const cA = a.createdAt || 0;
  const cB = b.createdAt || 0;
  return cA - cB;
}

export class OrderStore {
  constructor() {
    this.orders = new Map();
    this.queue = new MinHeap(compareOrders);
    this.creationCounter = 0;
  }

  reset() {
    this.orders.clear();
    this.queue = new MinHeap(compareOrders);
    this.creationCounter = 0;
  }

  addOrder(orderData, locationsMap) {
    // Field validations
    if (orderData.locationId === undefined || orderData.locationId === null) {
      throw new Error('Location ID is required');
    }
    const locId = Number(orderData.locationId);
    if (isNaN(locId) || !locationsMap.has(locId)) {
      throw new Error(`Invalid locationId: ${orderData.locationId}`);
    }

    const weight = Number(orderData.weight);
    if (isNaN(weight) || weight <= 0) {
      throw new Error('Weight must be a positive number');
    }

    const validPriorities = ['Urgent', 'Normal', 'Low'];
    if (!orderData.priority || !validPriorities.includes(orderData.priority)) {
      throw new Error('Priority must be Urgent, Normal, or Low');
    }

    if (!orderData.deadline || typeof orderData.deadline !== 'string') {
      throw new Error('Deadline string is required (e.g. 11:00 AM)');
    }
    if (
      !/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.test(orderData.deadline.trim())
    ) {
      throw new Error('Invalid deadline format (expected format like 11:00 AM or 14:00)');
    }

    this.creationCounter++;
    const id =
      orderData.id || `ORD-${String(100 + this.orders.size + 1)}`;

    const order = {
      id,
      locationId: locId,
      weight: Math.round(weight * 10) / 10,
      priority: orderData.priority,
      deadline: orderData.deadline.trim(),
      status: orderData.status || 'Pending',
      driverId: orderData.driverId || null,
      createdAt: orderData.createdAt || (Date.now() + this.creationCounter)
    };

    this.orders.set(id, order);

    // Only Pending and non-cancelled orders enter the priority queue
    if (order.status === 'Pending') {
      this.queue.insert(order);
    }

    return order;
  }

  getOrder(id) {
    return this.orders.get(id) || null;
  }

  getAllOrders(sortBy = 'deadline') {
    const list = Array.from(this.orders.values());
    if (sortBy === 'deadline') {
      list.sort(
        (a, b) =>
          parseDeadlineToMinutes(a.deadline) -
          parseDeadlineToMinutes(b.deadline)
      );
    } else if (sortBy === 'priority') {
      const pMap = { Urgent: 0, Normal: 1, Low: 2 };
      list.sort((a, b) => (pMap[a.priority] ?? 1) - (pMap[b.priority] ?? 1));
    } else if (sortBy === 'id') {
      list.sort((a, b) => a.id.localeCompare(b.id));
    }
    return list;
  }

  getPendingOrdersInQueueOrder() {
    // Sort all Pending orders according to priority queue comparator
    const pending = Array.from(this.orders.values()).filter(
      (o) => o.status === 'Pending'
    );
    pending.sort(compareOrders);
    return pending;
  }

  rebuildQueue() {
    const pending = Array.from(this.orders.values()).filter(
      (o) => o.status === 'Pending'
    );
    this.queue = new MinHeap(compareOrders);
    this.queue.rebuild(pending);
  }

  extractMinPending() {
    // Ensure queue has only actual Pending orders
    while (!this.queue.isEmpty()) {
      const candidate = this.queue.extractMin();
      const current = this.orders.get(candidate.id);
      if (current && current.status === 'Pending') {
        return current;
      }
    }
    return null;
  }

  peekQueue() {
    while (!this.queue.isEmpty()) {
      const candidate = this.queue.peek();
      const current = this.orders.get(candidate.id);
      if (current && current.status === 'Pending') {
        return current;
      }
      this.queue.extractMin(); // Pop stale non-pending order
    }
    return null;
  }

  getQueueSnapshot() {
    // Refresh queue from pending orders
    this.rebuildQueue();
    return {
      queue: this.queue.toArray(),
      nextOrder: this.peekQueue()
    };
  }
}
