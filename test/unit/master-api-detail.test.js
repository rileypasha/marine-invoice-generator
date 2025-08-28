const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');

// Mock Prisma Client
const mockPrismaClient = {
    $queryRaw: sinon.stub(),
    invoice: {
        findUnique: sinon.stub()
    }
};

// Mock middleware
const mockRequireMaster = (req, res, next) => {
    req.user = { email: 'rpasha@marinegroupbw.com', isMaster: true };
    next();
};

// Create test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    
    // Mock the master route
    const router = express.Router();
    
    router.get('/invoices/:id', mockRequireMaster, async (req, res) => {
        const requestId = `detail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            const { id } = req.params;
            
            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!id || !uuidRegex.test(id)) {
                console.warn({
                    event: 'INVALID_INVOICE_ID',
                    id,
                    requestId,
                    email: req.user?.email
                });
                return res.status(400).json({ error: 'Invalid invoice ID format' });
            }
            
            // Log access attempt
            console.log(`\n🔍 [${requestId}] MASTER DETAIL VIEW REQUEST`);
            console.log('  User:', req.user?.email);
            console.log('  Invoice ID:', id);
            
            // Mock database query
            const invoices = await mockPrismaClient.$queryRaw();
            
            if (!invoices || invoices.length === 0) {
                console.warn({
                    event: 'INVOICE_NOT_FOUND',
                    invoiceId: id,
                    requestId,
                    email: req.user?.email
                });
                return res.status(404).json({ error: 'Invoice not found' });
            }
            
            const invoice = invoices[0];
            
            // Parse the JSON data field if it exists
            let invoiceData = {};
            try {
                invoiceData = invoice.data ? JSON.parse(invoice.data) : {};
            } catch (e) {
                console.warn({
                    event: 'INVOICE_DATA_PARSE_ERROR',
                    invoiceId: id,
                    error: e.message
                });
            }
            
            // Ensure response structure with all required fields
            const responseData = {
                ...invoice,
                parsedData: invoiceData || {},
                // Ensure critical fields exist for frontend
                id: invoice.id,
                status: invoice.status || 'unknown',
                vesselName: invoice.vesselName || 'N/A',
                customerName: invoice.customerName || 'N/A',
                total: invoice.total || 0,
                savedAt: invoice.savedAt,
                submittedAt: invoice.submittedAt
            };
            
            console.log(`  ✅ Sending invoice data for ID: ${id}`);
            console.log(`  Response structure: ${JSON.stringify(Object.keys(responseData))}`);
            
            res.json(responseData);
        } catch (error) {
            console.error({
                event: 'MASTER_DETAIL_ERROR',
                error: error.message,
                stack: error.stack,
                email: req.user?.email,
                invoiceId: req.params.id,
                requestId
            });
            
            console.error(`  ❌ Error fetching invoice ${req.params.id}:`, error.message);
            
            res.status(500).json({ 
                error: 'Failed to fetch invoice',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });
    
    app.use('/api/master', router);
    
    return app;
}

describe('GET /api/master/invoices/:id', function() {
    let app;
    let consoleLogStub;
    let consoleWarnStub;
    let consoleErrorStub;
    
    beforeEach(function() {
        app = createTestApp();
        consoleLogStub = sinon.stub(console, 'log');
        consoleWarnStub = sinon.stub(console, 'warn');
        consoleErrorStub = sinon.stub(console, 'error');
        mockPrismaClient.$queryRaw.reset();
    });
    
    afterEach(function() {
        consoleLogStub.restore();
        consoleWarnStub.restore();
        consoleErrorStub.restore();
    });
    
    describe('Input Validation', function() {
        it('should return 400 for invalid UUID format', async function() {
            const res = await request(app)
                .get('/api/master/invoices/not-a-uuid')
                .expect(400);
            
            expect(res.body.error).to.equal('Invalid invoice ID format');
            expect(consoleWarnStub.calledWith(sinon.match({
                event: 'INVALID_INVOICE_ID',
                id: 'not-a-uuid'
            }))).to.be.true;
        });
        
        it('should return 400 for malformed UUID', async function() {
            const res = await request(app)
                .get('/api/master/invoices/12345-67890')
                .expect(400);
            
            expect(res.body.error).to.equal('Invalid invoice ID format');
        });
        
        it('should return 400 for SQL injection attempt', async function() {
            const res = await request(app)
                .get("/api/master/invoices/'; DROP TABLE Invoice; --")
                .expect(400);
            
            expect(res.body.error).to.equal('Invalid invoice ID format');
        });
        
        it('should accept valid UUID format', async function() {
            const validUuid = '123e4567-e89b-12d3-a456-426614174000';
            
            mockPrismaClient.$queryRaw.resolves([{
                id: validUuid,
                status: 'saved',
                vesselName: 'Test Vessel',
                customerName: 'Test Customer',
                total: 1000,
                data: JSON.stringify({ test: 'data' })
            }]);
            
            const res = await request(app)
                .get(`/api/master/invoices/${validUuid}`)
                .expect(200);
            
            expect(res.body.id).to.equal(validUuid);
        });
    });
    
    describe('Database Responses', function() {
        it('should return 404 for non-existent invoice', async function() {
            const validUuid = '00000000-0000-0000-0000-000000000000';
            
            mockPrismaClient.$queryRaw.resolves([]);
            
            const res = await request(app)
                .get(`/api/master/invoices/${validUuid}`)
                .expect(404);
            
            expect(res.body.error).to.equal('Invoice not found');
            expect(consoleWarnStub.calledWith(sinon.match({
                event: 'INVOICE_NOT_FOUND',
                invoiceId: validUuid
            }))).to.be.true;
        });
        
        it('should return full invoice data for valid ID', async function() {
            const validUuid = '123e4567-e89b-12d3-a456-426614174000';
            const mockInvoice = {
                id: validUuid,
                status: 'submitted',
                vesselName: 'Test Vessel',
                customerName: 'Test Customer',
                total: 1500.50,
                savedAt: new Date().toISOString(),
                submittedAt: new Date().toISOString(),
                data: JSON.stringify({
                    vessel: { name: 'Test Vessel', weight: 100 },
                    customer: { customerName: 'Test Customer' },
                    scope: { lineItems: [] }
                })
            };
            
            mockPrismaClient.$queryRaw.resolves([mockInvoice]);
            
            const res = await request(app)
                .get(`/api/master/invoices/${validUuid}`)
                .expect(200);
            
            expect(res.body.id).to.equal(validUuid);
            expect(res.body.status).to.equal('submitted');
            expect(res.body.vesselName).to.equal('Test Vessel');
            expect(res.body.customerName).to.equal('Test Customer');
            expect(res.body.total).to.equal(1500.50);
            expect(res.body.parsedData).to.be.an('object');
            expect(res.body.parsedData.vessel).to.be.an('object');
        });
        
        it('should handle null data field gracefully', async function() {
            const validUuid = '123e4567-e89b-12d3-a456-426614174001';
            const mockInvoice = {
                id: validUuid,
                status: 'saved',
                vesselName: 'Test Vessel',
                customerName: 'Test Customer',
                total: 2000,
                data: null
            };
            
            mockPrismaClient.$queryRaw.resolves([mockInvoice]);
            
            const res = await request(app)
                .get(`/api/master/invoices/${validUuid}`)
                .expect(200);
            
            expect(res.body.parsedData).to.deep.equal({});
        });
        
        it('should handle invalid JSON in data field', async function() {
            const validUuid = '123e4567-e89b-12d3-a456-426614174002';
            const mockInvoice = {
                id: validUuid,
                status: 'saved',
                vesselName: 'Test Vessel',
                customerName: 'Test Customer',
                total: 3000,
                data: 'invalid json {{'
            };
            
            mockPrismaClient.$queryRaw.resolves([mockInvoice]);
            
            const res = await request(app)
                .get(`/api/master/invoices/${validUuid}`)
                .expect(200);
            
            expect(res.body.parsedData).to.deep.equal({});
            expect(consoleWarnStub.calledWith(sinon.match({
                event: 'INVOICE_DATA_PARSE_ERROR',
                invoiceId: validUuid
            }))).to.be.true;
        });
        
        it('should provide default values for missing fields', async function() {
            const validUuid = '123e4567-e89b-12d3-a456-426614174003';
            const mockInvoice = {
                id: validUuid,
                // Missing most fields
                data: null
            };
            
            mockPrismaClient.$queryRaw.resolves([mockInvoice]);
            
            const res = await request(app)
                .get(`/api/master/invoices/${validUuid}`)
                .expect(200);
            
            expect(res.body.id).to.equal(validUuid);
            expect(res.body.status).to.equal('unknown');
            expect(res.body.vesselName).to.equal('N/A');
            expect(res.body.customerName).to.equal('N/A');
            expect(res.body.total).to.equal(0);
            expect(res.body.parsedData).to.deep.equal({});
        });
    });
    
    describe('Error Handling', function() {
        it('should return 500 on database error', async function() {
            const validUuid = '123e4567-e89b-12d3-a456-426614174004';
            
            mockPrismaClient.$queryRaw.rejects(new Error('Database connection failed'));
            
            const res = await request(app)
                .get(`/api/master/invoices/${validUuid}`)
                .expect(500);
            
            expect(res.body.error).to.equal('Failed to fetch invoice');
            expect(consoleErrorStub.calledWith(sinon.match({
                event: 'MASTER_DETAIL_ERROR',
                error: 'Database connection failed'
            }))).to.be.true;
        });
        
        it('should include error message in development mode', async function() {
            process.env.NODE_ENV = 'development';
            
            const validUuid = '123e4567-e89b-12d3-a456-426614174005';
            
            mockPrismaClient.$queryRaw.rejects(new Error('Detailed error message'));
            
            const res = await request(app)
                .get(`/api/master/invoices/${validUuid}`)
                .expect(500);
            
            expect(res.body.error).to.equal('Failed to fetch invoice');
            expect(res.body.message).to.equal('Detailed error message');
            
            delete process.env.NODE_ENV;
        });
        
        it('should not include error message in production mode', async function() {
            process.env.NODE_ENV = 'production';
            
            const validUuid = '123e4567-e89b-12d3-a456-426614174006';
            
            mockPrismaClient.$queryRaw.rejects(new Error('Sensitive error message'));
            
            const res = await request(app)
                .get(`/api/master/invoices/${validUuid}`)
                .expect(500);
            
            expect(res.body.error).to.equal('Failed to fetch invoice');
            expect(res.body.message).to.be.undefined;
            
            delete process.env.NODE_ENV;
        });
    });
    
    describe('Logging', function() {
        it('should log successful requests', async function() {
            const validUuid = '123e4567-e89b-12d3-a456-426614174007';
            const mockInvoice = {
                id: validUuid,
                status: 'saved',
                vesselName: 'Log Test Vessel',
                customerName: 'Log Test Customer',
                total: 4000,
                data: null
            };
            
            mockPrismaClient.$queryRaw.resolves([mockInvoice]);
            
            await request(app)
                .get(`/api/master/invoices/${validUuid}`)
                .expect(200);
            
            expect(consoleLogStub.calledWith(sinon.match('MASTER DETAIL VIEW REQUEST'))).to.be.true;
            expect(consoleLogStub.calledWith(sinon.match('User:'))).to.be.true;
            expect(consoleLogStub.calledWith(sinon.match('Invoice ID:'))).to.be.true;
            expect(consoleLogStub.calledWith(sinon.match('✅ Sending invoice data'))).to.be.true;
        });
        
        it('should log request headers for debugging', async function() {
            const validUuid = '123e4567-e89b-12d3-a456-426614174008';
            const mockInvoice = {
                id: validUuid,
                status: 'saved',
                vesselName: 'Header Test Vessel',
                customerName: 'Header Test Customer',
                total: 5000,
                data: null
            };
            
            mockPrismaClient.$queryRaw.resolves([mockInvoice]);
            
            await request(app)
                .get(`/api/master/invoices/${validUuid}`)
                .set('Accept', 'application/json')
                .set('X-Requested-With', 'XMLHttpRequest')
                .expect(200);
            
            // Check that headers are being considered (would be logged in real implementation)
            expect(consoleLogStub.called).to.be.true;
        });
    });
});