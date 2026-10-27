export const CONFIG = {
  SPEED_KMH: 30, // 30 km/h constant speed
  SERVICE_TIME_MIN: 5, // 5 minutes per stop
  SHIFT_START_TIME: '09:00', // 9:00 AM shift start
  BENCHMARK_SEED: 12345, // mulberry32 fixed seed
  DELHI_BBOX: {
    minLat: 28.50,
    maxLat: 28.75,
    minLng: 77.05,
    maxLng: 77.35
  },
  LIMITS: {
    BRUTE_FORCE_MAX_STOPS: 10,
    HELD_KARP_MAX_STOPS: 15
  }
};
