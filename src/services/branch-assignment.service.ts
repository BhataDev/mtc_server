import { Branch } from '../modules/branches/branch.model';
import { GeolocationService, LocationData } from './geolocation.service';
import mongoose from 'mongoose';

export interface BranchAssignmentResult {
  branch: any;
  distance: number;
  customerLocation: LocationData;
}

export class BranchAssignmentService {
  /**
   * Find the nearest branch to a customer's location based on IP address
   * @param ipAddress - Customer's IP address
   * @returns Promise<BranchAssignmentResult | null>
   */
  static async findNearestBranchByIP(ipAddress: string): Promise<BranchAssignmentResult | null> {
    try {
      console.log(`🏢 Finding nearest branch for IP: ${ipAddress}`);

      // Get customer location from IP
      const customerLocation = await GeolocationService.getLocationFromIP(ipAddress);
      if (!customerLocation) {
        console.log('❌ Could not determine customer location');
        return null;
      }

      console.log(`📍 Customer location:`, customerLocation);

      // Find nearest branch using MongoDB geospatial query
      let nearestBranch = await this.findNearestBranchByCoordinates(
        customerLocation.longitude,
        customerLocation.latitude
      );

      // Fallback to manual calculation if geospatial query fails
      if (!nearestBranch) {
        console.log('⚠️ Geospatial query failed, using manual calculation fallback');
        nearestBranch = await this.findNearestBranchManual(
          customerLocation.longitude,
          customerLocation.latitude
        );
      }

      if (!nearestBranch) {
        console.log('❌ No active branches found');
        return null;
      }

      // Calculate distance for logging
      const distance = GeolocationService.calculateDistance(
        customerLocation.latitude,
        customerLocation.longitude,
        nearestBranch.location.coordinates[1], // latitude
        nearestBranch.location.coordinates[0]  // longitude
      );

      console.log(`✅ Nearest branch found: ${nearestBranch.name} (${distance.toFixed(2)} km away)`);

      return {
        branch: nearestBranch,
        distance,
        customerLocation
      };
    } catch (error) {
      console.error('🏢 Branch assignment error:', error);
      return null;
    }
  }

  /**
   * Find nearest branch using coordinates with MongoDB geospatial query
   * @param longitude - Customer longitude
   * @param latitude - Customer latitude
   * @param maxDistanceKm - Maximum distance in kilometers (default: 100km)
   * @returns Promise<any | null>
   */
  static async findNearestBranchByCoordinates(
    longitude: number, 
    latitude: number, 
    maxDistanceKm: number = 100
  ): Promise<any | null> {
    try {
      // Use MongoDB's $near operator for geospatial queries
      const nearestBranch = await Branch.findOne({
        isActive: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: maxDistanceKm * 1000 // Convert km to meters
          }
        }
      }).select('-passwordHash');

      return nearestBranch;
    } catch (error) {
      console.error('🏢 Geospatial query error:', error);
      return null;
    }
  }

  /**
   * Get all branches within a certain radius of customer location
   * @param longitude - Customer longitude
   * @param latitude - Customer latitude
   * @param radiusKm - Radius in kilometers
   * @returns Promise<any[]>
   */
  static async getBranchesWithinRadius(
    longitude: number, 
    latitude: number, 
    radiusKm: number = 50
  ): Promise<any[]> {
    try {
      const branches = await Branch.find({
        isActive: true,
        location: {
          $geoWithin: {
            $centerSphere: [
              [longitude, latitude],
              radiusKm / 6371 // Convert km to radians (Earth radius = 6371 km)
            ]
          }
        }
      }).select('-passwordHash');

      return branches;
    } catch (error) {
      console.error('🏢 Radius query error:', error);
      return [];
    }
  }

  /**
   * Fallback method: Find nearest branch using manual distance calculation
   * (Used when geospatial queries fail)
   * @param longitude - Customer longitude
   * @param latitude - Customer latitude
   * @returns Promise<any | null>
   */
  static async findNearestBranchManual(longitude: number, latitude: number): Promise<any | null> {
    try {
      console.log('🔄 Using manual distance calculation fallback');

      const allBranches = await Branch.find({ isActive: true }).select('-passwordHash');
      
      if (allBranches.length === 0) {
        return null;
      }

      let nearestBranch = null;
      let minDistance = Infinity;

      for (const branch of allBranches) {
        const distance = GeolocationService.calculateDistance(
          latitude,
          longitude,
          branch.location.coordinates[1], // branch latitude
          branch.location.coordinates[0]  // branch longitude
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestBranch = branch;
        }
      }

      console.log(`✅ Manual calculation: Nearest branch is ${nearestBranch?.name} (${minDistance.toFixed(2)} km)`);
      return nearestBranch;
    } catch (error) {
      console.error('🏢 Manual calculation error:', error);
      return null;
    }
  }

  /**
   * Get branch assignment statistics
   * @returns Promise<any>
   */
  static async getBranchAssignmentStats(): Promise<any> {
    try {
      const stats = await Branch.aggregate([
        {
          $match: { isActive: true }
        },
        {
          $lookup: {
            from: 'orders',
            localField: '_id',
            foreignField: 'branch',
            as: 'orders'
          }
        },
        {
          $project: {
            name: 1,
            location: 1,
            orderCount: { $size: '$orders' },
            totalRevenue: {
              $sum: '$orders.total'
            }
          }
        },
        {
          $sort: { orderCount: -1 }
        }
      ]);

      return stats;
    } catch (error) {
      console.error('📊 Branch stats error:', error);
      return [];
    }
  }
}
