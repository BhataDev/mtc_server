import { Request, Response, NextFunction } from 'express';
import { Settings } from './settings.model';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { SocketService } from '../../sockets/socket.service';

export class SettingsController {
  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await Settings.getInstance();
      
      res.json({
        ok: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { vatPercentage, shippingChargeSAR, freeShippingForOwnBrands } = req.body;
      
      // Get current settings
      const settings = await Settings.getInstance();
      const oldSettings = settings.toObject();

      // Update settings
      if (vatPercentage !== undefined) {
        settings.vatPercentage = vatPercentage;
      }
      if (shippingChargeSAR !== undefined) {
        settings.shippingChargeSAR = shippingChargeSAR;
      }
      if (freeShippingForOwnBrands !== undefined) {
        settings.freeShippingForOwnBrands = freeShippingForOwnBrands;
      }
      
      settings.updatedBy = req.user!.id as any;
      await settings.save();

      // Create audit log (temporarily disabled)
      // const diff = AuditService.calculateDiff(oldSettings, settings);
      // await AuditService.create({
      //   actorUser: req.user!.id,
      //   actorRole: req.user!.role,
      //   entity: 'Settings',
      //   entityId: settings._id,
      //   action: 'update',
      //   diff,
      //   req
      // });

      // Broadcast update to all connected clients
      SocketService.broadcastToAll('settings.updated', settings);

      res.json({
        ok: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }
}
