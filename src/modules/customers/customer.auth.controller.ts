import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { Customer } from './customer.model';
import { generateToken } from '../../utils/jwt';

const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const oauthClient = new OAuth2Client(googleClientId);

export class CustomerAuthController {
  static async signup(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { name, email, password } = req.body as { name: string; email: string; password: string };

      const existing = await Customer.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({
          ok: false,
          error: { code: 'EMAIL_IN_USE', message: 'Email already in use' },
        });
      }

      const customer = new Customer({ name, email: email.toLowerCase(), passwordHash: password });
      await customer.save();

      const token = generateToken({ id: customer.id, username: customer.email, role: 'customer' });

      return res.json({
        ok: true,
        data: {
          token,
          user: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            role: 'customer' as const,
            avatarUrl: customer.avatarUrl ?? null,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const customer = await Customer.findOne({ email: email.toLowerCase(), isActive: true });
      if (!customer || !customer.passwordHash) {
        return res.status(401).json({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
      }

      const valid = await customer.comparePassword(password);
      if (!valid) {
        return res.status(401).json({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
      }

      const token = generateToken({ id: customer.id, username: customer.email, role: 'customer' });
      return res.json({
        ok: true,
        data: {
          token,
          user: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            role: 'customer' as const,
            avatarUrl: customer.avatarUrl ?? null,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async google(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { idToken } = req.body as { idToken: string };

      if (!idToken) {
        return res.status(400).json({ ok: false, error: { code: 'MISSING_TOKEN', message: 'Google ID token is required' } });
      }

      if (!googleClientId) {
        console.error('Google Client ID not configured. Check GOOGLE_CLIENT_ID environment variable.');
        return res.status(500).json({ ok: false, error: { code: 'GOOGLE_CONFIG_MISSING', message: 'Google client not configured' } });
      }

      console.log('Verifying Google ID token...');
      const ticket = await oauthClient.verifyIdToken({ idToken, audience: googleClientId });
      const payload = ticket.getPayload();
      
      if (!payload || !payload.email) {
        console.error('Invalid Google token payload:', payload);
        return res.status(401).json({ ok: false, error: { code: 'GOOGLE_AUTH_FAILED', message: 'Failed to verify Google token' } });
      }

      const email = payload.email.toLowerCase();
      const googleId = payload.sub || undefined;
      const name = payload.name || email.split('@')[0];
      const avatarUrl = payload.picture || null;

      let customer = await Customer.findOne({ email });
      if (!customer) {
        customer = new Customer({ name, email, googleId, avatarUrl, passwordHash: null });
        await customer.save();
      } else {
        // Update googleId / avatar if missing
        let needsSave = false;
        if (!customer.googleId && googleId) {
          customer.googleId = googleId;
          needsSave = true;
        }
        if (!customer.avatarUrl && avatarUrl) {
          customer.avatarUrl = avatarUrl;
          needsSave = true;
        }
        if (needsSave) await customer.save();
      }

      const token = generateToken({ id: customer.id, username: customer.email, role: 'customer' });
      return res.json({
        ok: true,
        data: {
          token,
          user: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            role: 'customer' as const,
            avatarUrl: customer.avatarUrl ?? null,
          },
        },
      });
    } catch (err) {
      console.error('Google OAuth error:', err);
      if (err instanceof Error) {
        return res.status(500).json({ 
          ok: false, 
          error: { 
            code: 'GOOGLE_AUTH_ERROR', 
            message: 'Google authentication failed',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
          } 
        });
      }
      next(err);
    }
  }

  static async me(req: Request, res: Response): Promise<any> {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }
    const customer = await Customer.findById(req.user.id);
    return res.json({
      ok: true,
      data: {
        id: customer?.id,
        name: customer?.name,
        email: customer?.email,
        role: 'customer' as const,
        avatarUrl: customer?.avatarUrl ?? null,
      },
    });
  }
}
