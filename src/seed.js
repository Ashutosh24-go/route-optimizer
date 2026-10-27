/**
 * Seed data for Delivery and Route Optimization System
 */

export function getSeedLocations() {
  return [
    { id: 0, name: 'Central Depot, Connaught Place, Delhi', lat: 28.6315, lng: 77.2167 },
    { id: 1, name: '12 Park Lane, Delhi', lat: 28.6920, lng: 77.2280 },
    { id: 2, name: '87 Civil Lines, Delhi', lat: 28.6750, lng: 77.2220 },
    { id: 3, name: '245 MG Road, Delhi', lat: 28.6250, lng: 77.2350 },
    { id: 4, name: '18 Lajpat Nagar, Delhi', lat: 28.5700, lng: 77.2450 },
    { id: 5, name: '73 Nehru Place, Delhi', lat: 28.5480, lng: 77.2520 },
    { id: 6, name: '201 Kalkaji, Delhi', lat: 28.5380, lng: 77.2600 },
    { id: 7, name: '56 Greater Kailash, Delhi', lat: 28.5400, lng: 77.2400 },
    { id: 8, name: '90 Defence Colony, Delhi', lat: 28.5720, lng: 77.2300 },
    { id: 9, name: '14 Hauz Khas, Delhi', lat: 28.5520, lng: 77.2050 },
    { id: 10, name: '33 Saket, Delhi', lat: 28.5240, lng: 77.2100 },
    { id: 11, name: '105 Malviya Nagar, Delhi', lat: 28.5300, lng: 77.2150 },
    { id: 12, name: '6 Green Park, Delhi', lat: 28.5600, lng: 77.2050 },
    { id: 13, name: '15 Karol Bagh, Delhi', lat: 28.6520, lng: 77.1900 },
    { id: 14, name: '42 Vasant Kunj, Delhi', lat: 28.5200, lng: 77.1550 },
    { id: 15, name: '88 Rajouri Garden, Delhi', lat: 28.6450, lng: 77.1200 }
  ];
}

export function seedDatabase({ orderStore, driverStore, statusManager, locationsMap }) {
  orderStore.reset();
  driverStore.reset();
  statusManager.reset();

  // Drivers
  const initialDrivers = [
    {
      id: 'DRV-1',
      name: 'Rohan Singh',
      capacityKg: 80,
      assignedOrders: [
        'ORD-101', 'ORD-102', 'ORD-103', 'ORD-104',
        'ORD-105', 'ORD-106', 'ORD-107', 'ORD-108',
        'ORD-109', 'ORD-110', 'ORD-111', 'ORD-112'
      ],
      load: 42.0 // Exact sum: 5.2+4.5+5.5+4.0+3.5+2.8+3.5+2.5+2.5+2.5+3.0+2.5 = 42.0 kg
    },
    {
      id: 'DRV-2',
      name: 'Priya Sharma',
      capacityKg: 60,
      assignedOrders: [],
      load: 0.0
    },
    {
      id: 'DRV-3',
      name: 'Amit Kumar',
      capacityKg: 50,
      assignedOrders: [],
      load: 0.0
    },
    {
      id: 'DRV-4',
      name: 'Neha Verma',
      capacityKg: 35,
      assignedOrders: [],
      load: 0.0
    }
  ];

  driverStore.setDrivers(initialDrivers);

  // 12 Orders for Rohan Singh (matching Stitch Route Planning view)
  const initialOrders = [
    {
      id: 'ORD-101',
      locationId: 1,
      weight: 5.2,
      priority: 'Low',
      deadline: '11:00 AM',
      status: 'Delivered',
      driverId: 'DRV-1',
      createdAt: 1000
    },
    {
      id: 'ORD-102',
      locationId: 2,
      weight: 4.5,
      priority: 'Normal',
      deadline: '11:30 AM',
      status: 'Delivered',
      driverId: 'DRV-1',
      createdAt: 1001
    },
    {
      id: 'ORD-103',
      locationId: 3,
      weight: 5.5,
      priority: 'Urgent',
      deadline: '4:30 PM',
      status: 'In transit',
      driverId: 'DRV-1',
      createdAt: 1002
    },
    {
      id: 'ORD-104',
      locationId: 4,
      weight: 4.0,
      priority: 'Normal',
      deadline: '1:00 PM',
      status: 'Assigned',
      driverId: 'DRV-1',
      createdAt: 1003
    },
    {
      id: 'ORD-105',
      locationId: 5,
      weight: 3.5,
      priority: 'Normal',
      deadline: '2:00 PM',
      status: 'Assigned',
      driverId: 'DRV-1',
      createdAt: 1004
    },
    {
      id: 'ORD-106',
      locationId: 6,
      weight: 2.8,
      priority: 'Low',
      deadline: '2:30 PM',
      status: 'Assigned',
      driverId: 'DRV-1',
      createdAt: 1005
    },
    {
      id: 'ORD-107',
      locationId: 7,
      weight: 3.5,
      priority: 'Urgent',
      deadline: '5:00 PM',
      status: 'Assigned',
      driverId: 'DRV-1',
      createdAt: 1006
    },
    {
      id: 'ORD-108',
      locationId: 8,
      weight: 2.5,
      priority: 'Normal',
      deadline: '5:30 PM',
      status: 'Assigned',
      driverId: 'DRV-1',
      createdAt: 1007
    },
    {
      id: 'ORD-109',
      locationId: 9,
      weight: 2.5,
      priority: 'Normal',
      deadline: '6:00 PM',
      status: 'Assigned',
      driverId: 'DRV-1',
      createdAt: 1008
    },
    {
      id: 'ORD-110',
      locationId: 10,
      weight: 2.5,
      priority: 'Low',
      deadline: '6:30 PM',
      status: 'Assigned',
      driverId: 'DRV-1',
      createdAt: 1009
    },
    {
      id: 'ORD-111',
      locationId: 11,
      weight: 3.0,
      priority: 'Normal',
      deadline: '7:00 PM',
      status: 'Assigned',
      driverId: 'DRV-1',
      createdAt: 1010
    },
    {
      id: 'ORD-112',
      locationId: 12,
      weight: 2.5,
      priority: 'Normal',
      deadline: '7:30 PM',
      status: 'Assigned',
      driverId: 'DRV-1',
      createdAt: 1011
    },

    // Additional Pending orders for Priority Queue and Assignment testing
    {
      id: 'ORD-113',
      locationId: 13,
      weight: 12.0,
      priority: 'Urgent',
      deadline: '12:00 PM',
      status: 'Pending',
      driverId: null,
      createdAt: 1012
    },
    {
      id: 'ORD-114',
      locationId: 14,
      weight: 8.5,
      priority: 'Normal',
      deadline: '1:30 PM',
      status: 'Pending',
      driverId: null,
      createdAt: 1013
    },
    {
      id: 'ORD-115',
      locationId: 15,
      weight: 6.0,
      priority: 'Low',
      deadline: '3:00 PM',
      status: 'Pending',
      driverId: null,
      createdAt: 1014
    },
    {
      id: 'ORD-116',
      locationId: 3,
      weight: 95.0, // Exceeds any driver's total capacity for testing assignment failure reason!
      priority: 'Urgent',
      deadline: '4:00 PM',
      status: 'Pending',
      driverId: null,
      createdAt: 1015
    }
  ];

  for (const ord of initialOrders) {
    orderStore.addOrder(ord, locationsMap);
  }

  // Pre-seed status change logs for initial transitions
  const now = Date.now();
  statusManager.changeLog.push(
    { orderId: 'ORD-101', from: 'Pending', to: 'Assigned', time: new Date(now - 3600000).toISOString() },
    { orderId: 'ORD-101', from: 'Assigned', to: 'In transit', time: new Date(now - 2400000).toISOString() },
    { orderId: 'ORD-101', from: 'In transit', to: 'Delivered', time: new Date(now - 1200000).toISOString() },

    { orderId: 'ORD-102', from: 'Pending', to: 'Assigned', time: new Date(now - 3600000).toISOString() },
    { orderId: 'ORD-102', from: 'Assigned', to: 'In transit', time: new Date(now - 2400000).toISOString() },
    { orderId: 'ORD-102', from: 'In transit', to: 'Delivered', time: new Date(now - 1200000).toISOString() },

    { orderId: 'ORD-103', from: 'Pending', to: 'Assigned', time: new Date(now - 2400000).toISOString() },
    { orderId: 'ORD-103', from: 'Assigned', to: 'In transit', time: new Date(now - 1200000).toISOString() }
  );

  // Verify driver load strictly equals assigned orders
  driverStore.getDrivers(orderStore);
}
