const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// Setup minimal app
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true }
}));

// Load auth middleware
const { loadUser } = require('./server/middleware/auth');
app.use(loadUser);

// Mock master user session
app.use((req, res, next) => {
  req.session = req.session || {};
  req.session.user = { 
    id: 'test-user', 
    email: 'rpasha@marinegroupbw.com', 
    name: 'Test Master',
    role: 'master' 
  };
  req.user = req.session.user;
  next();
});

// Load master routes
const masterRouter = require('./server/routes/master');
app.use('/api/master', masterRouter);

async function test500Fix() {
  console.log('\n🧪 Testing Master Dashboard API with empty parameters\n');
  
  const testCases = [
    {
      name: 'All empty parameters',
      params: '?status=&search=&dateFrom=&dateTo=&market=&page=&limit='
    },
    {
      name: 'Empty strings with spaces',
      params: '?status= &search= &dateFrom= &dateTo= '
    },
    {
      name: 'Invalid date formats',
      params: '?dateFrom=invalid&dateTo=not-a-date'
    },
    {
      name: 'Invalid page numbers',
      params: '?page=abc&limit=xyz'
    },
    {
      name: 'SQL injection attempt (should be sanitized)',
      params: '?search=\'; DROP TABLE invoice; --'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`📌 Testing: ${testCase.name}`);
    console.log(`   Params: ${testCase.params}`);
    
    try {
      const response = await request(app)
        .get(`/api/master/invoices${testCase.params}`)
        .expect((res) => {
          if (res.status === 500) {
            console.log(`   ❌ 500 Error: ${res.body.error || res.body.message}`);
            console.log(`   Response:`, JSON.stringify(res.body).substring(0, 200));
          } else if (res.status === 200) {
            console.log(`   ✅ Success! Status: ${res.status}`);
            console.log(`   Invoices returned: ${res.body.invoices?.length || 0}`);
            if (res.body.recovery) {
              console.log(`   ⚠️ Recovery mode: ${res.body.error}`);
            }
          } else {
            console.log(`   ⚠️ Unexpected status: ${res.status}`);
          }
        });
    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}`);
    }
    
    console.log();
  }
  
  console.log('🏁 Test complete!\n');
  await prisma.$disconnect();
  process.exit(0);
}

test500Fix().catch(console.error);