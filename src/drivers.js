/**
 * Driver Store and Capacity Assignment Rule
 */
export class DriverStore {
  constructor() {
    this.drivers = [];
  }

  reset() {
    this.drivers = [];
  }

  setDrivers(driverList) {
    this.drivers = driverList.map((d) => ({
      id: d.id,
      name: d.name,
      capacityKg: d.capacityKg,
      assignedOrders: [...(d.assignedOrders || [])],
      load: d.load !== undefined ? d.load : 0
    }));
  }

  getDrivers(orderStore = null) {
    if (orderStore) {
      // Recalculate each driver's load to strictly guarantee:
      // "A driver's load always equals the sum of their assigned orders' weights."
      for (const driver of this.drivers) {
        let sum = 0;
        for (const ordId of driver.assignedOrders) {
          const ord = orderStore.getOrder(ordId);
          if (ord && ord.status !== 'Cancelled') {
            sum += ord.weight;
          }
        }
        driver.load = Math.round(sum * 10) / 10;
      }
    }
    return this.drivers.map((d) => ({ ...d, assignedOrders: [...d.assignedOrders] }));
  }

  getDriver(id, orderStore = null) {
    const driver = this.drivers.find((d) => d.id === id);
    if (!driver) return null;
    if (orderStore) {
      let sum = 0;
      for (const ordId of driver.assignedOrders) {
        const ord = orderStore.getOrder(ordId);
        if (ord && ord.status !== 'Cancelled') {
          sum += ord.weight;
        }
      }
      driver.load = Math.round(sum * 10) / 10;
    }
    return driver;
  }

  unassignOrder(driverId, orderId, orderStore = null) {
    const driver = this.drivers.find((d) => d.id === driverId);
    if (driver) {
      driver.assignedOrders = driver.assignedOrders.filter((id) => id !== orderId);
      if (orderStore) {
        let sum = 0;
        for (const ordId of driver.assignedOrders) {
          const ord = orderStore.getOrder(ordId);
          if (ord && ord.status !== 'Cancelled') {
            sum += ord.weight;
          }
        }
        driver.load = Math.round(sum * 10) / 10;
      }
    }
  }

  /**
   * One simple rule, no method choice:
   * - Take pending orders in priority-queue order (Urgent first, then earliest deadline).
   * - Give each order to the first driver, in driver list order, whose remaining capacity is >= order's weight.
   * - If no driver has room, leave order Pending and report it with reason ("No driver has 12.5 kg free").
   * - Never exceed capacity. Load always equals sum of assigned weights.
   */
  assignOrders(orderStore, statusManager) {
    const pendingOrders = orderStore.getPendingOrdersInQueueOrder();
    const assigned = [];
    const pending = [];

    // Ensure driver loads are synced before assignment
    this.getDrivers(orderStore);

    for (const order of pendingOrders) {
      let matchedDriver = null;
      for (const driver of this.drivers) {
        const remainingCapacity = Math.round((driver.capacityKg - driver.load) * 10) / 10;
        if (remainingCapacity >= order.weight) {
          matchedDriver = driver;
          break;
        }
      }

      if (matchedDriver) {
        matchedDriver.assignedOrders.push(order.id);
        matchedDriver.load = Math.round((matchedDriver.load + order.weight) * 10) / 10;
        order.driverId = matchedDriver.id;
        statusManager.recordTransition(order, 'Assigned');
        assigned.push({
          orderId: order.id,
          driverId: matchedDriver.id,
          driverName: matchedDriver.name,
          weight: order.weight,
          remainingCapacity: Math.round((matchedDriver.capacityKg - matchedDriver.load) * 10) / 10
        });
      } else {
        pending.push({
          orderId: order.id,
          weight: order.weight,
          reason: `No driver has ${order.weight} kg free`
        });
      }
    }

    orderStore.rebuildQueue();
    return { assigned, pending };
  }

  assignSingleOrder(order, orderStore, statusManager) {
    this.getDrivers(orderStore);
    let matchedDriver = null;

    for (const driver of this.drivers) {
      const remainingCapacity = Math.round((driver.capacityKg - driver.load) * 10) / 10;
      if (remainingCapacity >= order.weight) {
        matchedDriver = driver;
        break;
      }
    }

    if (matchedDriver) {
      matchedDriver.assignedOrders.push(order.id);
      matchedDriver.load = Math.round((matchedDriver.load + order.weight) * 10) / 10;
      order.driverId = matchedDriver.id;
      statusManager.recordTransition(order, 'Assigned');
      orderStore.rebuildQueue();
      return {
        assigned: true,
        orderId: order.id,
        driverId: matchedDriver.id,
        driverName: matchedDriver.name,
        remainingCapacity: Math.round((matchedDriver.capacityKg - matchedDriver.load) * 10) / 10
      };
    } else {
      orderStore.rebuildQueue();
      return {
        assigned: false,
        orderId: order.id,
        weight: order.weight,
        reason: `No driver has ${order.weight} kg free`
      };
    }
  }
}
