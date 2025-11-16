import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../modules/audit/audit.service';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

// All audit routes require admin authentication
router.use(requireAuth, requireAdmin);

// Get audit logs with filters
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity, actorRole, actorUser, entityId, limit, after } = req.query;
    
    const logs = await AuditService.getAuditLogs({
      entity: entity as string,
      actorRole: actorRole as string,
      actorUser: actorUser as string,
      entityId: entityId as string,
      limit: limit ? parseInt(limit as string) : 100,
      after: after ? new Date(after as string) : undefined
    });

    res.json({
      ok: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

// Get audit history for specific entity
router.get('/:entity/:entityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity, entityId } = req.params;
    
    const history = await AuditService.getEntityHistory(entity, entityId);

    res.json({
      ok: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
});

export default router;
