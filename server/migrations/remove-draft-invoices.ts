/**
 * Migration: Remove Draft Invoice Concept
 *
 * This migration safely removes the draft invoice concept by:
 * 1. Identifying draft/published pairs and keeping only the published version
 * 2. Promoting lone draft invoices to saved status
 * 3. Creating unique constraints to prevent future duplicates
 * 4. Cleaning up orphaned draft records
 */

import { logger } from '../utils/logger';

interface InvoiceRecord {
  id: string;
  userId: string;
  status: string;
  title: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

// Mock database interface - replace with real database operations
interface DatabaseInterface {
  getAllInvoices(): Promise<InvoiceRecord[]>;
  updateInvoice(id: string, updates: Partial<InvoiceRecord>): Promise<void>;
  deleteInvoice(id: string): Promise<void>;
  createUniqueIndex(fields: string[]): Promise<void>;
}

class DraftRemovalMigration {
  private db: DatabaseInterface;
  private dryRun: boolean;

  constructor(database: DatabaseInterface, dryRun: boolean = false) {
    this.db = database;
    this.dryRun = dryRun;
  }

  async execute(): Promise<{
    draftsPromoted: number;
    draftsDeleted: number;
    duplicatesResolved: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    logger.info('Starting draft invoice removal migration', { dryRun: this.dryRun });

    const results = {
      draftsPromoted: 0,
      draftsDeleted: 0,
      duplicatesResolved: 0,
      errors: [] as string[]
    };

    try {
      // Step 1: Get all invoices
      const allInvoices = await this.db.getAllInvoices();
      logger.info(`Found ${allInvoices.length} total invoices`);

      // Step 2: Group invoices by user and title to identify potential duplicates
      const invoiceGroups = this.groupInvoicesByUserAndTitle(allInvoices);

      // Step 3: Process each group
      for (const [groupKey, invoices] of Object.entries(invoiceGroups)) {
        try {
          await this.processInvoiceGroup(groupKey, invoices, results);
        } catch (error: any) {
          const errorMsg = `Failed to process group ${groupKey}: ${error.message}`;
          logger.error(errorMsg, { error });
          results.errors.push(errorMsg);
        }
      }

      // Step 4: Create unique constraints (if not dry run)
      if (!this.dryRun) {
        await this.createUniqueConstraints();
      }

      const duration = Date.now() - startTime;
      logger.info('Draft removal migration completed', {
        ...results,
        duration,
        dryRun: this.dryRun
      });

      return results;

    } catch (error: any) {
      logger.error('Migration failed', { error: error.message });
      results.errors.push(`Migration failed: ${error.message}`);
      return results;
    }
  }

  private groupInvoicesByUserAndTitle(invoices: InvoiceRecord[]): Record<string, InvoiceRecord[]> {
    const groups: Record<string, InvoiceRecord[]> = {};

    for (const invoice of invoices) {
      const key = `${invoice.userId}:${invoice.title || 'untitled'}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(invoice);
    }

    return groups;
  }

  private async processInvoiceGroup(
    groupKey: string,
    invoices: InvoiceRecord[],
    results: { draftsPromoted: number; draftsDeleted: number; duplicatesResolved: number; errors: string[] }
  ): Promise<void> {
    if (invoices.length === 1) {
      // Single invoice - promote if draft
      const invoice = invoices[0];
      if (invoice.status === 'draft') {
        await this.promoteInvoiceToSaved(invoice, results);
      }
      return;
    }

    // Multiple invoices with same user/title - resolve duplicates
    logger.info(`Processing duplicate group: ${groupKey} (${invoices.length} invoices)`);

    const drafts = invoices.filter(inv => inv.status === 'draft');
    const saved = invoices.filter(inv => inv.status === 'saved' || inv.status === 'published');
    const finalized = invoices.filter(inv => inv.status === 'finalized');

    if (finalized.length > 0) {
      // Keep finalized version, delete all others
      const keeper = this.selectBestInvoice(finalized);
      await this.deleteOtherInvoices(invoices, keeper, results);
    } else if (saved.length > 0) {
      // Keep best saved version, delete all others
      const keeper = this.selectBestInvoice(saved);
      await this.deleteOtherInvoices(invoices, keeper, results);
    } else if (drafts.length > 0) {
      // Only drafts - promote latest, delete others
      const keeper = this.selectBestInvoice(drafts);
      await this.promoteInvoiceToSaved(keeper, results);
      await this.deleteOtherInvoices(invoices, keeper, results);
    }

    results.duplicatesResolved++;
  }

  private selectBestInvoice(invoices: InvoiceRecord[]): InvoiceRecord {
    // Prefer finalized > saved > latest by update time
    return invoices.reduce((best, current) => {
      // Prefer higher status priority
      const bestPriority = this.getStatusPriority(best.status);
      const currentPriority = this.getStatusPriority(current.status);

      if (currentPriority > bestPriority) {
        return current;
      }

      if (currentPriority === bestPriority) {
        // Same status - prefer latest update
        return new Date(current.updatedAt) > new Date(best.updatedAt) ? current : best;
      }

      return best;
    });
  }

  private getStatusPriority(status: string): number {
    switch (status) {
      case 'finalized': return 3;
      case 'saved':
      case 'published': return 2;
      case 'draft': return 1;
      default: return 0;
    }
  }

  private async promoteInvoiceToSaved(
    invoice: InvoiceRecord,
    results: { draftsPromoted: number; draftsDeleted: number; duplicatesResolved: number; errors: string[] }
  ): Promise<void> {
    logger.info(`Promoting draft invoice to saved: ${invoice.id}`);

    if (!this.dryRun) {
      await this.db.updateInvoice(invoice.id, {
        status: 'saved',
        updatedAt: new Date().toISOString()
      });
    }

    results.draftsPromoted++;
  }

  private async deleteOtherInvoices(
    allInvoices: InvoiceRecord[],
    keeper: InvoiceRecord,
    results: { draftsPromoted: number; draftsDeleted: number; duplicatesResolved: number; errors: string[] }
  ): Promise<void> {
    for (const invoice of allInvoices) {
      if (invoice.id !== keeper.id) {
        logger.info(`Deleting duplicate invoice: ${invoice.id} (status: ${invoice.status})`);

        if (!this.dryRun) {
          await this.db.deleteInvoice(invoice.id);
        }

        if (invoice.status === 'draft') {
          results.draftsDeleted++;
        }
      }
    }
  }

  private async createUniqueConstraints(): Promise<void> {
    logger.info('Creating unique constraints to prevent future duplicates');

    try {
      // Create unique index on (userId, title) for active invoices
      await this.db.createUniqueIndex(['userId', 'title']);
      logger.info('Unique constraint created successfully');
    } catch (error: any) {
      logger.error('Failed to create unique constraint', { error: error.message });
      throw error;
    }
  }

  async rollback(): Promise<void> {
    logger.warn('Draft removal migration rollback not implemented - use database backup instead');
    throw new Error('Migration rollback requires database restore from backup');
  }
}

export default DraftRemovalMigration;

// Usage example:
export async function runDraftRemovalMigration(database: DatabaseInterface, dryRun: boolean = false) {
  const migration = new DraftRemovalMigration(database, dryRun);
  return await migration.execute();
}