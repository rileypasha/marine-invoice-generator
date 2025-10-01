/**
 * Change Request Service
 *
 * Manages change request tracking, snapshots, and diff computation
 * for invoices in "change_requested" status.
 */

import { PrismaClient } from '@prisma/client';
import { computeDiff, DiffResult, DiffConfig } from '../utils/diff/computeDiff';
import { logger } from '../utils/logger';

export interface ChangeRequestService {
  /**
   * Store baseline snapshot when status changes to 'change_requested'
   */
  captureSnapshot(invoiceId: string, currentState: any, userId: string): Promise<void>;

  /**
   * Recompute diff from stored snapshot
   */
  recomputeDiff(invoiceId: string, currentState: any, config?: Partial<DiffConfig>): Promise<DiffResult | null>;

  /**
   * Clear change request tracking when invoice is approved
   */
  clearChangeRequest(invoiceId: string): Promise<void>;

  /**
   * Get current diff for an invoice (if in change_requested status)
   */
  getCurrentDiff(invoiceId: string): Promise<DiffResult | null>;
}

export function createChangeRequestService(prisma: PrismaClient): ChangeRequestService {
  return {
    /**
     * Capture snapshot when status changes TO 'change_requested'
     */
    async captureSnapshot(invoiceId: string, currentState: any, userId: string): Promise<void> {
      try {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            changeRequestSnapshot: currentState as any,
            changeRequestDiff: undefined,
            changeRequestedAt: new Date(),
            changeRequestedBy: userId,
          },
        });

        logger.info('Change request snapshot captured', {
          invoiceId,
          userId,
        });
      } catch (error) {
        logger.error('Failed to capture change request snapshot', {
          error: error instanceof Error ? error.message : 'Unknown error',
          invoiceId,
          userId,
        });
        throw error;
      }
    },

    /**
     * Recompute diff from stored snapshot
     */
    async recomputeDiff(
      invoiceId: string,
      currentState: any,
      config: Partial<DiffConfig> = {}
    ): Promise<DiffResult | null> {
      try {
        // Fetch invoice with snapshot
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: {
            changeRequestSnapshot: true,
            status: true,
          },
        });

        if (!invoice) {
          logger.warn('Invoice not found for diff computation', { invoiceId });
          return null;
        }

        if (!invoice.changeRequestSnapshot) {
          logger.debug('No snapshot available for diff computation', { invoiceId });
          return null;
        }

        // Compute diff
        const diff = computeDiff(
          invoice.changeRequestSnapshot,
          currentState,
          {
            arrayIdentityKeys: ['id', 'tempId', 'description'],
            normalizeStrings: true,
            ignoreCase: false,
            numericTolerance: 0.01,
            ...config,
          }
        );

        // Store computed diff
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            changeRequestDiff: diff as any,
          },
        });

        logger.info('Change request diff recomputed', {
          invoiceId,
          changeCount: diff.length,
        });

        return diff;
      } catch (error) {
        logger.error('Failed to recompute change request diff', {
          error: error instanceof Error ? error.message : 'Unknown error',
          invoiceId,
        });
        throw error;
      }
    },

    /**
     * Clear change request tracking (when approved with attachment)
     */
    async clearChangeRequest(invoiceId: string): Promise<void> {
      try {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            changeRequestSnapshot: undefined,
            changeRequestDiff: undefined,
            changeRequestedAt: null,
            changeRequestedBy: null,
          },
        });

        logger.info('Change request tracking cleared', { invoiceId });
      } catch (error) {
        logger.error('Failed to clear change request tracking', {
          error: error instanceof Error ? error.message : 'Unknown error',
          invoiceId,
        });
        throw error;
      }
    },

    /**
     * Get current diff for invoice
     */
    async getCurrentDiff(invoiceId: string): Promise<DiffResult | null> {
      try {
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: {
            changeRequestDiff: true,
            status: true,
          },
        });

        if (!invoice) {
          return null;
        }

        if (invoice.status !== 'change_requested') {
          return null;
        }

        return (invoice.changeRequestDiff as any) || null;
      } catch (error) {
        logger.error('Failed to get current diff', {
          error: error instanceof Error ? error.message : 'Unknown error',
          invoiceId,
        });
        return null;
      }
    },
  };
}