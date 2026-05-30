import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  // 🔐 Auth
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);

  // 📊 Dashboard State
  const [activeTab, setActiveTab] = useState('customers');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportPeriod, setReportPeriod] = useState('month');
  const [bookingsFilter, setBookingsFilter] = useState('');

  // 📦 Data
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bills, setBills] = useState([]);

  // 📝 Forms
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [newAppointment, setNewAppointment] = useState({ customerId: '', serviceId: '', time: '' });
  const [newSupplier, setNewSupplier] = useState({ name: '', contact: '' });
  const [newBill, setNewBill] = useState({ supplier_id: '', supplier_name: '', amount: '', description: '', bill_date: new Date().toISOString().split('T')[0], category: 'other', payment_method: 'cash' });
  const [newService, setNewService] = useState({ name: '', price: '', duration: '', effective_from: new Date().toISOString().split('T')[0] });
  const [editingService, setEditingService] = useState(null);

  // 💰 Opening Balances (Persisted in LocalStorage)
  const [openingCash, setOpeningCash] = useState(() => parseFloat(localStorage.getItem('salon_opening_cash') || '0'));
  const [openingBank, setOpeningBank] = useState(() => parseFloat(localStorage.getItem('salon_opening_bank') || '0'));

  useEffect(() => { localStorage.setItem('salon_opening_cash', openingCash); }, [openingCash]);
  useEffect(() => { localStorage.setItem('salon_opening_bank', openingBank); }, [openingBank]);

  // 🛒 POS
  const [posForm, setPosForm] = useState({
    customerType: 'list', customerId: '', walkinName: '',
    items: [{ serviceId: '', qty: 1 }], paymentMethod: 'cash', amountTendered: ''
  });

  // 🔐 Auth Handlers
  const handleAuth = async (e) => {
    e.preventDefault(); setAuthError(null);
    try {
      const authEmail = username.includes('@') ? username : `${username}@salon.local`;
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: authEmail, password, options: { data: { username } } });
        if (error) throw error; setAuthMode('login'); setAuthError('✅ Account created! Please log in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
        if (error) throw error;
      }
      setUsername(''); setPassword('');
    } catch (err) { setAuthError(err.message || 'Authentication failed'); }
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCustomers([]); setServices([]); setAppointments([]); setInvoices([]); setSuppliers([]); setBills([]);
  };

  // 🔌 Init & Fetch
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); if (session) fetchData(); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); if (session) fetchData(); });
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cust, svc, apt, inv, sup, bil] = await Promise.all([
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('services').select('*').order('name'),
        supabase.from('appointments').select('*').order('time', { ascending: true }),
        supabase.from('invoices').select('*').order('issued_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('supplier_bills').select('*').order('bill_date', { ascending: false })
      ]);
      [cust, svc, apt, inv, sup, bil].forEach(res => { if (res.error) throw res.error; });
      setCustomers(cust.data || []);
      setServices(svc.data || []);
      setAppointments(apt.data || []);
      setInvoices((inv.data || []).map(i => ({ ...i, items: typeof i.items === 'string' ? JSON.parse(i.items) : (i.items || []) })));
      setSuppliers(sup.data || []);
      setBills(bil.data || []);
    } catch (err) { setError('Failed to load data: ' + err.message); }
    finally { setIsLoading(false); }
  };

  // 👤 Customers CRUD
  const handleAddCustomer = async (e) => {
    e.preventDefault(); if (!newCustomer.name || !newCustomer.phone) return;
    setIsLoading(true);
    try { const { error } = await supabase.from('customers').insert([newCustomer]); if (error) throw error; await fetchData(); setNewCustomer({ name: '', phone: '' }); }
    catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };
  const handleEditCustomer = async (id) => {
    const c = customers.find(x => x.id === id); if (!c) return;
    const name = prompt('Name:', c.name); const phone = prompt('Phone:', c.phone); if (name === null || phone === null) return;
    setIsLoading(true); try { const { error } = await supabase.from('customers').update({ name, phone }).eq('id', id); if (error) throw error; await fetchData(); } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };
  const handleDeleteCustomer = async (id) => {
    if (!window.confirm('Delete this customer?')) return; setIsLoading(true);
    try { const { error } = await supabase.from('customers').delete().eq('id', id); if (error) throw error; await fetchData(); } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  // 📅 Bookings
  const handleBookAppointment = async (e) => {
    e.preventDefault(); if (!newAppointment.customerId || !newAppointment.serviceId || !newAppointment.time) return;
    setIsLoading(true);
    try {
      const cust = customers.find(c => c.id === Number(newAppointment.customerId));
      const svc = services.find(s => s.id === Number(newAppointment.serviceId));
      const { error } = await supabase.from('appointments').insert({ customer_id: Number(newAppointment.customerId), service_id: Number(newAppointment.serviceId), customer_name: cust?.name, service_name: svc?.name, price: svc?.price, time: newAppointment.time, status: 'booked' });
      if (error) throw error; await fetchData(); setNewAppointment({ customerId: '', serviceId: '', time: '' });
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };
  const handleStatusChange = async (id, status) => {
    try { const apt = appointments.find(a => a.id === id); const { error } = await supabase.from('appointments').update({ status }).eq('id', id); if (error) throw error;
      if (status === 'completed' && apt?.price) {
        if (!invoices.some(inv => inv.appointment_id === id)) await supabase.from('invoices').insert({ appointment_id: id, customer_name: apt.customer_name, service_name: apt.service_name, total_amount: apt.price, status: 'paid', items: JSON.stringify([{ service: apt.service_name, qty: 1, price: apt.price }]) });
      }
      await fetchData();
    } catch (err) { setError(err.message); }
  };

  // ⚙️ Services CRUD
  const handleAddService = async (e) => {
    e.preventDefault(); if (!newService.name || !newService.price || !newService.duration) return setError('Name, price & duration required');
    setIsLoading(true);
    try { const { error } = await supabase.from('services').insert({ name: newService.name, price: Number(newService.price), duration: Number(newService.duration), price_effective_from: newService.effective_from }); if (error) throw error; await fetchData(); setNewService({ name: '', price: '', duration: '', effective_from: new Date().toISOString().split('T')[0] }); }
    catch (err) { setError('Failed: ' + err.message); } finally { setIsLoading(false); }
  };
  const handleUpdateService = async (e) => {
    e.preventDefault(); if (!editingService) return;
    setIsLoading(true);
    try { const { error } = await supabase.from('services').update({ name: editingService.name, price: Number(editingService.price), duration: Number(editingService.duration), price_effective_from: editingService.effective_from }).eq('id', editingService.id); if (error) throw error; await fetchData(); setEditingService(null); }
    catch (err) { setError('Failed: ' + err.message); } finally { setIsLoading(false); }
  };
  const handleDeleteService = async (id) => {
    if (!window.confirm('Delete service?')) return; setIsLoading(true);
    try { const { error } = await supabase.from('services').delete().eq('id', id); if (error) throw error; await fetchData(); }
    catch (err) { setError('Failed: ' + err.message); } finally { setIsLoading(false); }
  };

  // 🏭 Suppliers & Expenses
  const handleAddSupplier = async (e) => {
    e.preventDefault(); if (!newSupplier.name) return;
    setIsLoading(true);
    try { const { error } = await supabase.from('suppliers').insert(newSupplier); if (error) throw error; await fetchData(); setNewSupplier({ name: '', contact: '' }); }
    catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };
  const handleAddBill = async (e) => {
    e.preventDefault();
    const finalName = newBill.supplier_name || (newBill.supplier_id ? suppliers.find(s => s.id == newBill.supplier_id)?.name : '');
    if (!finalName || !newBill.amount) return setError('Supplier name & amount required');
    setIsLoading(true);
    try {
      const { error } = await supabase.from('supplier_bills').insert({
        supplier_name: finalName,
        amount: Number(newBill.amount),
        description: newBill.description,
        bill_date: newBill.bill_date,
        category: newBill.category,
        payment_method: newBill.payment_method
      });
      if (error) throw error; await fetchData();
      setNewBill({ supplier_id: '', supplier_name: '', amount: '', description: '', bill_date: new Date().toISOString().split('T')[0], category: 'other', payment_method: 'cash' });
    } catch (err) { setError('Failed: ' + err.message); } finally { setIsLoading(false); }
  };

  // 🛒 POS Logic
  const posTotal = posForm.items.reduce((sum, item) => {
    const svc = services.find(s => s.id === Number(item.serviceId));
    const qty = Number(item.qty) || 0;
    return sum + (svc ? Number(svc.price) * qty : 0);
  }, 0);
  const posChange = posForm.paymentMethod === 'cash' ? Math.max(0, Number(posForm.amountTendered || 0) - posTotal) : 0;

  const updateItem = (index, field, value) => {
    const updated = [...posForm.items]; updated[index] = { ...updated[index], [field]: value };
    setPosForm({ ...posForm, items: updated });
  };
  const addItemLine = () => setPosForm({ ...posForm, items: [...posForm.items, { serviceId: '', qty: 1 }] });
  const removeItemLine = (index) => { if (posForm.items.length > 1) setPosForm({ ...posForm, items: posForm.items.filter((_, i) => i !== index) }); };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (posTotal === 0) return setError('Add services to create an invoice');
    if (posForm.paymentMethod === 'cash' && posChange < 0) return setError('Insufficient cash tendered');
    setIsLoading(true); setError(null);
    try {
      const itemsPayload = posForm.items.map(i => { const svc = services.find(s => s.id === Number(i.serviceId)); return { service: svc?.name || 'Unknown', qty: i.qty, price: svc?.price || 0 }; });
      const invData = {
        customer_name: posForm.customerType === 'walkin' ? 'Walk-in Customer' : (customers.find(c => c.id == posForm.customerId)?.name || 'Unknown'),
        items: JSON.stringify(itemsPayload), total_amount: posTotal, payment_method: posForm.paymentMethod,
        amount_tendered: posForm.paymentMethod === 'cash' ? Number(posForm.amountTendered) : posTotal, change_amount: posChange, status: 'paid'
      };
      const { error } = await supabase.from('invoices').insert(invData);
      if (error) throw error; await fetchData();
      setPosForm({ customerType: 'list', customerId: '', walkinName: '', items: [{ serviceId: '', qty: 1 }], paymentMethod: 'cash', amountTendered: '' });
    } catch (err) { setError('Failed to create invoice: ' + err.message); } finally { setIsLoading(false); }
  };

  // 🖨️ Print Receipt
  const printInvoice = (inv) => {
    const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice #${inv.id}</title>
      <style>body{font-family:monospace;width:320px;margin:0 auto;padding:10px}h1,h3{text-align:center;margin:5px 0}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:4px 0;font-size:0.9rem}.total{font-weight:bold;font-size:1.2rem;margin-top:8px;text-align:right}@media print{body{margin:0}}</style></head><body>
      <h1>✂️ Salon Manager</h1><h3>Invoice #${inv.id}</h3>
      <div class="row"><span>Date:</span><span>${new Date(inv.issued_at).toLocaleDateString()}</span></div>
      <div class="row"><span>Customer:</span><span>${inv.customer_name}</span></div><div class="line"></div>
      ${items.map(i => `<div class="row"><span>${i.qty}x ${i.service}</span><span>$${(i.price * i.qty).toFixed(2)}</span></div>`).join('')}
      <div class="line"></div>
      <div class="row"><span>Total:</span><span>$${inv.total_amount.toFixed(2)}</span></div>
      ${inv.payment_method === 'cash' ? `<div class="row"><span>Cash:</span><span>$${inv.amount_tendered?.toFixed(2) || '0.00'}</span></div><div class="total"><span>Change:</span><span>$${inv.change_amount?.toFixed(2) || '0.00'}</span></div>` : `<div class="row"><span>Method:</span><span>${inv.payment_method.toUpperCase()}</span></div>`}
      <div class="line"></div><p style="text-align:center;margin-top:15px;font-size:0.85rem">PAID • Thank you! ❤️</p><script>window.print();window.close()</script></body></html>`);
  };

  // 📄 Print Financial Statement
  const printFinancialStatement = () => {
    const now = new Date();
    const y = now.getFullYear().toString();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const revenue = invoices.filter(inv => {
      if (inv.status !== 'paid' || !inv.issued_at) return false;
      const [invY, invM, invD] = inv.issued_at.split('-');
      if (reportPeriod === 'year' && invY === y) return true;
      if (reportPeriod === 'month' && invY === y && invM === m) return true;
      if (reportPeriod === 'day' && invY === y && invM === m && invD === d) return true;
      return false;
    }).reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const materialCost = bills.filter(b => b.category === 'materials').reduce((s,b)=>s+Number(b.amount||0),0);
    const labourCost = bills.filter(b => b.category === 'labour').reduce((s,b)=>s+Number(b.amount||0),0);
    const otherExp = bills.filter(b=>!['materials','labour'].includes(b.category)).reduce((s,b)=>s+Number(b.amount||0),0);
    const gross = revenue - materialCost - labourCost;
    const net = gross - otherExp;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Financial Statement</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px}h1{text-align:center;color:#1e3a8a;border-bottom:3px solid #1e3a8a;padding-bottom:10px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9}.total{font-weight:bold;font-size:1.1em;background:#f8fafc;padding:10px;margin-top:10px}.net{background:#dcfce7;font-size:1.3em;font-weight:bold;padding:12px}@media print{body{margin:0}}</style></head><body>
      <h1>✂️ Salon Manager<br/>Financial Statement</h1><p style="text-align:center;color:#64748b">${reportPeriod}: ${now.toLocaleDateString()}</p>
      <div class="row"><span>Total Revenue</span><span>$${revenue.toFixed(2)}</span></div>
      <div class="row"><span>Materials Cost</span><span>-$${materialCost.toFixed(2)}</span></div>
      <div class="row"><span>Labour Cost</span><span>-$${labourCost.toFixed(2)}</span></div>
      <div class="total"><span>Gross Profit</span><span>$${gross.toFixed(2)}</span></div>
      <div class="row"><span>Other Expenses</span><span>-$${otherExp.toFixed(2)}</span></div>
      <div class="net"><span>Net Profit</span><span>$${net.toFixed(2)}</span></div>
      <script>window.print();window.close()</script></body></html>`);
  };

  // 📊 P&L Reports
  const getPnL = () => {
    const now = new Date();
    const y = now.getFullYear().toString();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const revenue = invoices.reduce((sum, inv) => {
      if (inv.status !== 'paid' || !inv.issued_at) return sum;
      const [invY, invM, invD] = inv.issued_at.split('-');
      if (reportPeriod === 'year' && invY === y) return sum + Number(inv.total_amount || 0);
      if (reportPeriod === 'month' && invY === y && invM === m) return sum + Number(inv.total_amount || 0);
      if (reportPeriod === 'day' && invY === y && invM === m && invD === d) return sum + Number(inv.total_amount || 0);
      return sum;
    }, 0);
    const expenses = bills.reduce((sum, b) => {
      if (!b.bill_date) return sum;
      const [bY, bM, bD] = b.bill_date.split('-');
      if (reportPeriod === 'year' && bY === y) return sum + Number(b.amount || 0);
      if (reportPeriod === 'month' && bY === y && bM === m) return sum + Number(b.amount || 0);
      if (reportPeriod === 'day' && bY === y && bM === m && bD === d) return sum + Number(b.amount || 0);
      return sum;
    }, 0);
    return { revenue, expenses, profit: revenue - expenses };
  };

  // 💵 Auto-Generate Cash Book & Bank Ledger
  const accountingData = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear().toString();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const inPeriod = (dateStr) => {
      if (!dateStr) return false;
      const [ty, tm, td] = dateStr.split('T')[0].split('-');
      if (reportPeriod === 'year') return ty === y;
      if (reportPeriod === 'month') return ty === y && tm === m;
      if (reportPeriod === 'day') return ty === y && tm === m && td === d;
      return true;
    };

    const processLedger = (paymentFilter, openingBalance) => {
      let txns = [], totalIn = 0, totalOut = 0;
      // Income (Invoices)
      invoices.filter(inv => inv.status === 'paid' && inv.payment_method === paymentFilter && inPeriod(inv.issued_at)).forEach(inv => {
        const amt = Number(inv.total_amount || 0);
        totalIn += amt;
        txns.push({ date: inv.issued_at.split('T')[0], desc: `INV #${inv.id} • ${inv.customer_name}`, amount: amt, type: 'income', ref: inv.id });
      });
      // Expenses (Bills)
      bills.filter(b => b.payment_method === paymentFilter && inPeriod(b.bill_date)).forEach(b => {
        const amt = Number(b.amount || 0);
        totalOut += amt;
        txns.push({ date: b.bill_date, desc: `BILL • ${b.supplier_name} (${b.category})`, amount: amt, type: 'expense', ref: b.id });
      });
      txns.sort((a,b) => new Date(a.date) - new Date(b.date));
      let runBal = openingBalance;
      txns = txns.map(t => { runBal += (t.type === 'income' ? t.amount : -t.amount); return { ...t, balance: runBal }; });
      return { txns, totalIn, totalOut, closing: openingBalance + totalIn - totalOut };
    };

    return {
      cash: processLedger('cash', openingCash),
      bank: processLedger('bank_transfer', openingBank)
    };
  }, [invoices, bills, reportPeriod, openingCash, openingBank]);

  const pnl = getPnL();

  // 🔐 Login Screen
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
        <form onSubmit={handleAuth} style={{ background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', width: '100%', maxWidth: '340px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>✂️ Salon {authMode === 'login' ? 'Login' : 'Create Account'}</h2>
          {authError && <div style={{ background: authError.includes('✅') ? '#dcfce7' : '#fef2f2', color: authError.includes('✅') ? '#166534' : '#dc2626', padding: '8px', borderRadius: '6px', marginBottom: '10px', fontSize: '0.85rem' }}>{authError}</div>}
          <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
          <button type="submit" style={{ width: '100%', padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', marginBottom: '10px', fontWeight: '600' }}>{authMode === 'login' ? 'Sign In' : 'Create Account'}</button>
          <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(null); setUsername(''); setPassword(''); }} style={{ width: '100%', padding: '8px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>{authMode === 'login' ? 'Need account? Sign Up' : 'Have one? Sign In'}</button>
        </form>
      </div>
    );
  }

  // 📊 Dashboard
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
      <div style={{ background: '#1e3a8a', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <span style={{ fontSize: '2.2rem' }}>✂️</span>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#ffffff', fontWeight: '700' }}>Salon Manager</h1>
        <button onClick={handleLogout} style={{ marginLeft: 'auto', padding: '6px 14px', background: '#dc2626', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>🚪 Logout</button>
      </div>
      
      <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
        {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>⚠️ {error}</div>}
        {isLoading && <div style={{ textAlign: 'center', padding: '10px', color: '#64748b' }}>⏳ Syncing...</div>}
        
        <nav style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', flexWrap: 'wrap', overflowX: 'auto' }}>
          {['customers', 'bookings', 'pos', 'invoices', 'services', 'suppliers', 'expenses', 'cashbook', 'bank', 'statements'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 12px', background: activeTab === tab ? '#3b82f6' : '#f1f5f9', color: activeTab === tab ? '#fff' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: activeTab === tab ? '600' : '400', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
          ))}
        </nav>

        <main>
          {/* 👥 Customers */}
          {activeTab === 'customers' && <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
            <h2>👥 Customers ({customers.length})</h2>
            {customers.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                <div><strong style={{ fontSize: '1rem', color: '#0f172a' }}>{c.name}</strong><div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>{c.phone}</div></div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                  <button onClick={() => handleEditCustomer(c.id)} style={{ background: '#fff', color: '#d97706', border: '1px solid #fbbf24', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>✏️ Edit</button>
                  <button onClick={() => handleDeleteCustomer(c.id)} style={{ background: '#fff', color: '#dc2626', border: '1px solid #f87171', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>🗑️ Delete</button>
                </div>
              </div>
            ))}
            <form onSubmit={handleAddCustomer} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
              <input value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="Name" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
              <input value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder="Phone" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
              <button type="submit" disabled={isLoading} style={{ padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{isLoading ? 'Saving...' : '+ Add Customer'}</button>
            </form>
          </div>}

          {/* 📅 Bookings */}
          {activeTab === 'bookings' && <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
            <h2>📅 Bookings</h2>
            <form onSubmit={handleBookAppointment} style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              <select value={newAppointment.customerId} onChange={e => setNewAppointment({...newAppointment, customerId: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select value={newAppointment.serviceId} onChange={e => setNewAppointment({...newAppointment, serviceId: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Service</option>{services.map(s => <option key={s.id} value={s.id}>{s.name} (${s.price})</option>)}</select>
              <input type="datetime-local" value={newAppointment.time} onChange={e => setNewAppointment({...newAppointment, time: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button type="submit" disabled={isLoading || !services.length} style={{ padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>✅ Book</button>
            </form>
            <div style={{ marginTop: '1rem' }}>
              <input placeholder="🔍 Filter by customer or service..." value={bookingsFilter} onChange={e => setBookingsFilter(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', background: '#fff' }} />
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {appointments.filter(a => a.customer_name?.toLowerCase().includes(bookingsFilter.toLowerCase()) || a.service_name?.toLowerCase().includes(bookingsFilter.toLowerCase())).map(a => <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}><div><strong>{a.customer_name}</strong> • {a.service_name}<div style={{ fontSize: '0.85rem', color: '#64748b' }}>{new Date(a.time).toLocaleString()}</div></div><select value={a.status} onChange={e => handleStatusChange(a.id, e.target.value)} style={{ padding: '6px', borderRadius: '20px', border: 'none', fontWeight: '600', fontSize: '0.8rem', background: a.status==='booked'?'#dbeafe':a.status==='completed'?'#dcfce7':'#fee2e2', color: a.status==='booked'?'#1d4ed8':a.status==='completed'?'#166534':'#991b1b' }}><option value="booked">BOOKED</option><option value="completed">COMPLETED</option><option value="cancelled">CANCELLED</option></select></div>)}
              </div>
            </div>
          </div>}

          {/* 🛒 POS */}
          {activeTab === 'pos' && <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
            <h2>🛒 New Invoice (POS)</h2>
            <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Customer</label>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                    <button type="button" onClick={() => setPosForm({...posForm, customerType: 'list'})} style={{ flex: 1, padding: '6px', background: posForm.customerType==='list'?'#3b82f6':'#e2e8f0', color: posForm.customerType==='list'?'#fff':'#333', border:'none', borderRadius:'6px 0 0 6px', cursor:'pointer' }}>List</button>
                    <button type="button" onClick={() => setPosForm({...posForm, customerType: 'walkin'})} style={{ flex: 1, padding: '6px', background: posForm.customerType==='walkin'?'#3b82f6':'#e2e8f0', color: posForm.customerType==='walkin'?'#fff':'#333', border:'none', borderRadius:'0 6px 6px 0', cursor:'pointer' }}>Walk-in</button>
                  </div>
                  {posForm.customerType === 'list' ? <select value={posForm.customerId} onChange={e => setPosForm({...posForm, customerId: e.target.value})} style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <input placeholder="Walk-in Name" value={posForm.walkinName} onChange={e => setPosForm({...posForm, walkinName: e.target.value})} style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />}
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Payment</label>
                  <select value={posForm.paymentMethod} onChange={e => setPosForm({...posForm, paymentMethod: e.target.value})} style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="cash">💵 Cash</option><option value="card">💳 Card</option><option value="transfer">🏦 Transfer</option></select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Services</label>
                {posForm.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', marginTop: '6px' }}>
                    <select value={item.serviceId} onChange={e => updateItem(idx, 'serviceId', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Service</option>{services.map(s => <option key={s.id} value={s.id}>{s.name} (${s.price})</option>)}</select>
                    <input type="tel" inputMode="numeric" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="button" onClick={() => removeItemLine(idx)} style={{ padding: '8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🗑️</button>
                  </div>
                ))}
                <button type="button" onClick={addItemLine} style={{ marginTop: '8px', padding: '6px 12px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>+ Add Line</button>
              </div>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Total:</span><strong>${posTotal.toFixed(2)}</strong></div>
                {posForm.paymentMethod === 'cash' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><input type="tel" inputMode="numeric" placeholder="Cash Tendered" value={posForm.amountTendered} onChange={e => setPosForm({...posForm, amountTendered: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} /><div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.8rem' }}>Change Due</div><strong style={{ fontSize: '1.2rem', color: posChange >= 0 ? '#166534' : '#dc2626' }}>${posChange.toFixed(2)}</strong></div></div>}
              </div>
              <button type="submit" disabled={isLoading || posTotal === 0} style={{ padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: '600' }}>{isLoading ? 'Processing...' : '✅ Complete Sale'}</button>
            </form>
          </div>}

          {/* 🧾 Invoices */}
          {activeTab === 'invoices' && <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
            <h2>📋 Invoices ({invoices.length})</h2>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {invoices.map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                  <div><strong>#{inv.id}</strong> • {inv.customer_name}<br/><span style={{ fontSize: '0.8rem', color: '#64748b' }}>{inv.payment_method.toUpperCase()} • {new Date(inv.issued_at).toLocaleDateString()}</span></div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600' }}>${inv.total_amount.toFixed(2)}</span>
                    <button onClick={() => printInvoice(inv)} style={{ padding: '6px 10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🖨️ Print</button>
                    <button onClick={() => { if(window.confirm('Delete?')) { supabase.from('invoices').delete().eq('id', inv.id).then(() => fetchData()); }}} style={{ padding: '6px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>}

          {/* ⚙️ Services */}
          {activeTab === 'services' && (
            <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>{editingService ? '✏️ Edit Service' : '➕ Add Service'}</h2>
                <form onSubmit={editingService ? handleUpdateService : handleAddService} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input placeholder="Service Name" value={editingService?.name || newService.name} onChange={e => editingService ? setEditingService({...editingService, name: e.target.value}) : setNewService({...newService, name: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="tel" inputMode="numeric" placeholder="Price ($)" value={editingService?.price || newService.price} onChange={e => editingService ? setEditingService({...editingService, price: e.target.value}) : setNewService({...newService, price: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                    <input type="tel" inputMode="numeric" placeholder="Duration (min)" value={editingService?.duration || newService.duration} onChange={e => editingService ? setEditingService({...editingService, duration: e.target.value}) : setNewService({...newService, duration: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  </div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Price Effective From:</label>
                  <input type="date" value={editingService?.effective_from || newService.effective_from} onChange={e => editingService ? setEditingService({...editingService, effective_from: e.target.value}) : setNewService({...newService, effective_from: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button type="submit" disabled={isLoading} style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{isLoading ? 'Saving...' : editingService ? 'Update Service' : 'Add Service'}</button>
                    {editingService && <button type="button" onClick={() => setEditingService(null)} style={{ padding: '10px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>}
                  </div>
                </form>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>📋 Services ({services.length})</h2>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {services.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <div><strong style={{ fontSize: '1rem', color: '#0f172a' }}>{s.name}</strong> • ${s.price} / {s.duration}m<div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>From: {new Date(s.price_effective_from).toLocaleDateString()}</div></div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setEditingService(s)} style={{ background: '#fff', color: '#d97706', border: '1px solid #fbbf24', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>✏️ Edit</button>
                        <button onClick={() => handleDeleteService(s.id)} style={{ background: '#fff', color: '#dc2626', border: '1px solid #f87171', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>🗑️ Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 🏭 Suppliers */}
          {activeTab === 'suppliers' && <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
              <h2>➕ Add Supplier</h2>
              <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input placeholder="Supplier Name" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                <input placeholder="Contact (Optional)" value={newSupplier.contact} onChange={e => setNewSupplier({...newSupplier, contact: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                <button type="submit" style={{ padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Save Supplier</button>
              </form>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
              <h2>🏭 Recurring Suppliers</h2>
              {suppliers.map(s => <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}><strong>{s.name}</strong><span style={{ color: '#64748b', fontSize: '0.8rem' }}>{s.contact}</span></div>)}
            </div>
          </div>}

          {/* 📦 Expenses (Supplier Billing) */}
          {activeTab === 'expenses' && <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
            <h2>📦 Record Supplier Bill</h2>
            <form onSubmit={handleAddBill} style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <select value={newBill.supplier_id || ''} onChange={e => setNewBill({...newBill, supplier_id: e.target.value, supplier_name: suppliers.find(s => s.id == e.target.value)?.name || ''})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <option value="">Select Recurring</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input placeholder="Or type cash supplier" value={newBill.supplier_id ? '' : newBill.supplier_name} onChange={e => setNewBill({...newBill, supplier_name: e.target.value, supplier_id: ''})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="tel" inputMode="numeric" placeholder="Amount ($)" value={newBill.amount} onChange={e => setNewBill({...newBill, amount: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
              <input type="date" value={newBill.bill_date} onChange={e => setNewBill({...newBill, bill_date: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
              <select value={newBill.category} onChange={e => setNewBill({...newBill, category: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <option value="materials">📦 Materials</option><option value="labour">👷 Labour</option><option value="utilities">💡 Utilities</option><option value="rent">🏢 Rent</option><option value="other">📋 Other</option>
              </select>
              <select value={newBill.payment_method} onChange={e => setNewBill({...newBill, payment_method: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <option value="cash">💵 Cash</option><option value="bank_transfer">🏦 Bank Transfer</option><option value="credit_card">💳 Credit Card</option><option value="debit_card">💳 Debit Card</option>
              </select>
              <input placeholder="Description (Optional)" value={newBill.description} onChange={e => setNewBill({...newBill, description: e.target.value})} style={{ gridColumn: '1 / -1', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button type="submit" disabled={isLoading} style={{ gridColumn: '1 / -1', padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{isLoading ? 'Saving...' : '📥 Add Bill'}</button>
            </form>
            <div style={{ marginTop: '1.5rem' }}>
              <h3>Recent Bills</h3>
              {bills.map(b => <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}><div><strong>{b.supplier_name}</strong> • {b.category} • {b.payment_method.toUpperCase()}<br/><span style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(b.bill_date).toLocaleDateString()}</span></div><span style={{ fontWeight: '600', color: '#dc2626' }}>-${b.amount}</span></div>)}
            </div>
          </div>}

          {/* 💵 Cash Book (AUTO-LEDGER) */}
          {activeTab === 'cashbook' && <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
            <h2>💵 Cash Book</h2>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', alignItems: 'center', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Opening Balance ($):</label>
              <input type="number" step="0.01" value={openingCash || ''} onChange={e => setOpeningCash(parseFloat(e.target.value || '0'))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100px' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ textAlign: 'center', background: '#f0fdf4', padding: '1rem', borderRadius: '8px' }}><div style={{ fontSize: '0.8rem', color: '#166534' }}>Cash In</div><div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#15803d' }}>${accountingData.cash.totalIn.toFixed(2)}</div></div>
              <div style={{ textAlign: 'center', background: '#fef2f2', padding: '1rem', borderRadius: '8px' }}><div style={{ fontSize: '0.8rem', color: '#991b1b' }}>Cash Out</div><div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#b91c1c' }}>${accountingData.cash.totalOut.toFixed(2)}</div></div>
              <div style={{ textAlign: 'center', background: '#eff6ff', padding: '1rem', borderRadius: '8px' }}><div style={{ fontSize: '0.8rem', color: '#1e40af' }}>Closing Balance</div><div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#2563eb' }}>${accountingData.cash.closing.toFixed(2)}</div></div>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {accountingData.cash.txns.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No cash transactions for this period.</div> :
                accountingData.cash.txns.map(txn => (
                  <div key={txn.ref} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div><strong>{txn.type === 'income' ? '📈' : '📉'} {txn.desc}</strong><div style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(txn.date).toLocaleDateString()} • Ref #{txn.ref}</div></div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: '600', color: txn.type === 'income' ? '#10b981' : '#dc2626' }}>{txn.type === 'income' ? '+' : '-'}${txn.amount.toFixed(2)}</span>
                      <div style={{ fontSize: '0.8rem', color: '#475569' }}>Bal: ${txn.balance.toFixed(2)}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>}

          {/* 🏦 Bank Ledger (AUTO-LEDGER) */}
          {activeTab === 'bank' && <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
            <h2>🏦 Bank & Card Ledger</h2>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', alignItems: 'center', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Opening Balance ($):</label>
              <input type="number" step="0.01" value={openingBank || ''} onChange={e => setOpeningBank(parseFloat(e.target.value || '0'))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100px' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ textAlign: 'center', background: '#f0fdf4', padding: '1rem', borderRadius: '8px' }}><div style={{ fontSize: '0.8rem', color: '#166534' }}>Bank In</div><div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#15803d' }}>${accountingData.bank.totalIn.toFixed(2)}</div></div>
              <div style={{ textAlign: 'center', background: '#fef2f2', padding: '1rem', borderRadius: '8px' }}><div style={{ fontSize: '0.8rem', color: '#991b1b' }}>Bank Out</div><div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#b91c1c' }}>${accountingData.bank.totalOut.toFixed(2)}</div></div>
              <div style={{ textAlign: 'center', background: '#eff6ff', padding: '1rem', borderRadius: '8px' }}><div style={{ fontSize: '0.8rem', color: '#1e40af' }}>Closing Balance</div><div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#2563eb' }}>${accountingData.bank.closing.toFixed(2)}</div></div>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {accountingData.bank.txns.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No bank/card transactions for this period.</div> :
                accountingData.bank.txns.map(txn => (
                  <div key={txn.ref} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div><strong>{txn.type === 'income' ? '📈' : '📉'} {txn.desc}</strong><div style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(txn.date).toLocaleDateString()} • Ref #{txn.ref}</div></div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: '600', color: txn.type === 'income' ? '#10b981' : '#dc2626' }}>{txn.type === 'income' ? '+' : '-'}${txn.amount.toFixed(2)}</span>
                      <div style={{ fontSize: '0.8rem', color: '#475569' }}>Bal: ${txn.balance.toFixed(2)}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>}

          {/* 📄 Financial Statements */}
          {activeTab === 'statements' && <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
              <h2>📄 Financial Statement</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="day">Today</option><option value="month">This Month</option><option value="year">This Year</option>
                </select>
                <button onClick={printFinancialStatement} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>🖨️ Print Statement</button>
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#fff', borderRadius: '6px' }}><span>📈 Total Revenue (Invoices)</span><strong style={{ color: '#10b981' }}>${pnl.revenue.toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#fff', borderRadius: '6px' }}><span>📦 Materials Cost</span><strong style={{ color: '#dc2626' }}>-${bills.filter(b => b.category === 'materials').reduce((s,b) => s + Number(b.amount||0), 0).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#fff', borderRadius: '6px' }}><span>👷 Labour Cost</span><strong style={{ color: '#dc2626' }}>-${bills.filter(b => b.category === 'labour').reduce((s,b) => s + Number(b.amount||0), 0).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f0fdf4', borderRadius: '6px', fontWeight: 'bold' }}><span>💰 Gross Profit</span><strong style={{ color: '#15803d' }}>${(pnl.revenue - bills.filter(b => ['materials','labour'].includes(b.category)).reduce((s,b) => s + Number(b.amount||0), 0)).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#fff', borderRadius: '6px' }}><span>📋 Other Expenses</span><strong style={{ color: '#dc2626' }}>-${bills.filter(b => !['materials','labour'].includes(b.category)).reduce((s,b) => s + Number(b.amount||0), 0).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', background: pnl.profit >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: '6px', fontWeight: 'bold', fontSize: '1.1em' }}><span>🎯 Net Profit</span><strong style={{ color: pnl.profit >= 0 ? '#166534' : '#991b1b' }}>${pnl.profit.toFixed(2)}</strong></div>
              </div>
            </div>
          </div>}
        </main>
      </div>
    </div>
  );
}