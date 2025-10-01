import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

/**
 * Audit event types for invoice operations
 */
export enum AuditEventType {
  INVOICE_CREATED = 'invoice.created',
  INVOICE_UPDATED = 'invoice.updated',
  INVOICE_DELETED = 'invoice.deleted',
  INVOICE_SUBMITTED = 'invoice.submitted',
  INVOICE_APPROVED = 'invoice.approved',
  INVOICE_REJECTED = 'invoice.rejected',
  VERSION_CREATED = 'version.created',
  VERSION_RESTORED = 'version.restored',
  DIFF_GENERATED = 'diff.generated',
  STATUS_CHANGED = 'status.changed',
  ATTACHMENT_ADDED = 'attachment.added',
  ATTACHMENT_REMOVED = 'attachment.removed',
}

/**
 * Actor information for audit events
 */
interface AuditActor {
  id?: string;
  email: string;
  name?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit event metadata
 */
interface AuditMetadata {
  [key: string]: unknown;
}

/**
 * Audit event record
 */
interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  invoiceId: string;
  actor: AuditActor;
  metadata: AuditMetadata;
  timestamp: Date;
}

/**
 * Query options for audit logs
 */
interface AuditQueryOptions {
  invoiceId?: string;
  eventTypes?: AuditEventType[];
  actorEmail?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * AuditService: Comprehensive audit logging for invoice operations
 *
 * Responsibilities:
 * - Log all invoice state changes with actor information
 * - Track version creation, approval, and restoration events
 * - Record diff generation and change tracking operations
 * - Provide queryable audit trail for compliance and debugging
 * - Support filtering by invoice, actor, event type, and time range
 *
 * Note: This service uses structured logging (Pino) for audit events.
 * For compliance-critical applications, consider persisting to dedicated
 * audit table or external audit logging service (e.g., AWS CloudTrail).
 */
export class AuditService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log an audit event
   *
   * @param eventType - Type of audit event
   * @param invoiceId - Invoice ID
   * @param actor - User who performed the action
   * @param metadata - Additional event-specific data
   */
  async logEvent(
    eventType: AuditEventType,
    invoiceId: string,
    actor: AuditActor,
    metadata: AuditMetadata = {}
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      id: randomUUID(),
      eventType,
      invoiceId,
      actor,
      metadata,
      timestamp: new Date(),
    };

    // Log to structured logger (Pino)
    logger.info('Audit event', {
      audit: auditEvent,
      component: 'AuditService',
    });

    // Optional: Persist to dedicated audit table for long-term storage
    // await this.persistToAuditTable(auditEvent);
  }

  /**
   * Log invoice creation event
   */
  async logInvoiceCreated(invoiceId: string, actor: AuditActor, metadata: AuditMetadata = {}): Promise<void> {
    await this.logEvent(AuditEventType.INVOICE_CREATED, invoiceId, actor, {
      ...metadata,
      action: 'Invoice created',
    });
  }

  /**
   * Log invoice update event with change summary
   */
  async logInvoiceUpdated(
    invoiceId: string,
    actor: AuditActor,
    changeCount: number,
    changeSummary?: string
  ): Promise<void> {
    await this.logEvent(AuditEventType.INVOICE_UPDATED, invoiceId, actor, {
      changeCount,
      changeSummary,
      action: 'Invoice updated',
    });
  }

  /**
   * Log invoice deletion event
   */
  async logInvoiceDeleted(invoiceId: string, actor: AuditActor, reason?: string): Promise<void> {
    await this.logEvent(AuditEventType.INVOICE_DELETED, invoiceId, actor, {
      reason,
      action: 'Invoice deleted',
    });
  }

  /**
   * Log invoice submission event
   */
  async logInvoiceSubmitted(invoiceId: string, actor: AuditActor, submissionId: string): Promise<void> {
    await this.logEvent(AuditEventType.INVOICE_SUBMITTED, invoiceId, actor, {
      submissionId,
      action: 'Invoice submitted for approval',
    });
  }

  /**
   * Log invoice approval event
   */
  async logInvoiceApproved(
    invoiceId: string,
    actor: AuditActor,
    revisionNumber: number,
    attachmentUrl?: string
  ): Promise<void> {
    await this.logEvent(AuditEventType.INVOICE_APPROVED, invoiceId, actor, {
      revisionNumber,
      attachmentUrl,
      action: 'Invoice approved',
    });
  }

  /**
   * Log invoice rejection event
   */
  async logInvoiceRejected(invoiceId: string, actor: AuditActor, reason?: string): Promise<void> {
    await this.logEvent(AuditEventType.INVOICE_REJECTED, invoiceId, actor, {
      reason,
      action: 'Invoice rejected',
    });
  }

  /**
   * Log version creation event
   */
  async logVersionCreated(
    invoiceId: string,
    actor: AuditActor,
    revisionNumber: number,
    changeCount: number
  ): Promise<void> {
    await this.logEvent(AuditEventType.VERSION_CREATED, invoiceId, actor, {
      revisionNumber,
      changeCount,
      action: 'New version created',
    });
  }

  /**
   * Log version restoration event
   */
  async logVersionRestored(
    invoiceId: string,
    actor: AuditActor,
    restoredRevisionNumber: number
  ): Promise<void> {
    await this.logEvent(AuditEventType.VERSION_RESTORED, invoiceId, actor, {
      restoredRevisionNumber,
      action: 'Version restored',
    });
  }

  /**
   * Log diff generation event
   */
  async logDiffGenerated(
    invoiceId: string,
    actor: AuditActor,
    fromVersion: number,
    toVersion: number,
    changeCount: number
  ): Promise<void> {
    await this.logEvent(AuditEventType.DIFF_GENERATED, invoiceId, actor, {
      fromVersion,
      toVersion,
      changeCount,
      action: 'Diff generated',
    });
  }

  /**
   * Log status change event
   */
  async logStatusChanged(
    invoiceId: string,
    actor: AuditActor,
    fromStatus: string,
    toStatus: string
  ): Promise<void> {
    await this.logEvent(AuditEventType.STATUS_CHANGED, invoiceId, actor, {
      fromStatus,
      toStatus,
      action: `Status changed from ${fromStatus} to ${toStatus}`,
    });
  }

  /**
   * Log attachment added event
   */
  async logAttachmentAdded(
    invoiceId: string,
    actor: AuditActor,
    attachmentName: string,
    attachmentUrl: string
  ): Promise<void> {
    await this.logEvent(AuditEventType.ATTACHMENT_ADDED, invoiceId, actor, {
      attachmentName,
      attachmentUrl,
      action: 'Attachment added',
    });
  }

  /**
   * Log attachment removed event
   */
  async logAttachmentRemoved(
    invoiceId: string,
    actor: AuditActor,
    attachmentName: string
  ): Promise<void> {
    await this.logEvent(AuditEventType.ATTACHMENT_REMOVED, invoiceId, actor, {
      attachmentName,
      action: 'Attachment removed',
    });
  }

  /**
   * Query audit logs with filtering options
   *
   * Note: This queries structured logs. For production use,
   * consider persisting audit events to dedicated audit table
   * or external audit logging service for better queryability.
   *
   * @param options - Query options
   * @returns Array of audit events (from in-memory logs)
   */
  async queryAuditLogs(options: AuditQueryOptions = {}): Promise<AuditEvent[]> {
    // This is a placeholder implementation
    // In production, query from dedicated audit table or external service

    logger.info('Audit log query requested', {
      options,
      note: 'Consider implementing dedicated audit table for production queryability',
    });

    // Return empty array - implement actual query logic if persisting to audit table
    return [];
  }

  /**
   * Get audit trail for specific invoice
   *
   * @param invoiceId - Invoice ID
   * @param limit - Maximum number of events to return
   * @returns Audit events for the invoice
   */
  async getInvoiceAuditTrail(invoiceId: string, limit: number = 100): Promise<AuditEvent[]> {
    return await this.queryAuditLogs({
      invoiceId,
      limit,
    });
  }

  /**
   * Get audit events by actor
   *
   * @param actorEmail - Actor email
   * @param limit - Maximum number of events to return
   * @returns Audit events performed by actor
   */
  async getActorAuditTrail(actorEmail: string, limit: number = 100): Promise<AuditEvent[]> {
    return await this.queryAuditLogs({
      actorEmail,
      limit,
    });
  }

  /**
   * Optional: Persist audit event to dedicated audit table
   *
   * For compliance-critical applications, uncomment and implement
   * this method to store audit events in a dedicated, append-only table.
   *
   * Example schema:
   * ```prisma
   * model AuditLog {
   *   id          String   @id
   *   eventType   String
   *   invoiceId   String
   *   actorId     String?
   *   actorEmail  String
   *   actorName   String?
   *   ipAddress   String?
   *   userAgent   String?
   *   metadata    Json
   *   timestamp   DateTime @default(now())
   *
   *   @@index([invoiceId, timestamp])
   *   @@index([actorEmail, timestamp])
   *   @@index([eventType, timestamp])
   * }
   * ```
   */
  // private async persistToAuditTable(event: AuditEvent): Promise<void> {
  //   await this.prisma.auditLog.create({
  //     data: {
  //       id: event.id,
  //       eventType: event.eventType,
  //       invoiceId: event.invoiceId,
  //       actorId: event.actor.id,
  //       actorEmail: event.actor.email,
  //       actorName: event.actor.name,
  //       ipAddress: event.actor.ipAddress,
  //       userAgent: event.actor.userAgent,
  //       metadata: event.metadata,
  //       timestamp: event.timestamp,
  //     },
  //   });
  // }
}

// Singleton instance factory
export const createAuditService = (prisma: PrismaClient): AuditService => {
  return new AuditService(prisma);
};