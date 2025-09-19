# UI Polish & Visual Baseline Alignment - TodoWrite

## CRITICAL VISUAL MISMATCHES IDENTIFIED

### Major Issues from Code Analysis:

1. **❌ SIDEBAR MISMATCH**: Current sidebar is 280px wide, but baseline shows 72px icon-only sidebar
2. **❌ LAYOUT INCONSISTENCY**: Current uses expanded sidebar with full navigation text
3. **❌ MISSING VISUAL CONSISTENCY**: Not following the dark theme + 72px sidebar pattern from invoice.png

### Phase 1: BASELINE AUDIT & VISUAL ANALYSIS ✅
- [x] Read invoice.png baseline (shows 72px dark sidebar + invoice editor)
- [x] Read current customers.html, customers.js, customers-page.css
- [x] Identified major layout discrepancy: 280px vs 72px sidebar
- [x] Found CustomersPage.js already has mock-compatible structure
- [x] CSS has good Tailwind-style utilities and design tokens

### Phase 2: CRITICAL FIXES NEEDED

#### Sidebar Alignment ⚠️ HIGH PRIORITY
- [ ] **Change sidebar width**: 280px → 72px (matching invoice.png baseline)
- [ ] **Icon-only navigation**: Remove text, keep only icons and tooltips
- [ ] **Update page-main margin**: margin-left: 280px → margin-left: 72px
- [ ] **Maintain responsive behavior** for mobile

#### Layout Structure
- [ ] **Verify container**: Already using `mx-auto max-w-screen-2xl p-6` ✅
- [ ] **Header alignment**: Using inline search + actions ✅
- [ ] **Table structure**: 4 columns (Name, Email, Phone, Actions) ✅

### Phase 3: CSS BRANCH IMPLEMENTATION
- [ ] Switch to CSS branch ✅ (already on CSS)
- [ ] Create working branch: `css/ui-polish-2025-09-19`
- [ ] Apply sidebar width fixes
- [ ] Test responsive behavior
- [ ] Commit atomically

### Phase 4: DEPLOYMENT & VERIFICATION
- [ ] Deploy from CSS branch via Render MCP
- [ ] Monitor deployment until "live" status
- [ ] Run Playwright E2E test with production credentials
- [ ] Capture before/after screenshots

### Phase 5: ITERATIVE REFINEMENT
- [ ] Compare with invoice.png baseline pixel-by-pixel
- [ ] Fix any remaining visual inconsistencies
- [ ] Ensure WCAG AA compliance maintained
- [ ] Verify no functionality regressions

## IMMEDIATE ACTION PLAN

1. **URGENT**: Fix sidebar width mismatch (280px → 72px)
2. **URGENT**: Update navigation to icon-only pattern
3. **URGENT**: Adjust main content margin accordingly
4. Deploy and verify changes align with baseline

## SUCCESS CRITERIA
- ✅ Sidebar matches 72px width from invoice.png
- ✅ Icon-only navigation with consistent styling
- ✅ No layout jitter or visual inconsistencies
- ✅ Responsive behavior maintained
- ✅ Visual alignment with baseline confirmed via Playwright