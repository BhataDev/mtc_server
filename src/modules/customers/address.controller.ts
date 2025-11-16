import { Request, Response } from 'express';
import { AddressService } from './address.service';

export class AddressController {
  /**
   * Get all saved addresses for the authenticated customer
   */
  static async getAddresses(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const addresses = await AddressService.getCustomerAddresses(customerId);
      
      res.json({
        success: true,
        data: addresses
      });
    } catch (error: any) {
      console.error('Get addresses error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get addresses'
      });
    }
  }

  /**
   * Save a new address
   */
  static async saveAddress(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const addressData = req.body;
      const savedAddress = await AddressService.saveAddress(customerId, addressData);
      
      res.json({
        success: true,
        message: 'Address saved successfully',
        data: savedAddress
      });
    } catch (error: any) {
      console.error('Save address error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to save address'
      });
    }
  }

  /**
   * Update an existing address
   */
  static async updateAddress(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user?.id;
      const { addressId } = req.params;
      
      if (!customerId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const addressData = req.body;
      const updatedAddress = await AddressService.updateAddress(customerId, addressId, addressData);
      
      res.json({
        success: true,
        message: 'Address updated successfully',
        data: updatedAddress
      });
    } catch (error: any) {
      console.error('Update address error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update address'
      });
    }
  }

  /**
   * Delete an address
   */
  static async deleteAddress(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user?.id;
      const { addressId } = req.params;
      
      if (!customerId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      await AddressService.deleteAddress(customerId, addressId);
      
      res.json({
        success: true,
        message: 'Address deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete address error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete address'
      });
    }
  }

  /**
   * Set an address as default
   */
  static async setDefaultAddress(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user?.id;
      const { addressId } = req.params;
      
      if (!customerId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      await AddressService.setDefaultAddress(customerId, addressId);
      
      res.json({
        success: true,
        message: 'Default address updated successfully'
      });
    } catch (error: any) {
      console.error('Set default address error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to set default address'
      });
    }
  }

  /**
   * Remove duplicate addresses for the authenticated customer
   */
  static async removeDuplicates(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      await AddressService.removeDuplicateAddresses(customerId);

      res.status(200).json({
        success: true,
        message: 'Duplicate addresses removed successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to remove duplicate addresses'
      });
    }
  }
}
