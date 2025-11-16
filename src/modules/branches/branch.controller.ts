import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { Branch } from './branch.model';
import { User } from '../users/user.model';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { SocketService } from '../../sockets/socket.service';
import { SALT_ROUNDS } from '../../config/constants';
import { CreateBranchDto, UpdateBranchDto, ResetPasswordDto, UpdateStatusDto } from './branch.validation';

export class BranchController {
  static async getAllBranches(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, isActive } = req.query;
      const query: any = {};

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }

      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const branches = await Branch.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 });

      res.json({
        ok: true,
        data: branches
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const branch = await Branch.findById(id).select('-passwordHash');
      
      if (!branch) {
        throw new AppError('Branch not found', 404, 'NOT_FOUND');
      }

      res.json({
        ok: true,
        data: branch
      });
    } catch (error) {
      next(error);
    }
  }

  static async createBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateBranchDto = req.body;
      
      // Hash password
      const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

      // Create branch
      const branch = new Branch({
        name: data.name,
        username: data.username,
        passwordHash,
        phone: data.phone,
        countryCode: data.countryCode,
        phoneNumber: data.phoneNumber,
        addressText: data.addressText,
        location: {
          type: 'Point',
          coordinates: [data.location.coordinates[0], data.location.coordinates[1]] as [number, number]
        },
        createdBy: req.user!.id
      });

      await branch.save();

      // Also create a user entry for authentication
      const user = new User({
        username: data.username,
        passwordHash,
        role: 'branch',
        phone: data.phone,
        branch: branch._id,
        isActive: true
      });

      await user.save();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Branch',
        entityId: (branch as any)._id.toString(),
        action: 'create',
        metadata: { branchName: branch.name },
        req
      });

      // Broadcast to admins
      SocketService.broadcastToAdmins('branch.created', branch);

      // Remove password from response
      const branchResponse = branch.toJSON();

      res.status(201).json({
        ok: true,
        data: branchResponse
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: UpdateBranchDto = req.body;
      
      const branch = await Branch.findById(id);
      
      if (!branch) {
        throw new AppError('Branch not found', 404, 'NOT_FOUND');
      }

      const oldBranch = branch.toObject();

      // Update fields
      if (data.name) branch.name = data.name;
      if (data.phone) branch.phone = data.phone;
      if (data.countryCode) branch.countryCode = data.countryCode;
      if (data.phoneNumber) branch.phoneNumber = data.phoneNumber;
      if (data.addressText) branch.addressText = data.addressText;
      if (data.location) {
        branch.location = {
          type: 'Point',
          coordinates: [data.location.coordinates[0], data.location.coordinates[1]] as [number, number]
        };
      }
      
      // Update password if provided
      if (data.password) {
        const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
        branch.passwordHash = passwordHash;
        
        // Also update the associated user's password
        await User.findOneAndUpdate(
          { branch: branch._id },
          { passwordHash }
        );
      }
      
      branch.updatedBy = req.user!.id as any;
      await branch.save();

      // Update associated user if phone changed
      if (data.phone) {
        await User.findOneAndUpdate(
          { branch: branch._id },
          { phone: data.phone }
        );
      }

      // Create audit log
      const diff = AuditService.calculateDiff(oldBranch, branch);
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Branch',
        entityId: (branch as any)._id.toString(),
        action: 'update',
        diff,
        req
      });

      // Broadcast update
      SocketService.broadcastToAdmins('branch.updated', branch);
      SocketService.broadcastToBranch((branch as any)._id.toString(), 'branch.updated', branch);

      res.json({
        ok: true,
        data: branch.toJSON()
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetBranchPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { newPassword }: ResetPasswordDto = req.body;
      
      const branch = await Branch.findById(id);
      
      if (!branch) {
        throw new AppError('Branch not found', 404, 'NOT_FOUND');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      
      // Update branch password
      branch.passwordHash = passwordHash;
      branch.updatedBy = req.user!.id as any;
      await branch.save();

      // Update associated user password
      await User.findOneAndUpdate(
        { branch: branch._id },
        { passwordHash }
      );

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Branch',
        entityId: (branch as any)._id.toString(),
        action: 'update',
        metadata: { action: 'password_reset' },
        req
      });

      res.json({
        ok: true,
        data: {
          message: 'Password reset successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBranchStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { isActive }: UpdateStatusDto = req.body;
      
      const branch = await Branch.findById(id);
      
      if (!branch) {
        throw new AppError('Branch not found', 404, 'NOT_FOUND');
      }

      branch.isActive = isActive;
      branch.updatedBy = req.user!.id as any;
      await branch.save();

      // Update associated user status
      await User.findOneAndUpdate(
        { branch: branch._id },
        { isActive }
      );

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Branch',
        entityId: (branch as any)._id.toString(),
        action: 'update',
        metadata: { action: isActive ? 'activated' : 'deactivated' },
        req
      });

      // Broadcast update
      SocketService.broadcastToAdmins('branch.updated', branch);
      SocketService.broadcastToBranch((branch as any)._id.toString(), 'branch.updated', branch);

      res.json({
        ok: true,
        data: branch.toJSON()
      });
    } catch (error) {
      next(error);
    }
  }

  static async getNearestBranch(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        throw new AppError('Latitude and longitude are required', 400, 'INVALID_PARAMS');
      }

      const coordinates = [parseFloat(lng as string), parseFloat(lat as string)];

      const nearestBranch = await Branch.findOne({
        isActive: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates
            },
            $maxDistance: 50000 // 50km max distance
          }
        }
      }).select('-passwordHash');

      if (!nearestBranch) {
        return res.json({
          ok: true,
          data: null
        });
      }

      res.json({
        ok: true,
        data: nearestBranch
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const branch = await Branch.findById(id);
      
      if (!branch) {
        throw new AppError('Branch not found', 404, 'NOT_FOUND');
      }

      // Store branch data for audit log
      const branchData = branch.toObject();

      // Delete associated user first
      await User.findOneAndDelete({ branch: branch._id });

      // Delete the branch
      await Branch.findByIdAndDelete(id);

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Branch',
        entityId: id,
        action: 'delete',
        metadata: { deletedBranch: branchData },
        req
      });

      // Broadcast deletion
      SocketService.broadcastToAdmins('branch.deleted', { id, name: branchData.name });

      res.json({
        ok: true,
        data: {
          message: 'Branch deleted successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
