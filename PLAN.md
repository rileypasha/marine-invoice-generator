# CUSTOMERS PAGE UI ALIGNMENT PLAN

## DESIGN TOKEN SPECIFICATION (from mock)

### Colors (Dark Theme - Zinc Palette)
- **Background**: `zinc-950` (`rgb(9, 9, 11)`) - page background
- **Container Background**: `zinc-900` (`rgb(24, 24, 27)`) - card backgrounds
- **Border**: `zinc-800` (`rgb(39, 39, 42)`) - borders and dividers
- **Text Primary**: `zinc-100` (`rgb(244, 244, 245)`) - main text
- **Text Secondary**: `zinc-200` (`rgb(228, 228, 231)`) - table content
- **Text Muted**: `zinc-400` (`rgb(161, 161, 170)`) - table headers, placeholders
- **Primary Action**: `indigo-600` (`rgb(79, 70, 229)`) - primary buttons
- **Primary Hover**: `indigo-500` (`rgb(99, 102, 241)`) - button hover states

### Typography Scale
- **Heading**: `text-lg font-semibold` (18px, 600 weight) - page title
- **Body**: `text-sm` (14px) - table content and general text
- **Labels**: `font-medium` (500 weight) - table headers

### Spacing System
- **Container**: `max-w-screen-2xl p-6` (max-width: 1536px, 24px padding)
- **Section Gap**: `mb-4` (16px margin bottom) - between header and table
- **Element Gap**: `gap-2` (8px) - between inline elements
- **Card Padding**: `p-4` (16px) - internal card padding
- **Table Padding**: `px-4 py-3` (16px horizontal, 12px vertical)

### Layout Components
- **Card Container**: `rounded-2xl border border-zinc-800` - for table wrapper
- **Button Primary**: `variant="primary"` → `bg-indigo-600 hover:bg-indigo-500 text-white`
- **Button Ghost**: `variant="ghost"` → `bg-transparent text-zinc-200 hover:bg-zinc-800`
- **Input**: `rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm`

## GAP ANALYSIS

### Header Section Changes
**Current:**
```html
<div class="customers-page__header">
  <div class="customers-page__title">
    <h1>Customer Directory</h1>
    <p class="customers-page__subtitle">Manage your customer database</p>
  </div>
  <div class="customers-page__actions">
    <!-- Import + Add buttons -->
  </div>
</div>
```

**Target (Mock Structure):**
```html
<div class="mb-4 flex items-center justify-between">
  <h2 class="text-lg font-semibold text-zinc-100">Customers</h2>
  <div class="flex items-center gap-2">
    <Input placeholder="Search customers…" className="w-64" />
    <Button variant="primary">+ New Customer</Button>
  </div>
</div>
```

### Search Section Changes
**Current:** Dedicated search bar section
**Target:** Inline search input in header actions area

### Stats Bar Changes
**Current:** Statistics section with 3 metrics
**Target:** Remove entirely (not in mock)

### Table Structure Changes
**Current:** 5 columns (Name, Contact Information, Address, Created, Actions)
**Target:** 4 columns (Name, Email, Phone, Actions)

### Container Changes
**Current:** `.customers-page { max-width: 1400px; padding: 2rem; }`
**Target:** `mx-auto max-w-screen-2xl p-6`

## IMPLEMENTATION STRATEGY

### Phase 2: Header & Container Alignment
1. **Update container classes**: Change to `mx-auto max-w-screen-2xl p-6`
2. **Simplify header**: Replace title section with simple "Customers" heading
3. **Move search inline**: Integrate search input into header actions area
4. **Remove stats bar**: Comment out statistics section

### Phase 3: Table Structure Alignment
1. **Simplify table headers**: Change to Name, Email, Phone, Actions
2. **Update table cell content**: Focus on essential customer data
3. **Apply mock styling**: Use exact CSS classes from design tokens
4. **Update actions**: Keep essential edit/delete, style as ghost buttons

### Phase 4: CSS Refinement
1. **Update spacing**: Match mock's gap and padding specifications
2. **Refine colors**: Ensure exact zinc palette compliance
3. **Button styling**: Implement exact button variants from mock
4. **Input styling**: Match mock's rounded-xl input specification

### Phase 5: Accessibility Compliance
1. **Focus management**: Ensure proper focus rings match `focus:ring-2 focus:ring-indigo-500`
2. **Color contrast**: Validate WCAG AA compliance with zinc palette
3. **Keyboard navigation**: Test tab order and keyboard interactions
4. **Screen reader**: Verify proper headings and labels

## SUCCESS CRITERIA

- ✅ Header matches mock: Simple "Customers" title with inline search + New Customer button
- ✅ Container uses `mx-auto max-w-screen-2xl p-6` specification
- ✅ Table has 4 columns: Name, Email, Phone, Actions (matching mock exactly)
- ✅ Styling uses exact zinc color palette and spacing from design tokens
- ✅ Buttons match mock variants (primary indigo, ghost transparent)
- ✅ No statistics bar (not present in mock)
- ✅ Responsive behavior maintained
- ✅ WCAG AA accessibility compliance
- ✅ Visual parity with mock prototype achieved

## RISK MITIGATION

- **Backup current implementation** before changes
- **Progressive enhancement** - test each section independently
- **Preserve functionality** - maintain all existing features, only change UI
- **Mobile responsiveness** - ensure design works across breakpoints
- **Performance** - no impact on load times or JavaScript performance