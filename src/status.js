/**
 * Delivery status state machine and change log
 */

export const ALLOWED_TRANSITIONS = {
  Pending: ['Assigned', 'Cancelled'],
  Assigned: ['In transit', 'Cancelled'],
  'In transit': ['Delivered'],
  Delivered: [],
  Cancelled: []
};

export const NEXT_STATUS_MAP = {
  Pending: 'Assigned',
  Assigned: 'In transit',
  'In transit': 'Delivered'
};

export class StatusManager {
  constructor() {
    this.changeLog = [];
  }

  reset() {
    this.changeLog = [];
  }

  canTransition(currentStatus, targetStatus) {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    return allowed.includes(targetStatus);
  }

  recordTransition(order, targetStatus) {
    const fromStatus = order.status;
    if (!this.canTransition(fromStatus, targetStatus)) {
      const err = new Error(
        `Illegal transition from '${fromStatus}' to '${targetStatus}'. Allowed transitions from '${fromStatus}': ${
          ALLOWED_TRANSITIONS[fromStatus]?.length
            ? ALLOWED_TRANSITIONS[fromStatus].join(', ')
            : 'None'
        }`
      );
      err.status = 409;
      throw err;
    }

    order.status = targetStatus;
    const logEntry = {
      orderId: order.id,
      from: fromStatus,
      to: targetStatus,
      time: new Date().toISOString()
    };
    this.changeLog.push(logEntry);
    return logEntry;
  }

  cancelOrder(order, driverStore = null, orderStore = null) {
    if (order.status !== 'Pending' && order.status !== 'Assigned') {
      const err = new Error(
        `Cancel is allowed only from Pending or Assigned status. Current status is '${order.status}'`
      );
      err.status = 409;
      throw err;
    }

    if (order.status === 'Assigned' && order.driverId && driverStore) {
      driverStore.unassignOrder(order.driverId, order.id, orderStore);
      order.driverId = null;
    }

    const logEntry = this.recordTransition(order, 'Cancelled');
    if (orderStore) {
      orderStore.rebuildQueue();
    }
    return logEntry;
  }

  advanceOrder(order, driverStore = null, orderStore = null) {
    const currentStatus = order.status;
    if (currentStatus === 'Delivered') {
      const err = new Error('Order is already Delivered');
      err.status = 409;
      throw err;
    }
    if (currentStatus === 'Cancelled') {
      const err = new Error('Cannot advance a Cancelled order');
      err.status = 409;
      throw err;
    }

    const nextStatus = NEXT_STATUS_MAP[currentStatus];
    if (!nextStatus) {
      const err = new Error(`Cannot advance order with status '${currentStatus}'`);
      err.status = 409;
      throw err;
    }

    if (currentStatus === 'Pending' && !order.driverId && driverStore) {
      // Need driver assignment
      const assignResult = driverStore.assignSingleOrder(order, orderStore, this);
      if (!assignResult.assigned) {
        const err = new Error(
          `Cannot advance to Assigned: ${assignResult.reason}`
        );
        err.status = 409;
        throw err;
      }
      return { order, logEntry: this.changeLog[this.changeLog.length - 1] };
    }

    const logEntry = this.recordTransition(order, nextStatus);
    if (orderStore) {
      orderStore.rebuildQueue();
    }
    return { order, logEntry };
  }

  getStatusGrouped(orderStore) {
    const orders = orderStore.getAllOrders('deadline');
    const groups = {
      Pending: [],
      Assigned: [],
      'In transit': [],
      Delivered: [],
      Cancelled: []
    };

    for (const order of orders) {
      if (groups[order.status]) {
        groups[order.status].push(order);
      }
    }

    return {
      groups,
      changeLog: [...this.changeLog]
    };
  }
}
