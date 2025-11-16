import axios from 'axios';

export interface LocationData {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  region?: string;
}

export class GeolocationService {
  /**
   * Get location coordinates from IP address using ip-api.com (free service)
   * @param ipAddress - The IP address to lookup
   * @returns Promise<LocationData | null>
   */
  static async getLocationFromIP(ipAddress: string): Promise<LocationData | null> {
    try {
      // Skip localhost/private IPs
      if (this.isPrivateIP(ipAddress)) {
        console.log(`🌍 Private IP detected (${ipAddress}), using default location`);
        
        // Check for development override location from environment
        const overrideLat = process.env.DEV_LOCATION_LAT;
        const overrideLon = process.env.DEV_LOCATION_LON;
        const overrideCity = process.env.DEV_LOCATION_CITY;
        
        if (overrideLat && overrideLon) {
          console.log(`🌍 Using development override location: ${overrideCity || 'Custom Location'}`);
          return {
            latitude: parseFloat(overrideLat),
            longitude: parseFloat(overrideLon),
            city: overrideCity || 'Development Location',
            country: 'Development',
            region: 'Development'
          };
        }
        
        // Default location (Riyadh, Saudi Arabia) for development
        return {
          latitude: 24.7136,
          longitude: 46.6753,
          city: 'Riyadh',
          country: 'Saudi Arabia',
          region: 'Riyadh Region'
        };
      }

      console.log(`🌍 Getting location for IP: ${ipAddress}`);
      
      // Use ip-api.com free service (no API key required)
      const response = await axios.get(`http://ip-api.com/json/${ipAddress}`, {
        timeout: 5000,
        params: {
          fields: 'status,message,country,regionName,city,lat,lon'
        }
      });

      const data = response.data;

      if (data.status === 'success') {
        const locationData: LocationData = {
          latitude: data.lat,
          longitude: data.lon,
          city: data.city,
          country: data.country,
          region: data.regionName
        };

        console.log(`✅ Location found:`, locationData);
        return locationData;
      } else {
        console.log(`❌ IP lookup failed: ${data.message}`);
        return null;
      }
    } catch (error) {
      console.error('🌍 Geolocation service error:', error);
      return null;
    }
  }

  /**
   * Alternative method using ipinfo.io (requires API key for production)
   * @param ipAddress - The IP address to lookup
   * @param apiKey - Optional API key for ipinfo.io
   * @returns Promise<LocationData | null>
   */
  static async getLocationFromIPInfo(ipAddress: string, apiKey?: string): Promise<LocationData | null> {
    try {
      if (this.isPrivateIP(ipAddress)) {
        return {
          latitude: 24.7136,
          longitude: 46.6753,
          city: 'Riyadh',
          country: 'Saudi Arabia',
          region: 'Riyadh Region'
        };
      }

      const url = apiKey 
        ? `https://ipinfo.io/${ipAddress}?token=${apiKey}`
        : `https://ipinfo.io/${ipAddress}`;

      const response = await axios.get(url, { timeout: 5000 });
      const data = response.data;

      if (data.loc) {
        const [lat, lon] = data.loc.split(',').map(Number);
        return {
          latitude: lat,
          longitude: lon,
          city: data.city,
          country: data.country,
          region: data.region
        };
      }

      return null;
    } catch (error) {
      console.error('🌍 IPInfo service error:', error);
      return null;
    }
  }

  /**
   * Check if IP address is private/local
   * @param ip - IP address to check
   * @returns boolean
   */
  private static isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^127\./, // 127.0.0.0/8 (localhost)
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^::1$/, // IPv6 localhost
      /^fc00:/, // IPv6 private
      /^fe80:/ // IPv6 link-local
    ];

    return privateRanges.some(range => range.test(ip)) || ip === 'localhost';
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param lat1 - Latitude of first point
   * @param lon1 - Longitude of first point
   * @param lat2 - Latitude of second point
   * @param lon2 - Longitude of second point
   * @returns Distance in kilometers
   */
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
