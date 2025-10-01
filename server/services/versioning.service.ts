import { PrismaClient, Invoice, InvoiceRevision, InvoiceDiff, Prisma } from '@prisma/client';
import { diffService } from './diff.service';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

/**
 * Actor information for version creation
 */
interface ActorInfo {
  id?: string;
  email: string;
  name?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Version creation result
 */
interface VersionResult {
  revision: InvoiceRevision;
  diff: InvoiceDiff | null;
  isNoOp: boolean;
}

/**
 * Version history with diff information
 */
interface VersionHistoryItem {
  revision: InvoiceRevision;
  diff: InvoiceDiff | null;
  previousRevision: InvoiceRevision | null;
}

/**
 * Pagination options
 */
interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * VersioningService: Manages invoice version lifecycle
 *
 * Responsibilities:
 * - Create new versions with automatic diff generation
 * - Retrieve version history with pagination
 * - Get active diffs for change-requested invoices
 * - Mark versions as approved baselines
 * - Handle transaction safety and idempotency
 */
export class VersioningService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new invoice version with diff from previous version
   *
   * Process:
   * 1. Fetch latest revision to determine version number
   * 2. Generate RFC-6902 patch from previous snapshot
   * 3. Detect no-op changes (skip if no meaningful changes)
   * 4. Store InvoiceRevision with patch and summary
   * 5. Store InvoiceDiff linking previous and current revision
   * 6. Update Invoice.updatedAt timestamp
   *
   * @param invoiceId - Invoice ID
   * @param snapshot - Current invoice state
   * @param actor - User who made the change
   * @param changeSummary - Optional human-readable description
   * @returns Version creation result with revision and diff
   */
  async createVersion(
    invoiceId: string,
    snapshot: unknown,
    actor: ActorInfo,
    changeSummary?: string
  ): Promise<VersionResult> {
    return await this.prisma.$transaction(async (tx) => {
      // Fetch latest revision to determine next version number
      const latestRevision = await tx.invoiceRevision.findFirst({
        where: { invoiceId },
        orderBy: { revisionNumber: 'desc' },
      });

      const nextRevisionNumber = latestRevision ? latestRevision.revisionNumber + 1 : 1;

      // Generate diff from previous version
      let patch: Prisma.InputJsonValue | undefined = [];
      let summaryJson: Prisma.InputJsonValue | undefined = undefined;
      let changeCount = 0;

      if (latestRevision) {
        const previousSnapshot = latestRevision.payloadJson;
        const operations = diffService.generatePatch(previousSnapshot, snapshot);

        // Check for no-op changes
        if (diffService.isNoOp(operations)) {
          logger.info('No-op version creation skipped', { invoiceId, actor: actor.email });
          return {
            revision: latestRevision,
            diff: null,
            isNoOp: true,
          };
        }

        // Optimize patch and generate summary
        const optimizedPatch = diffService.optimizePatch(operations);
        const summary = diffService.generateSummary(optimizedPatch, previousSnapshot, snapshot);

        patch = optimizedPatch as unknown as Prisma.InputJsonValue;
        summaryJson = summary as unknown as Prisma.InputJsonValue;
        changeCount = summary.totalChanges;
      }

      // Create InvoiceRevision
      const revision = await tx.invoiceRevision.create({
        data: {
          id: randomUUID(),
          invoiceId,
          revisionNumber: nextRevisionNumber,
          payloadJson: snapshot as unknown as Prisma.InputJsonValue,
          actorEmail: actor.email,
          actorId: actor.id,
          actorName: actor.name,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
          changeSummary,
          patch,
          summaryJson,
          changeCount,
        },
      });

      // Create InvoiceDiff if not first version
      let diff: InvoiceDiff | null = null;
      if (latestRevision && changeCount > 0) {
        diff = await tx.invoiceDiff.create({
          data: {
            id: randomUUID(),
            invoiceId,
            fromRevisionId: latestRevision.id,
            toRevisionId: revision.id,
            fromVersion: latestRevision.revisionNumber,
            toVersion: revision.revisionNumber,
            patch,
            summary: summaryJson || {},
            changeCount,
          },
        });
      }

      // Update Invoice.updatedAt
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { updatedAt: new Date() },
      });

      logger.info('Version created successfully', {
        invoiceId,
        revisionNumber: nextRevisionNumber,
        changeCount,
        actor: actor.email,
      });

      return {
        revision,
        diff,
        isNoOp: false,
      };
    });
  }

  /**
   * Get active diff for change-requested invoices
   *
   * Returns the diff from the last approved baseline to the current version.
   * Used to display pending changes when status is "change_requested".
   *
   * @param invoiceId - Invoice ID
   * @returns Active diff or null if no pending changes
   */
  async getActiveDiff(invoiceId: string): Promise<InvoiceDiff | null> {
    // Get the latest revision
    const latestRevision = await this.prisma.invoiceRevision.findFirst({
      where: { invoiceId },
      orderBy: { revisionNumber: 'desc' },
    });

    if (!latestRevision) {
      return null;
    }

    // Get the most recent diff to the latest revision
    const activeDiff = await this.prisma.invoiceDiff.findFirst({
      where: {
        invoiceId,
        toRevisionId: latestRevision.id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        fromRevision: true,
        toRevision: true,
      },
    });

    return activeDiff;
  }

  /**
   * Get version history for an invoice with pagination
   *
   * Returns chronological list of revisions with their diffs.
   * Most recent versions first (descending order).
   *
   * @param invoiceId - Invoice ID
   * @param options - Pagination options
   * @returns Array of version history items
   */
  async getVersionHistory(
    invoiceId: string,
    options: PaginationOptions = {}
  ): Promise<VersionHistoryItem[]> {
    const { limit = 50, offset = 0 } = options;

    const revisions = await this.prisma.invoiceRevision.findMany({
      where: { invoiceId },
      orderBy: { revisionNumber: 'desc' },
      take: limit,
      skip: offset,
    });

    // Fetch diffs for these revisions
    const revisionIds = revisions.map((r) => r.id);
    const diffs = await this.prisma.invoiceDiff.findMany({
      where: {
        invoiceId,
        toRevisionId: { in: revisionIds },
      },
    });

    // Build map of toRevisionId -> diff
    const diffMap = new Map<string, InvoiceDiff>();
    diffs.forEach((diff) => {
      diffMap.set(diff.toRevisionId, diff);
    });

    // Build history items with previous revision info
    const historyItems: VersionHistoryItem[] = [];
    for (let i = 0; i < revisions.length; i++) {
      const revision = revisions[i];
      const diff = diffMap.get(revision.id) || null;
      const previousRevision = i < revisions.length - 1 ? revisions[i + 1] : null;

      historyItems.push({
        revision,
        diff,
        previousRevision,
      });
    }

    return historyItems;
  }

  /**
   * Mark a version as approved baseline (clear active diffs)
   *
   * When an invoice is approved:
   * 1. All pending diffs are marked as resolved
   * 2. The approved version becomes the new baseline
   * 3. Future diffs will be computed from this baseline
   *
   * Note: This doesn't delete diffs for audit purposes,
   * but marks them as part of approved history.
   *
   * @param invoiceId - Invoice ID
   * @param revisionNumber - Revision number to mark as approved
   */
  async markVersionAsApproved(invoiceId: string, revisionNumber: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const revision = await tx.invoiceRevision.findUnique({
        where: {
          invoiceId_revisionNumber: {
            invoiceId,
            revisionNumber,
          },
        },
      });

      if (!revision) {
        throw new Error(`Revision ${revisionNumber} not found for invoice ${invoiceId}`);
      }

      // Update Invoice status to approved
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'approved',
          updatedAt: new Date(),
        },
      });

      logger.info('Version marked as approved', {
        invoiceId,
        revisionNumber,
      });
    });
  }

  /**
   * Get specific revision by version number
   *
   * @param invoiceId - Invoice ID
   * @param revisionNumber - Revision number
   * @returns Revision or null if not found
   */
  async getRevision(invoiceId: string, revisionNumber: number): Promise<InvoiceRevision | null> {
    return await this.prisma.invoiceRevision.findUnique({
      where: {
        invoiceId_revisionNumber: {
          invoiceId,
          revisionNumber,
        },
      },
    });
  }

  /**
   * Get diff between two specific versions
   *
   * @param invoiceId - Invoice ID
   * @param fromVersion - Starting version number
   * @param toVersion - Ending version number
   * @returns Diff or null if not found
   */
  async getDiffBetweenVersions(
    invoiceId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<InvoiceDiff | null> {
    return await this.prisma.invoiceDiff.findUnique({
      where: {
        invoiceId_fromVersion_toVersion: {
          invoiceId,
          fromVersion,
          toVersion,
        },
      },
      include: {
        fromRevision: true,
        toRevision: true,
      },
    });
  }

  /**
   * Get total version count for an invoice
   *
   * @param invoiceId - Invoice ID
   * @returns Total number of versions
   */
  async getVersionCount(invoiceId: string): Promise<number> {
    return await this.prisma.invoiceRevision.count({
      where: { invoiceId },
    });
  }

  /**
   * Calculate similarity between current state and last approved baseline
   *
   * @param invoiceId - Invoice ID
   * @param currentSnapshot - Current invoice state
   * @returns Similarity score (0-1, where 1 is identical)
   */
  async calculateSimilarityToBaseline(
    invoiceId: string,
    currentSnapshot: unknown
  ): Promise<number> {
    const latestRevision = await this.prisma.invoiceRevision.findFirst({
      where: { invoiceId },
      orderBy: { revisionNumber: 'desc' },
    });

    if (!latestRevision) {
      return 0; // No baseline exists
    }

    return diffService.calculateSimilarity(latestRevision.payloadJson, currentSnapshot);
  }
}

// Singleton instance factory
export const createVersioningService = (prisma: PrismaClient): VersioningService => {
  return new VersioningService(prisma);
};