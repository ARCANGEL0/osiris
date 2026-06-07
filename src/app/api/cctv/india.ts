import type { CctvCamera } from './types';

const INDIA_STATIC: CctvCamera[] = [
  { id: 'in-0', lat: 19.0760, lng: 72.8777, name: 'Mumbai - Marine Drive', city: 'Mumbai', country: 'India', stream_url: 'https://www.youtube.com/embed/MZn3kv7O01o?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-1', lat: 19.0178, lng: 72.8478, name: 'Mumbai - Bandra-Worli Sea Link', city: 'Mumbai', country: 'India', stream_url: 'https://www.youtube.com/embed/e0RNxhh62S8?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-2', lat: 18.9750, lng: 72.8258, name: 'Mumbai - CST / Chhatrapati Shivaji', city: 'Mumbai', country: 'India', stream_url: 'https://www.youtube.com/embed/8x5g1-VPsLk?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-3', lat: 28.6139, lng: 77.2090, name: 'Delhi - India Gate', city: 'Delhi', country: 'India', stream_url: 'https://www.youtube.com/embed/8vGPiilhF28?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-4', lat: 28.6304, lng: 77.2177, name: 'Delhi - Connaught Place', city: 'Delhi', country: 'India', stream_url: 'https://www.youtube.com/embed/iWqX3BFKvTk?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-5', lat: 28.5245, lng: 77.1855, name: 'Delhi - NH-48 Mahipalpur', city: 'Delhi', country: 'India', stream_url: 'https://www.youtube.com/embed/uYZVfaHHDmo?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-6', lat: 12.9716, lng: 77.5946, name: 'Bangalore - MG Road', city: 'Bangalore', country: 'India', stream_url: 'https://www.youtube.com/embed/O0SFKM9jj08?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-7', lat: 12.9766, lng: 77.5713, name: 'Bangalore - Cubbon Park', city: 'Bangalore', country: 'India', stream_url: 'https://www.youtube.com/embed/8d9t3pD9OYk?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-8', lat: 13.0827, lng: 80.2707, name: 'Chennai - Anna Salai', city: 'Chennai', country: 'India', stream_url: 'https://www.youtube.com/embed/dVMxQHn6uME?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-9', lat: 13.0604, lng: 80.2496, name: 'Chennai - Marina Beach', city: 'Chennai', country: 'India', stream_url: 'https://www.youtube.com/embed/zLBzDsKaA0U?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-10', lat: 17.3850, lng: 78.4867, name: 'Hyderabad - Hussain Sagar', city: 'Hyderabad', country: 'India', stream_url: 'https://www.youtube.com/embed/3D6y_kTqrE0?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-11', lat: 17.4065, lng: 78.4772, name: 'Hyderabad - Tankbund Road', city: 'Hyderabad', country: 'India', stream_url: 'https://www.youtube.com/embed/YNNwFRb3fdo?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-12', lat: 22.5726, lng: 88.3639, name: 'Kolkata - Howrah Bridge', city: 'Kolkata', country: 'India', stream_url: 'https://www.youtube.com/embed/5j5kMkDwOoY?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-13', lat: 22.5958, lng: 88.3500, name: 'Kolkata - Park Street', city: 'Kolkata', country: 'India', stream_url: 'https://www.youtube.com/embed/lBizGJc5_EY?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-14', lat: 26.9124, lng: 75.7873, name: 'Jaipur - Hawa Mahal', city: 'Jaipur', country: 'India', stream_url: 'https://www.youtube.com/embed/3VJZuV8JleQ?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-15', lat: 23.0225, lng: 72.5714, name: 'Ahmedabad - Sabarmati Riverfront', city: 'Ahmedabad', country: 'India', stream_url: 'https://www.youtube.com/embed/UU62YmJWNeE?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-16', lat: 18.5204, lng: 73.8567, name: 'Pune - Deccan Gymkhana', city: 'Pune', country: 'India', stream_url: 'https://www.youtube.com/embed/xNGrgUoVPP4?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-17', lat: 26.8467, lng: 80.9462, name: 'Lucknow - Hazratganj', city: 'Lucknow', country: 'India', stream_url: 'https://www.youtube.com/embed/M78T8ey4p0M?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-18', lat: 30.7333, lng: 76.7794, name: 'Chandigarh - Sector 17', city: 'Chandigarh', country: 'India', stream_url: 'https://www.youtube.com/embed/rqHtVqlxNLg?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
  { id: 'in-19', lat: 21.1458, lng: 79.0882, name: 'Nagpur - Sitabuldi', city: 'Nagpur', country: 'India', stream_url: 'https://www.youtube.com/embed/Uo4OKZm_bnI?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NHAI/Municipal' },
];

export async function fetchIndiaCameras(): Promise<CctvCamera[]> {
  return INDIA_STATIC;
}
