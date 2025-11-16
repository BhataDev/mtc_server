import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../modules/users/user.model';
import { Branch } from '../modules/branches/branch.model';
import { generateToken } from '../utils/jwt';
import { LoginDto } from './auth.validation';
import { AppError } from '../middlewares/error.middleware';
import { AuditService } from '../modules/audit/audit.service';

export class AuthController {
  static async adminLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password }: LoginDto = req.body;
      console.log(`🔍 Admin Login attempt - Username: ${username}, Password length: ${password?.length}`);

      // Only check User collection for admin login
      const user = await User.findOne({ username, isActive: true });
      
      if (!user) {
        console.log(`❌ No admin user found with username: ${username}`);
        throw new AppError('Invalid admin credentials', 401, 'INVALID_CREDENTIALS');
      }

      const isValidPassword = await user.comparePassword(password);
      console.log(`🔐 Admin password valid: ${isValidPassword}`);
      
      if (!isValidPassword) {
        throw new AppError('Invalid admin credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Generate JWT token
      const token = generateToken({
        id: (user._id as any).toString(),
        username: user.username,
        role: user.role,
        branchId: user.role === 'branch' && user.branch ? user.branch.toString() : undefined
      });

      // Create audit log
      await AuditService.create({
        actorUser: (user._id as any).toString(),
        actorRole: user.role,
        entity: 'User',
        entityId: (user._id as any).toString(),
        action: 'update',
        metadata: { action: 'admin_login' },
        req
      });

      res.json({
        ok: true,
        data: {
          token,
          user: {
            id: (user._id as any).toString(),
            username: user.username,
            role: user.role,
            branchId: user.role === 'branch' && user.branch ? user.branch.toString() : undefined
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async branchLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password }: LoginDto = req.body;
      console.log(`🔍 Branch Login attempt - Username: ${username}, Password length: ${password?.length}`);

      // Only check Branch collection for branch login
      const branch = await Branch.findOne({ username, isActive: true });
      
      if (!branch) {
        console.log(`❌ No branch found with username: ${username}`);
        throw new AppError('Invalid branch credentials', 401, 'INVALID_CREDENTIALS');
      }

      console.log(`🔐 Comparing password with hash: ${branch.passwordHash.substring(0, 20)}...`);
      console.log(`🔐 Password being compared: "${password}"`);
      console.log(`🔐 Hash length: ${branch.passwordHash.length}`);
      const isValidPassword = await bcrypt.compare(password, branch.passwordHash);
      console.log(`🔐 Branch password valid: ${isValidPassword}`);
      
      if (!isValidPassword) {
        throw new AppError('Invalid branch credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Create a user session for branch
      const user = {
        _id: branch._id,
        username: branch.username,
        role: 'branch'
      };

      // Generate JWT token
      const token = generateToken({
        id: (branch._id as any).toString(),
        username: branch.username,
        role: 'branch',
        branchId: (branch._id as any).toString()
      });

      // Create audit log
      await AuditService.create({
        actorUser: (branch._id as any).toString(),
        actorRole: 'branch',
        entity: 'Branch',
        entityId: (branch._id as any).toString(),
        action: 'update',
        metadata: { action: 'branch_login' },
        req
      });

      res.json({
        ok: true,
        data: {
          token,
          user: {
            id: (branch._id as any).toString(),
            username: branch.username,
            role: 'branch',
            branchId: (branch._id as any).toString()
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async fixBranchPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        res.status(400).json({
          ok: false,
          error: { message: 'Username and password required' }
        });
        return;
      }

      // Find the branch
      const branch = await Branch.findOne({ username });
      if (!branch) {
        res.status(404).json({
          ok: false,
          error: { message: 'Branch not found' }
        });
        return;
      }

      // Hash the new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(password, saltRounds);
      
      // Update branch password
      branch.passwordHash = newPasswordHash;
      await branch.save();
      
      // Also update the associated user password (if exists)
      const user = await User.findOne({ branch: branch._id });
      if (user) {
        user.passwordHash = newPasswordHash;
        await user.save();
      }

      res.json({
        ok: true,
        message: `Password updated for branch: ${username}`
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password }: LoginDto = req.body;
      console.log(`🔍 Login attempt - Username: ${username}, Password length: ${password?.length}`);

      // First, try to find in User collection (admin)
      let user: any = await User.findOne({ username, isActive: true });
      let role: 'admin' | 'branch' = 'admin';
      let branchId: string | undefined;

      console.log(`👤 User found in User collection: ${!!user}`);

      if (user) {
        // Found in User collection
        const isValidPassword = await user.comparePassword(password);
        console.log(`🔐 Admin password valid: ${isValidPassword}`);
        if (!isValidPassword) {
          throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
        }
        
        // If user is branch type, get branch ID
        if (user.role === 'branch' && user.branch) {
          branchId = user.branch.toString();
        }
        role = user.role;
      } else {
        // Try to find in Branch collection
        console.log(`🏢 Searching for branch with username: ${username}`);
        const branch = await Branch.findOne({ username, isActive: true });
        console.log(`🏢 Branch found: ${!!branch}`);
        
        if (!branch) {
          console.log(`❌ No branch found with username: ${username}`);
          throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
        }

        console.log(`🔐 Comparing password with hash: ${branch.passwordHash.substring(0, 20)}...`);
        const isValidPassword = await bcrypt.compare(password, branch.passwordHash);
        console.log(`🔐 Branch password valid: ${isValidPassword}`);
        if (!isValidPassword) {
          throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
        }

        // Create a user session for branch
        user = {
          _id: branch._id,
          username: branch.username,
          role: 'branch'
        } as any;
        role = 'branch';
        branchId = (branch as any)._id.toString();
      }

      // Generate JWT token
      const token = generateToken({
        id: user!._id.toString(),
        username: user!.username,
        role,
        branchId
      });

      // Create audit log
      await AuditService.create({
        actorUser: user!._id.toString(),
        actorRole: role,
        entity: 'User',
        entityId: user!._id.toString(),
        action: 'update',
        metadata: { action: 'login' },
        req
      });

      res.json({
        ok: true,
        data: {
          token,
          user: {
            id: user!._id.toString(),
            username: user!.username,
            role,
            branchId
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCurrentUser(req: Request, res: Response): Promise<any> {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated'
        }
      });
    }

    // Get full user details
    let userDetails;
    if (req.user.role === 'branch' && req.user.branchId) {
      userDetails = await Branch.findById(req.user.branchId).select('-passwordHash');
    } else {
      userDetails = await User.findById(req.user.id).select('-passwordHash');
    }

    res.json({
      ok: true,
      data: {
        ...req.user,
        details: userDetails
      }
    });
  }
}
