import { AuditLog, IAuditLog } from './audit.model';
import mongoose from 'mongoose';
import { Request } from 'express';

interface CreateAuditOptions {
  actorUser: mongoose.Types.ObjectId | string;
  actorRole: 'admin' | 'branch' | 'customer';
  entity: IAuditLog['entity'];
  entityId: mongoose.Types.ObjectId | string;
  action: IAuditLog['action'];
  diff?: any;
  metadata?: any;
  req?: Request;
}

export class AuditService {
  static async create(options: CreateAuditOptions): Promise<IAuditLog> {
    const auditLog = new AuditLog({
      actorUser: options.actorUser,
      actorRole: options.actorRole,
      entity: options.entity,
      entityId: options.entityId as any,
      action: options.action,
      diff: options.diff || {},
      metadata: options.metadata || {},
      at: new Date(),
      ipAddress: options.req?.ip || options.req?.socket?.remoteAddress,
      userAgent: options.req?.headers['user-agent']
    });

    return auditLog.save();
  }

  static async getAuditLogs(filters: any) {
    const query: any = {};
    if (filters.entity) query.entity = filters.entity;
    if (filters.actorRole) query.actorRole = filters.actorRole;
    if (filters.actorUser) query.actorUser = filters.actorUser;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.after) query.at = { $gte: filters.after };

    return AuditLog.find(query)
      .populate('actorUser', 'username role')
      .sort({ at: -1 })
      .limit(filters.limit || 100);
  }

  static async getEntityHistory(entity: string, entityId: string) {
    return AuditLog.find({ entity, entityId })
      .populate('actorUser', 'username role')
      .sort({ at: -1 });
  }

  static calculateDiff(oldDoc: any, newDoc: any): any {
    const diff: any = {};
    const oldObj = oldDoc.toObject ? oldDoc.toObject() : oldDoc;
    const newObj = newDoc.toObject ? newDoc.toObject() : newDoc;

    for (const key in newObj) {
      if (key === '_id' || key === '__v' || key === 'createdAt' || key === 'updatedAt') {
        continue;
      }
      if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
        diff[key] = { old: oldObj[key], new: newObj[key] };
      }
    }
    return diff;
  }
}
