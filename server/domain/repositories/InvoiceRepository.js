const { PrismaClient } = require('@prisma/client');
const { Invoice, InvoiceState } = require('../entities/Invoice');

/**
 * Invoice Repository
 * Handles persistence and retrieval of Invoice aggregates using Prisma ORM
 * Implements Repository pattern for Invoice domain
 */
class InvoiceRepository {
  constructor(prismaClient = null) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Create a new invoice
   * @param {Invoice} invoice - Invoice aggregate
   * @returns {Promise<Invoice>} Persisted invoice
   */
  async create(invoice) {
    try {
      const data = this._mapToDatabase(invoice);

      const dbRecord = await this.prisma.invoice.create({
        data: {
          ...data,
          // Use relation for user association
          user: {
            connect: { id: invoice.userId }
          }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      return Invoice.fromDatabase(dbRecord);
    } catch (error) {
      // Handle user relation not found
      if (error.code === 'P2025' || error.message?.includes('connect')) {
        // Fallback to scalar userId for backward compatibility
        const data = this._mapToDatabase(invoice);
        const dbRecord = await this.prisma.invoice.create({
          data: {
            ...data,
            userId: invoice.userId
          }
        });
        return Invoice.fromDatabase(dbRecord);
      }
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }

  /**
   * Update an existing invoice with optimistic locking
   * @param {Invoice} invoice - Invoice aggregate with changes
   * @param {string} expectedVersion - Expected version for optimistic locking
   * @returns {Promise<Invoice>} Updated invoice
   */
  async update(invoice, expectedVersion = null) {
    try {
      const data = this._mapToDatabase(invoice);

      // Optimistic locking: check version if provided
      const where = { id: invoice.id };
      if (expectedVersion !== null) {
        where.version = expectedVersion;
      }

      const dbRecord = await this.prisma.invoice.update({
        where,
        data,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      return Invoice.fromDatabase(dbRecord);
    } catch (error) {
      if (error.code === 'P2025') {
        if (expectedVersion !== null) {
          throw new Error(`Conflict: Invoice was modified by another user. Expected version ${expectedVersion}`);
        }
        throw new Error(`Invoice not found: ${invoice.id}`);
      }
      throw new Error(`Failed to update invoice: ${error.message}`);
    }
  }

  /**
   * Find invoice by ID
   * @param {string} id - Invoice ID
   * @param {string} userId - User ID for ownership validation
   * @returns {Promise<Invoice|null>} Invoice aggregate or null
   */
  async findById(id, userId) {
    try {
      const dbRecord = await this.prisma.invoice.findFirst({
        where: {
          id,
          // Check ownership using both userId and userEmail for backward compatibility
          OR: [
            { userId },
            { userEmail: await this._getUserEmail(userId) }
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      return dbRecord ? Invoice.fromDatabase(dbRecord) : null;
    } catch (error) {
      throw new Error(`Failed to find invoice: ${error.message}`);
    }
  }

  /**
   * Find invoices by user
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<Invoice[]>} Array of invoice aggregates
   */
  async findByUser(userId, options = {}) {
    try {
      const {
        skip = 0,
        take = 50,
        orderBy = { updatedAt: 'desc' },
        state = null,
        search = null
      } = options;

      const userEmail = await this._getUserEmail(userId);

      const where = {
        // Check ownership using both userId and userEmail for backward compatibility
        OR: [
          { userId },
          { userEmail }
        ]
      };

      // Filter by state if provided
      if (state) {
        where.state = state;
      }

      // Search in title, customer name, or vessel name
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { vesselName: { contains: search, mode: 'insensitive' } }
        ];
      }

      const dbRecords = await this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      return dbRecords.map(record => Invoice.fromDatabase(record));
    } catch (error) {
      throw new Error(`Failed to find invoices for user: ${error.message}`);
    }
  }

  /**
   * Delete invoice by ID
   * @param {string} id - Invoice ID
   * @param {string} userId - User ID for ownership validation
   * @returns {Promise<boolean>} Success status
   */
  async delete(id, userId) {
    try {
      // First verify ownership
      const invoice = await this.findById(id, userId);
      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }

      await this.prisma.invoice.delete({
        where: { id }
      });

      return true;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new Error(`Invoice not found: ${id}`);
      }
      throw new Error(`Failed to delete invoice: ${error.message}`);
    }
  }

  /**
   * Smart save: Create or Update based on invoice state
   * @param {Invoice} invoice - Invoice aggregate
   * @returns {Promise<Invoice>} Persisted invoice
   */
  async smartSave(invoice) {
    const action = invoice.determineSaveAction();

    switch (action) {
      case 'CREATE':
        return await this.create(invoice.save());

      case 'UPDATE':
        return await this.update(invoice.persistChanges());

      case 'NO_ACTION':
        return invoice; // Already saved, no action needed

      case 'CANNOT_SAVE':
        throw new Error('Cannot save finalized invoice');

      default:
        throw new Error(`Unknown save action: ${action}`);
    }
  }

  /**
   * Find invoices with unsaved changes (MODIFIED state)
   * @param {string} userId - User ID
   * @returns {Promise<Invoice[]>} Modified invoices
   */
  async findModified(userId) {
    return await this.findByUser(userId, {
      state: InvoiceState.MODIFIED,
      orderBy: { updatedAt: 'desc' }
    });
  }

  /**
   * Find draft invoices
   * @param {string} userId - User ID
   * @returns {Promise<Invoice[]>} Draft invoices
   */
  async findDrafts(userId) {
    return await this.findByUser(userId, {
      state: InvoiceState.DRAFT,
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Count invoices by state for dashboard
   * @param {string} userId - User ID
   * @returns {Promise<object>} Count by state
   */
  async countByState(userId) {
    try {
      const userEmail = await this._getUserEmail(userId);

      const counts = await this.prisma.invoice.groupBy({
        by: ['status'],
        where: {
          OR: [
            { userId },
            { userEmail }
          ]
        },
        _count: {
          id: true
        }
      });

      // Convert to object format - map existing status to new states
      const result = {
        [InvoiceState.DRAFT]: 0,
        [InvoiceState.SAVED]: 0,
        [InvoiceState.MODIFIED]: 0,
        [InvoiceState.FINALIZED]: 0
      };

      counts.forEach(count => {
        const status = count.status || 'saved';
        // Map existing status values to new state values
        switch (status) {
          case 'draft':
            result[InvoiceState.DRAFT] = count._count.id;
            break;
          case 'saved':
            result[InvoiceState.SAVED] = count._count.id;
            break;
          case 'archived':
            result[InvoiceState.FINALIZED] = count._count.id;
            break;
          default:
            result[InvoiceState.SAVED] = count._count.id;
            break;
        }
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to count invoices: ${error.message}`);
    }
  }

  /**
   * Batch operations for performance
   */

  /**
   * Update multiple invoices (e.g., for bulk state changes)
   * @param {string[]} ids - Invoice IDs
   * @param {object} updates - Update data
   * @param {string} userId - User ID for ownership validation
   * @returns {Promise<number>} Count of updated records
   */
  async updateMany(ids, updates, userId) {
    try {
      const userEmail = await this._getUserEmail(userId);

      const result = await this.prisma.invoice.updateMany({
        where: {
          id: { in: ids },
          OR: [
            { userId },
            { userEmail }
          ]
        },
        data: updates
      });

      return result.count;
    } catch (error) {
      throw new Error(`Failed to bulk update invoices: ${error.message}`);
    }
  }

  /**
   * Private helper methods
   */

  /**
   * Map Invoice aggregate to database format
   * @param {Invoice} invoice - Invoice aggregate
   * @returns {object} Database record format
   */
  _mapToDatabase(invoice) {
    // Map domain state to database status for compatibility
    let status = 'saved'; // Default fallback
    switch (invoice.state) {
      case InvoiceState.DRAFT:
        status = 'draft';
        break;
      case InvoiceState.SAVED:
        status = 'saved';
        break;
      case InvoiceState.MODIFIED:
        status = 'saved'; // Modified invoices are saved to database
        break;
      case InvoiceState.FINALIZED:
        status = 'archived';
        break;
      default:
        status = 'saved';
    }

    return {
      id: invoice.id,
      title: invoice.title,
      data: JSON.stringify(invoice.data),
      metadata: JSON.stringify(invoice.metadata),
      status: status, // Map state to status for database compatibility
      version: invoice.version,
      userName: invoice.userName,
      userEmail: invoice.userEmail,
      vesselName: invoice.vesselName,
      vesselWeight: invoice.vesselWeight,
      vesselBeam: invoice.vesselBeam,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      grossProfit: invoice.grossProfit,
      profitPercent: invoice.profitPercent,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      savedAt: invoice.savedAt,
      finalizedAt: invoice.finalizedAt
    };
  }

  /**
   * Get user email for backward compatibility checks
   * @param {string} userId - User ID
   * @returns {Promise<string>} User email
   */
  async _getUserEmail(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });
      return user?.email || '';
    } catch (error) {
      return ''; // Fallback for cases where user lookup fails
    }
  }

  /**
   * Transaction support for complex operations
   */
  async transaction(operations) {
    return await this.prisma.$transaction(operations);
  }

  /**
   * Close database connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = InvoiceRepository;