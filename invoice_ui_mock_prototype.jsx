import React, { useEffect, useMemo, useState } from "react";

// --- Demo data --------------------------------------------------------------
const DEMO_CUSTOMERS = [
  { id: "c1", name: "Pacific Yachts LLC", email: "ops@pacificyachts.com", phone: "(619) 555-1188", address: "101 Marina Park Way, San Diego, CA", terms: "Net 30", taxStatus: "Taxable (8.75%)", defaultMarkup: 2.5 },
  { id: "c2", name: "Cabo Charters MX", email: "billing@cabochart.mx", phone: "+52 624 555 2210", address: "Calle Marina 50, Cabo San Lucas, BCS", terms: "Due on receipt", taxStatus: "Tax Exempt", defaultMarkup: 0 },
  { id: "c3", name: "Bluewater Adventures", email: "ap@bluewater.io", phone: "(310) 555-0199", address: "1530 Harbor Blvd, Los Angeles, CA", terms: "Net 15", taxStatus: "Taxable (9.5%)", defaultMarkup: 5 },
];

const DEMO_VESSELS = [
  { id: "v1", customerId: "c1", name: "Sea Breeze", type: "Motor Yacht", length: 92, beam: 21, weight: 135, reg: "CA 1234 AB" },
  { id: "v2", customerId: "c2", name: "Mar de Plata", type: "Sportfisher", length: 58, beam: 17, weight: 44, reg: "MX 77 441" },
  { id: "v3", customerId: "c1", name: "Ocean Pearl", type: "Sailboat", length: 48, beam: 14, weight: 18, reg: "IMO 9255511" },
  { id: "v4", customerId: "c3", name: "Endeavor", type: "Trawler", length: 70, beam: 19, weight: 60, reg: "CA 9982 Z" },
];

const SERVICE_CATALOG = [
  { id: "s1", name: "Haul/Launch", rate: 12_50 },
  { id: "s2", name: "Labor – Mechanical", rate: 1_25_00 },
  { id: "s3", name: "Materials", rate: 1_00 },
  { id: "s4", name: "Environmental Fee", rate: 75_00 },
];

const DEMO_INVOICES = [
  { id: "i1009", number: "MG-1009", customerId: "c1", vesselId: "v1", totalCents: 183450, status: "Draft", date: "2025-09-14" },
  { id: "i1008", number: "MG-1008", customerId: "c2", vesselId: "v2", totalCents: 93250, status: "Sent", date: "2025-09-12" },
  { id: "i1007", number: "MG-1007", customerId: "c1", vesselId: "v3", totalCents: 221500, status: "Approved", date: "2025-09-10" },
  { id: "i1006", number: "MG-1006", customerId: "c3", vesselId: "v4", totalCents: 47500, status: "Paid", date: "2025-09-01" },
];

// Helpers to format currency (cents -> $)
const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (cents) => fmt.format((cents || 0) / 100);

// --- Small UI primitives ----------------------------------------------------
function Badge({ children }) {
  return <span className="inline-flex items-center rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{children}</span>;
}

function StatusBadge({ status }) {
  const map = {
    Draft: "bg-zinc-800 text-zinc-200 border-zinc-700",
    Sent: "bg-indigo-900/40 text-indigo-200 border-indigo-600/30",
    Approved: "bg-emerald-900/40 text-emerald-200 border-emerald-600/30",
    Paid: "bg-teal-900/40 text-teal-200 border-teal-600/30",
    Overdue: "bg-rose-900/40 text-rose-200 border-rose-600/30",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[status] || "bg-zinc-900 text-zinc-300 border-zinc-700"}`}>{status}</span>;
}

function Card({ title, children, right }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={"w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500 " + className}
      {...props}
    />
  );
}

function Select({ className = "", children, ...props }) {
  return (
    <select
      className={"w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500 " + className}
      {...props}
    >
      {children}
    </select>
  );
}

function Button({ children, className = "", variant = "primary", ...props }) {
  const base = "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium shadow-sm focus:outline-none";
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white",
    ghost: "bg-transparent text-zinc-200 hover:bg-zinc-800 border border-zinc-700",
    subtle: "bg-zinc-800 hover:bg-zinc-700 text-zinc-100",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute left-1/2 top-16 w-[720px] -translate-x-1/2 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="text-sm font-medium text-zinc-200">{title}</div>
          <button className="text-zinc-400 hover:text-zinc-200" onClick={onClose}>✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Drawer({ open, onClose, title, children }) {
  return (
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside className={`absolute left-0 top-0 h-full w-[300px] transform border-r border-zinc-800 bg-zinc-950 shadow-xl transition-transform ${open ? "-translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="text-sm font-medium text-zinc-200">{title}</div>
          <button className="text-zinc-400 hover:text-zinc-200" onClick={onClose}>✕</button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </aside>
    </div>
  );
}

// --- Left sidebar nav (no stacked horizontal menus) ------------------------
function Sidebar({ active, onChange, onNew }) {
  const items = [
    { key: "Invoices", icon: "🧾" },
    { key: "Customers", icon: "👤" },
    { key: "Vessels", icon: "🛥️" },
    { key: "Reports", icon: "📈" },
    { key: "Settings", icon: "⚙️" },
  ];
  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-[72px] border-r border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="flex h-14 items-center justify-center border-b border-zinc-800">
        <div className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-bold text-white">MG</div>
      </div>
      <nav className="flex flex-col items-center gap-2 p-2">
        {items.map((it) => (
          <button
            key={it.key}
            title={it.key}
            onClick={() => onChange(it.key)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${active === it.key ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"}`}
          >
            <span aria-hidden>{it.icon}</span>
          </button>
        ))}
      </nav>
      <div className="absolute bottom-3 left-0 right-0 p-2">
        <Button variant="primary" className="w-full !px-0 !py-2 text-xs" onClick={onNew}>New</Button>
      </div>
    </aside>
  );
}

// --- Invoices Index Page ----------------------------------------------------
function InvoicesPage({ onOpen, onNew }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const filtered = useMemo(() => {
    return DEMO_INVOICES.filter((inv) => {
      const customer = DEMO_CUSTOMERS.find((c) => c.id === inv.customerId);
      const vessel = DEMO_VESSELS.find((v) => v.id === inv.vesselId);
      const hay = [inv.number, customer?.name, vessel?.name, inv.status].join(" ").toLowerCase();
      const passQ = hay.includes(q.toLowerCase());
      const passS = status === "All" || inv.status === status;
      return passQ && passS;
    }).sort((a,b) => b.date.localeCompare(a.date));
  }, [q, status]);

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input placeholder="Search invoice #, customer, vessel…" value={q} onChange={(e) => setQ(e.target.value)} className="w-96" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option>All</option>
            <option>Draft</option>
            <option>Sent</option>
            <option>Approved</option>
            <option>Paid</option>
            <option>Overdue</option>
          </Select>
        </div>
        <Button variant="primary" onClick={onNew}>+ New Invoice</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50 text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Invoice</th>
              <th className="px-4 py-3 text-left font-medium">Customer</th>
              <th className="px-4 py-3 text-left font-medium">Vessel</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => {
              const customer = DEMO_CUSTOMERS.find((c) => c.id === inv.customerId);
              const vessel = DEMO_VESSELS.find((v) => v.id === inv.vesselId);
              return (
                <tr key={inv.id} className="border-t border-zinc-800 text-zinc-200">
                  <td className="px-4 py-3">{inv.number}</td>
                  <td className="px-4 py-3">{customer?.name}</td>
                  <td className="px-4 py-3">{vessel?.name}</td>
                  <td className="px-4 py-3">{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-right">{money(inv.totalCents)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" className="mr-2" onClick={() => onOpen(inv)}>Open</Button>
                    <Button variant="ghost">PDF</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Customers & Vessels Pages ---------------------------------------------
function CustomersPage({ onSelectForInvoice }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => DEMO_CUSTOMERS.filter((c) =>
    [c.name, c.email, c.phone].join(" ").toLowerCase().includes(q.toLowerCase())
  ), [q]);
  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Customers</h2>
        <div className="flex items-center gap-2">
          <Input placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button variant="primary">+ New Customer</Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50 text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-zinc-800 text-zinc-200">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3">{c.email}</td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" className="mr-2">View</Button>
                  <Button variant="primary" onClick={() => onSelectForInvoice(c)}>Create Invoice</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VesselsPage() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => DEMO_VESSELS.filter((v) =>
    [v.name, v.type, v.reg].join(" ").toLowerCase().includes(q.toLowerCase())
  ), [q]);
  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Vessels</h2>
        <div className="flex items-center gap-2">
          <Input placeholder="Search vessels…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button variant="primary">+ New Vessel</Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50 text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Owner</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Length</th>
              <th className="px-4 py-3 text-left font-medium">Beam</th>
              <th className="px-4 py-3 text-left font-medium">Reg</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const owner = DEMO_CUSTOMERS.find((c) => c.id === v.customerId);
              return (
                <tr key={v.id} className="border-t border-zinc-800 text-zinc-200">
                  <td className="px-4 py-3">{v.name}</td>
                  <td className="px-4 py-3">{owner?.name}</td>
                  <td className="px-4 py-3">{v.type}</td>
                  <td className="px-4 py-3">{v.length} ft</td>
                  <td className="px-4 py-3">{v.beam} ft</td>
                  <td className="px-4 py-3">{v.reg}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Invoice Editor ---------------------------------------------------------
function InvoiceEditor({ seedCustomer, seedVessel }) {
  const [showPreview, setShowPreview] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [vesselPickerOpen, setVesselPickerOpen] = useState(false);

  const [customer, setCustomer] = useState(seedCustomer || null);
  const [vessel, setVessel] = useState(seedVessel || null);
  const [lineItems, setLineItems] = useState([]);
  const [notes, setNotes] = useState("");

  const subtotal = lineItems.reduce((sum, li) => sum + li.qty * li.rate, 0);
  const taxRate = customer?.taxStatus?.includes("Taxable") ? 0.0875 : 0; // demo only
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;

  const customerVessels = useMemo(() => DEMO_VESSELS.filter((v) => !customer || v.customerId === customer.id), [customer]);

  return (
    <div className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-6 p-6 xl:grid-cols-[380px_1fr_1fr]">
      {/* Column A: vertical stepper inspector */}
      <div className="space-y-4">
        <VerticalStepper>
          <Step title="Customer" cta={<Button variant="ghost" onClick={() => setCustomerPickerOpen(true)}>Select</Button>}>
            {customer ? (
              <div className="space-y-2 text-sm text-zinc-200">
                <div className="text-base font-medium">{customer.name}</div>
                <div className="text-zinc-400">{customer.email} • {customer.phone}</div>
                <div className="text-zinc-400">{customer.address}</div>
                <div className="flex gap-2 pt-1">
                  <Badge>{customer.terms}</Badge>
                  <Badge>{customer.taxStatus}</Badge>
                  {customer.defaultMarkup ? <Badge>Markup {customer.defaultMarkup}%</Badge> : null}
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-400">No customer selected. Use Select to search.</div>
            )}
          </Step>
          <Step title="Vessel" cta={<Button variant="ghost" onClick={() => setVesselPickerOpen(true)}>Select</Button>}>
            {vessel ? (
              <div className="space-y-1 text-sm text-zinc-200">
                <div className="text-base font-medium">{vessel.name} <span className="text-zinc-400">· {vessel.type}</span></div>
                <div className="text-zinc-400">{vessel.length} ft • {vessel.beam} ft • {vessel.weight} tons</div>
                <div className="text-zinc-400">Reg: {vessel.reg}</div>
              </div>
            ) : (
              <div className="text-sm text-zinc-400">Select a vessel {customer ? "(scoped to customer)" : ""}.</div>
            )}
          </Step>
          <Step title="Notes & Terms">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} placeholder="Notes visible to the customer…" className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500" />
          </Step>
        </VerticalStepper>

        <Card title="Actions">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Save</Button>
            <Button variant="subtle">Save & Send</Button>
            <Button variant="ghost">PDF</Button>
            <Button variant="ghost">Print</Button>
            <button className="ml-auto rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800" onClick={() => setCommentsOpen(true)}>Comments</button>
          </div>
        </Card>
      </div>

      {/* Column B: services editor */}
      <div className="space-y-4">
        <Card title="Services" right={<Button variant="primary" onClick={() => setLineItems((l) => [...l, { id: Math.random().toString(36), name: "", qty: 1, rate: 0 }])}>+ Add Line</Button>}>
          <div className="space-y-3">
            {lineItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">Add items from the catalog or create custom lines.</div>
            )}
            {lineItems.map((li) => (
              <div key={li.id} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="col-span-5"><Input placeholder="Description" value={li.name} onChange={(e) => updateLine(lineItems, setLineItems, li.id, { name: e.target.value })} /></div>
                <div className="col-span-2"><Input type="number" min={0} step="1" value={li.qty} onChange={(e) => updateLine(lineItems, setLineItems, li.id, { qty: Number(e.target.value) })} /></div>
                <div className="col-span-3"><Input type="number" min={0} step="1" value={li.rate} onChange={(e) => updateLine(lineItems, setLineItems, li.id, { rate: Number(e.target.value) })} /></div>
                <div className="col-span-1 text-right text-sm text-zinc-200">{money(li.qty * li.rate)}</div>
                <div className="col-span-1 text-right"><button onClick={() => setLineItems(lineItems.filter((x) => x.id !== li.id))} className="text-zinc-400 hover:text-red-400">✕</button></div>
                <div className="col-span-12">
                  <div className="flex items-center gap-2">
                    <Select value={li.catalogId || ""} onChange={(e) => updateLine(lineItems, setLineItems, li.id, { catalogId: e.target.value, name: SERVICE_CATALOG.find((s) => s.id === e.target.value)?.name || li.name, rate: SERVICE_CATALOG.find((s) => s.id === e.target.value)?.rate || li.rate })}>
                      <option value="">Add from catalog…</option>
                      {SERVICE_CATALOG.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({money(s.rate)})</option>
                      ))}
                    </Select>
                    <div className="ml-auto flex items-center gap-2">
                      <Badge>Taxable?</Badge>
                      <Badge>Markup {customer?.defaultMarkup ?? 0}%</Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Column C: preview & summary */}
      <div className="space-y-4">
        <Card title={<div className="flex items-center gap-2"><span>Invoice Preview</span><Badge>Draft</Badge></div>} right={<Button variant="ghost" onClick={() => setShowPreview((s) => !s)}>{showPreview ? "Hide" : "Show"}</Button>}>
          {showPreview ? (
            <InvoicePreview customer={customer} vessel={vessel} items={lineItems} notes={notes} subtotal={subtotal} tax={tax} total={total} />
          ) : (
            <div className="text-sm text-zinc-400">Preview hidden.</div>
          )}
        </Card>
        <Card title="Summary">
          <div className="grid grid-cols-2 gap-3 text-sm text-zinc-200">
            <div className="space-y-1"><div className="text-zinc-400">Subtotal</div><div className="text-base">{money(subtotal)}</div></div>
            <div className="space-y-1"><div className="text-zinc-400">Tax</div><div className="text-base">{money(tax)}</div></div>
            <div className="col-span-2 mt-2 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="text-zinc-400">Total</div>
              <div className="text-lg font-semibold">{money(total)}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Pickers & comments */}
      <Modal open={customerPickerOpen} onClose={() => setCustomerPickerOpen(false)} title="Select Customer">
        <CustomerPicker onSelect={(c) => { setCustomer(c); setCustomerPickerOpen(false); }} />
      </Modal>
      <Modal open={vesselPickerOpen} onClose={() => setVesselPickerOpen(false)} title="Select Vessel">
        <VesselPicker list={customerVessels} onSelect={(v) => { setVessel(v); setVesselPickerOpen(false); }} />
      </Modal>
      <Drawer open={commentsOpen} onClose={() => setCommentsOpen(false)} title="Comments">
        <Input placeholder="Add a comment…" />
        <div className="space-y-3 text-sm"><div className="rounded-xl border border-zinc-800 p-3 text-zinc-300">Please confirm tax status for Cabo Charters.</div></div>
      </Drawer>
    </div>
  );
}

function VerticalStepper({ children }) {
  return (
    <div className="space-y-4">
      {React.Children.map(children, (child, idx) => (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-zinc-200">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xs">{idx + 1}</span>
              <span className="font-medium">{child.props.title}</span>
            </div>
            <div>{child.props.cta}</div>
          </div>
          <div className="p-4">{child}</div>
        </div>
      ))}
    </div>
  );
}

function Step({ children }) { return <>{children}</>; }

function updateLine(list, setList, id, patch) {
  setList(list.map((li) => (li.id === id ? { ...li, ...patch } : li)));
}

function CustomerPicker({ onSelect }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => DEMO_CUSTOMERS.filter((c) => [c.name, c.email, c.phone].join(" ").toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <div className="space-y-3">
      <Input autoFocus placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-80 overflow-auto rounded-xl border border-zinc-800">
        {filtered.map((c) => (
          <div key={c.id} className="flex items-center justify-between border-b border-zinc-800 p-3 last:border-0">
            <div>
              <div className="font-medium text-zinc-100">{c.name}</div>
              <div className="text-xs text-zinc-400">{c.email} • {c.phone}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost">Open</Button>
              <Button variant="primary" onClick={() => onSelect(c)}>Select</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-zinc-500">Can't find them? <button className="underline">Create new customer</button></div>
    </div>
  );
}

function VesselPicker({ list, onSelect }) {
  const [q, setQ] = useState("");
  const available = list?.length ? list : DEMO_VESSELS;
  const filtered = useMemo(() => available.filter((v) => [v.name, v.type, v.reg].join(" ").toLowerCase().includes(q.toLowerCase())), [q, available]);
  return (
    <div className="space-y-3">
      <Input autoFocus placeholder="Search name, type, reg…" value={q} onChange={(e) => setQ(e.target.value)} />
      {list?.length ? (
        <div className="text-xs text-zinc-400">Showing vessels for the selected customer.</div>
      ) : (
        <div className="text-xs text-zinc-400">No customer selected—showing all vessels.</div>
      )}
      <div className="max-h-80 overflow-auto rounded-xl border border-zinc-800">
        {filtered.map((v) => (
          <div key={v.id} className="flex items-center justify-between border-b border-zinc-800 p-3 last:border-0">
            <div>
              <div className="font-medium text-zinc-100">{v.name} <span className="text-zinc-400">· {v.type}</span></div>
              <div className="text-xs text-zinc-400">{v.length} ft • {v.beam} ft • Reg {v.reg}</div>
            </div>
            <Button variant="primary" onClick={() => onSelect(v)}>Select</Button>
          </div>
        ))}
      </div>
      <div className="text-xs text-zinc-500">Need a new vessel? <button className="underline">Quick create</button></div>
    </div>
  );
}

function InvoicePreview({ customer, vessel, items, notes, subtotal, tax, total }) {
  return (
    <div className="mx-auto w-full max-w-[700px] rounded-2xl border border-zinc-800 bg-white p-8 text-zinc-900">
      <div className="text-center">
        <div className="mb-1 text-xs tracking-widest text-zinc-500">MG GLOBAL SERVICES</div>
        <div className="text-2xl font-semibold">Invoice Request Form</div>
        <div className="mt-1 text-xs text-zinc-500">Date: {new Date().toLocaleDateString()}</div>
      </div>
      <div className="mt-6 grid gap-4">
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="text-xs font-semibold text-zinc-600">VESSEL DETAILS</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>Vessel: <span className="font-medium">{vessel?.name || "–"}</span></div>
            <div>Weight: <span className="font-medium">{vessel?.weight ? `${vessel.weight} tons` : "–"}</span></div>
            <div>Beam: <span className="font-medium">{vessel?.beam ? `${vessel.beam} ft` : "–"}</span></div>
            <div>Reg: <span className="font-medium">{vessel?.reg || "–"}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="text-xs font-semibold text-zinc-600">CUSTOMER INFORMATION</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>Customer: <span className="font-medium">{customer?.name || "–"}</span></div>
            <div>Estimator: <span className="font-medium">Test User</span></div>
            <div>Email: <span className="font-medium">{customer?.email || "–"}</span></div>
            <div>Phone: <span className="font-medium">{customer?.phone || "–"}</span></div>
            <div className="col-span-2">Address: <span className="font-medium">{customer?.address || "–"}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="text-xs font-semibold text-zinc-600">SERVICES</div>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-1">Description</th>
                <th className="py-1">Qty</th>
                <th className="py-1">Rate</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((li) => (
                  <tr key={li.id} className="border-t">
                    <td className="py-1">{li.name || "—"}</td>
                    <td className="py-1">{li.qty}</td>
                    <td className="py-1">{money(li.rate)}</td>
                    <td className="py-1 text-right">{money(li.qty * li.rate)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-2 text-zinc-400" colSpan={4}>No line items yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-3 ml-auto w-64 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{money(tax)}</span></div>
            <div className="mt-1 h-px bg-zinc-200" />
            <div className="mt-1 flex justify-between font-semibold"><span>Total</span><span>{money(total)}</span></div>
          </div>
        </div>
        {notes ? (
          <div className="rounded-xl border border-zinc-200 p-4">
            <div className="text-xs font-semibold text-zinc-600">NOTES</div>
            <div className="mt-2 whitespace-pre-wrap text-sm">{notes}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function InvoiceUIMock() {
  const [active, setActive] = useState("Invoices");
  const [mode, setMode] = useState("index"); // index | editor
  const [seedCustomer, setSeedCustomer] = useState(null);
  const [seedVessel, setSeedVessel] = useState(null);

  const onNew = () => {
    setSeedCustomer(null); setSeedVessel(null); setActive("Invoices"); setMode("editor");
  };

  const onOpenInvoice = (inv) => {
    const c = DEMO_CUSTOMERS.find((x) => x.id === inv.customerId) || null;
    const v = DEMO_VESSELS.find((x) => x.id === inv.vesselId) || null;
    setSeedCustomer(c); setSeedVessel(v); setActive("Invoices"); setMode("editor");
  };

  return (
    <div className="min-h-screen bg-zinc-950 pl-[72px] text-zinc-100">
      <Sidebar active={active} onChange={(k) => { setActive(k); if (k === "Invoices") setMode("index"); }} onNew={onNew} />

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-screen-2xl items-center justify-between px-4">
          <div className="text-sm text-zinc-400">{active} <span className="mx-2">/</span> {active === "Invoices" ? (mode === "index" ? "List" : "Editor") : "Index"}</div>
          <div className="hidden items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 md:flex"><span className="mr-2 opacity-60">⌘K</span> Quick search</div>
        </div>
      </div>

      {active === "Invoices" && mode === "index" && (
        <InvoicesPage onOpen={onOpenInvoice} onNew={onNew} />
      )}

      {active === "Invoices" && mode === "editor" && (
        <InvoiceEditor seedCustomer={seedCustomer} seedVessel={seedVessel} />
      )}

      {active === "Customers" && (
        <div className="mx-auto max-w-screen-2xl p-6">
          <CustomersPage onSelectForInvoice={(c) => { setSeedCustomer(c); setSeedVessel(null); setActive("Invoices"); setMode("editor"); }} />
        </div>
      )}

      {active === "Vessels" && (
        <div className="mx-auto max-w-screen-2xl p-6">
          <VesselsPage />
        </div>
      )}
    </div>
  );
}
