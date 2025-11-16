import { Customer, ISavedAddress } from './customer.model';
import mongoose from 'mongoose';

export class AddressService {
  /**
   * Get all saved addresses for a customer
   */
  static async getCustomerAddresses(customerId: string): Promise<ISavedAddress[]> {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }
      return customer.savedAddresses || [];
    } catch (error) {
      throw new Error(`Failed to get addresses: ${error}`);
    }
  }

  /**
   * Save a new address for a customer
   */
  static async saveAddress(customerId: string, addressData: Omit<ISavedAddress, '_id'>): Promise<ISavedAddress> {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Check for duplicate addresses
      if (customer.savedAddresses) {
        const isDuplicate = customer.savedAddresses.some(addr => 
          addr.firstName === addressData.firstName &&
          addr.lastName === addressData.lastName &&
          addr.phone === addressData.phone &&
          addr.address === addressData.address &&
          addr.district === addressData.district &&
          addr.buildingNumber === addressData.buildingNumber &&
          addr.vatRegistered === addressData.vatRegistered &&
          (addr.postalCode || '') === (addressData.postalCode || '') &&
          (addr.companyName || '') === (addressData.companyName || '')
        );

        if (isDuplicate) {
          throw new Error('This address already exists');
        }
      }

      // If this is set as default, unset other default addresses
      if (addressData.isDefault) {
        if (customer.savedAddresses) {
          customer.savedAddresses.forEach(addr => {
            addr.isDefault = false;
          });
        }
      }

      // Add new address
      const newAddress = {
        ...addressData,
        _id: new mongoose.Types.ObjectId().toString()
      };

      if (!customer.savedAddresses) {
        customer.savedAddresses = [];
      }

      customer.savedAddresses.push(newAddress);
      await customer.save();

      return newAddress;
    } catch (error) {
      throw new Error(`Failed to save address: ${error}`);
    }
  }

  /**
   * Update an existing address
   */
  static async updateAddress(customerId: string, addressId: string, addressData: Partial<ISavedAddress>): Promise<ISavedAddress> {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer || !customer.savedAddresses) {
        throw new Error('Customer or address not found');
      }

      const addressIndex = customer.savedAddresses.findIndex(addr => addr._id?.toString() === addressId);
      if (addressIndex === -1) {
        throw new Error('Address not found');
      }

      // If setting as default, unset other defaults
      if (addressData.isDefault) {
        customer.savedAddresses.forEach(addr => {
          addr.isDefault = false;
        });
      }

      // Update address
      customer.savedAddresses[addressIndex] = {
        ...customer.savedAddresses[addressIndex],
        ...addressData
      };

      await customer.save();
      return customer.savedAddresses[addressIndex];
    } catch (error) {
      throw new Error(`Failed to update address: ${error}`);
    }
  }

  /**
   * Delete an address
   */
  static async deleteAddress(customerId: string, addressId: string): Promise<void> {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer || !customer.savedAddresses) {
        throw new Error('Customer or address not found');
      }

      customer.savedAddresses = customer.savedAddresses.filter(addr => addr._id?.toString() !== addressId);
      await customer.save();
    } catch (error) {
      throw new Error(`Failed to delete address: ${error}`);
    }
  }

  /**
   * Set an address as default
   */
  static async setDefaultAddress(customerId: string, addressId: string): Promise<void> {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer || !customer.savedAddresses) {
        throw new Error('Customer or address not found');
      }

      // Unset all defaults
      customer.savedAddresses.forEach(addr => {
        addr.isDefault = false;
      });

      // Set new default
      const address = customer.savedAddresses.find(addr => addr._id?.toString() === addressId);
      if (!address) {
        throw new Error('Address not found');
      }

      address.isDefault = true;
      await customer.save();
    } catch (error) {
      throw new Error(`Failed to set default address: ${error}`);
    }
  }

  /**
   * Remove duplicate addresses for a customer
   */
  static async removeDuplicateAddresses(customerId: string): Promise<void> {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer || !customer.savedAddresses) {
        return;
      }

      const uniqueAddresses: ISavedAddress[] = [];
      const seenAddresses = new Set<string>();

      for (const address of customer.savedAddresses) {
        // Create a unique key for the address
        const addressKey = `${address.firstName}-${address.lastName}-${address.phone}-${address.address}-${address.district}-${address.buildingNumber}-${address.vatRegistered}-${address.postalCode || ''}-${address.companyName || ''}`;
        
        if (!seenAddresses.has(addressKey)) {
          seenAddresses.add(addressKey);
          uniqueAddresses.push(address);
        }
      }

      // Update customer with unique addresses only
      customer.savedAddresses = uniqueAddresses;
      await customer.save();
    } catch (error) {
      console.error('Error removing duplicate addresses:', error);
      throw error;
    }
  }
}
