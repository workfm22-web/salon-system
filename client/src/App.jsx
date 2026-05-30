import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';

//  CONFIGURATION
const SALON_CONFIG = {
  name: 'Salon Enoka',
  address: '251/8, Kirula Road, Colombo 5',
  telephone: '+94 112 369 777',
  //  Replace these with your actual Supabase Storage public URLs
  salonLogoUrl: 'https://yhkgbcppoealusdhhakp.supabase.co/storage/v1/object/public/Saloon%20App/Enoka%20logo.jpg',
  bizHubLogoUrl: 'https://yhkgbcppoealusdhhakp.supabase.co/storage/v1/object/public/Saloon%20App/BizHub%20Solutions_Company%20Logo.png',  loyaltyRate: 10,
  openTime: '09:00',
  closeTime: '18:00',
  currentYear: new Date().getFullYear(),
  currency: 'LKR'
};

export default function App() {
  // 🔐 Auth
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);

  // 🏢 Branding
  const [salonName, setSalonName] = useState(SALON_CONFIG.name);
  const [salonLogo, setSalonLogo] = useState(SALON_CONFIG.salonLogoUrl);
  const [bizHubLogo, setBizHubLogo] = useState(SALON_CONFIG.bizHubLogoUrl);
  
  useEffect(() => localStorage.setItem('salon_name', salonName), [salonName]);
  useEffect(() => localStorage.setItem('salon_logo', salonLogo), [salonLogo]);
  useEffect(() => localStorage.setItem('bizhub_logo', bizHubLogo), [bizHubLogo]);

  //  Time
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);

  // 📊 State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chartPeriod, setChartPeriod] = useState('month');
  const [bookingsFilter, setBookingsFilter] = useState('');

  // 📦 Data
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bills, setBills] = useState([]);
  const [expenseTypes, setExpenseTypes] = useState(['materials', 'labour', 'utilities', 'rent', 'marketing', 'other']);
  const [blockouts, setBlockouts] = useState([]);

  // 📝 Forms
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', gender: '', age: '' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [newAppointment, setNewAppointment] = useState({ customerId: '', serviceId: '', time: '' });
  const [newSupplier, setNewSupplier] = useState({ name: '', contact: '' });
  const [newBill, setNewBill] = useState({ supplier_id: '', supplier_name: '', amount: '', description: '', bill_date: new Date().toISOString().split('T')[0], category: 'other', payment_method: 'cash' });
  const [newService, setNewService] = useState({ name: '', price: '', duration: '', effective_from: new Date().toISOString().split('T')[0] });
  const [editingService, setEditingService] = useState(null);
  const [newExpenseType, setNewExpenseType] = useState('');
  const [newBlockout, setNewBlockout] = useState({ date: '', startTime: '00:00', endTime: '23:59', reason: '' });

  // 💰 Opening Balances
  const [openingCash, setOpeningCash] = useState(() => parseFloat(localStorage.getItem('salon_opening_cash') || '0'));
  const [openingBank, setOpeningBank] = useState(() => parseFloat(localStorage.getItem('salon_opening_bank') || '0'));
  const [cashOpenDate, setCashOpenDate] = useState(() => localStorage.getItem('salon_cash_date') || new Date().toISOString().split('T')[0]);
  const [bankOpenDate, setBankOpenDate] = useState(() => localStorage.getItem('salon_bank_date') || new Date().toISOString().split('T')[0]);
  const [isEditingCashOB, setIsEditingCashOB] = useState(false);
  const [isEditingBankOB, setIsEditingBankOB] = useState(false);

  useEffect(() => localStorage.setItem('salon_opening_cash', openingCash), [openingCash]);
  useEffect(() => localStorage.setItem('salon_opening_bank', openingBank), [openingBank]);
  useEffect(() => localStorage.setItem('salon_cash_date', cashOpenDate), [cashOpenDate]);
  useEffect(() => localStorage.setItem('salon_bank_date', bankOpenDate), [bankOpenDate]);

  //  Ledger Range
  const [ledgerFrom, setLedgerFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [ledgerTo, setLedgerTo] = useState(() => new Date().toISOString().split('T')[0]);

  // 🛒 POS
  const [posForm, setPosForm] = useState({
    customerType: 'list', customerId: '', walkinName: '',
    items: [{ serviceId: '', qty: 1, discount: 0, adjustment: 0 }], paymentMethod: 'cash', amountTendered: ''
  });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showLoyaltyCard, setShowLoyaltyCard] = useState(null);

  // 🔐 Auth
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
    setCustomers([]); setServices([]); setAppointments([]); setInvoices([]); setSuppliers([]); setBills([]); setBlockouts([]);
  };

  //  Init
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
      
      const savedTypes = localStorage.getItem('salon_expense_types');
      if (savedTypes) setExpenseTypes(JSON.parse(savedTypes));
      const savedBlockouts = localStorage.getItem('salon_blockouts');
      if (savedBlockouts) setBlockouts(JSON.parse(savedBlockouts));
    } catch (err) { setError('Failed to load data: ' + err.message); }
    finally { setIsLoading(false); }
  };

  // 👤 Customers
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) return setError('Name & phone required');
    if (!/^\d{10}$/.test(newCustomer.phone)) return setError('Phone must be exactly 10 digits');
    setIsLoading(true);
    try { 
      const { error } = await supabase.from('customers').insert([{ ...newCustomer, loyalty_points: 0 }]); 
      if (error) throw error; await fetchData(); setNewCustomer({ name: '', phone: '', gender: '', age: '' }); 
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };
  const handleEditCustomer = async (id) => {
    const c = customers.find(x => x.id === id); if (!c) return;
    const name = prompt('Name:', c.name); const phone = prompt('Phone:', c.phone);
    if (name === null || phone === null) return;
    if (!/^\d{10}$/.test(phone)) return setError('Phone must be 10 digits');
    const gender = prompt('Gender (Male/Female):', c.gender || '');
    const age = prompt('Age:', c.age || '');
    setIsLoading(true);
    try {
      const { error } = await supabase.from('customers').update({ name, phone, gender: gender || null, age: age ? Number(age) : null }).eq('id', id);
      if (error) throw error; await fetchData();
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };
  const handleDeleteCustomer = async (id) => {
    if (!window.confirm('Delete customer?')) return; setIsLoading(true);
    try { const { error } = await supabase.from('customers').delete().eq('id', id); if (error) throw error; await fetchData(); } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  //  Bookings Validation
  const isTimeBlocked = (bookingDateTime) => {
    const bDate = bookingDateTime.split('T')[0];
    const bTime = bookingDateTime.split('T')[1].slice(0, 5);
    return blockouts.some(b => {
      if (b.date !== bDate) return false;
      return bTime >= b.startTime && bTime < b.endTime;
    });
  };
  const isWithinHours = (bookingDateTime) => {
    const time = bookingDateTime.split('T')[1].slice(0, 5);
    return time >= SALON_CONFIG.openTime && time < SALON_CONFIG.closeTime;
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!newAppointment.customerId || !newAppointment.serviceId || !newAppointment.time) return setError('Fill all fields');
    if (!isWithinHours(newAppointment.time)) return setError(`Booking outside salon hours (${SALON_CONFIG.openTime} - ${SALON_CONFIG.closeTime})`);
    if (isTimeBlocked(newAppointment.time)) return setError('This time slot is blocked');
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
        if (!invoices.some(inv => inv.appointment_id === id)) await supabase.from('invoices').insert({ appointment_id: id, customer_name: apt.customer_name, service_name: apt.service_name, total_amount: apt.price, status: 'paid', items: JSON.stringify([{ service: apt.service_name, qty: 1, price: apt.price }]), payment_method: 'cash' });
      }
      await fetchData();
    } catch (err) { setError(err.message); }
  };

  // ⚙️ Services
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
      const { error } = await supabase.from('supplier_bills').insert({ supplier_name: finalName, amount: Number(newBill.amount), description: newBill.description, bill_date: newBill.bill_date, category: newBill.category, payment_method: newBill.payment_method });
      if (error) throw error; await fetchData(); setNewBill({ supplier_id: '', supplier_name: '', amount: '', description: '', bill_date: new Date().toISOString().split('T')[0], category: expenseTypes[0], payment_method: 'cash' });
    } catch (err) { setError('Failed: ' + err.message); } finally { setIsLoading(false); }
  };
  const handleAddExpenseType = () => { if (!newExpenseType.trim()) return; const t = newExpenseType.trim().toLowerCase(); if (expenseTypes.includes(t)) return setError('Exists'); const u = [...expenseTypes, t]; setExpenseTypes(u); localStorage.setItem('salon_expense_types', JSON.stringify(u)); setNewExpenseType(''); };
  const handleDeleteExpenseType = (t) => { if (!window.confirm(`Delete "${t}"?`)) return; const u = expenseTypes.filter(x => x !== t); setExpenseTypes(u); localStorage.setItem('salon_expense_types', JSON.stringify(u)); };
  const handleAddBlockout = () => { if (!newBlockout.date) return; const u = [...blockouts, newBlockout]; setBlockouts(u); localStorage.setItem('salon_blockouts', JSON.stringify(u)); setNewBlockout({ date: '', startTime: '00:00', endTime: '23:59', reason: '' }); };
  const handleRemoveBlockout = (d) => { const u = blockouts.filter(b => b.date !== d); setBlockouts(u); localStorage.setItem('salon_blockouts', JSON.stringify(u)); };

  // 🛒 POS Logic
  const posSubtotal = posForm.items.reduce((sum, item) => {
    const svc = services.find(s => s.id === Number(item.serviceId));
    const qty = Number(item.qty) || 0;
    const base = svc ? Number(svc.price) * qty : 0;
    const disc = Number(item.discount) || 0;
    const adj = Number(item.adjustment) || 0;
    return sum + Math.max(0, base - disc + adj);
  }, 0);
  const posChange = posForm.paymentMethod === 'cash' ? Math.max(0, Number(posForm.amountTendered || 0) - posSubtotal) : 0;

  const updateItem = (idx, field, val) => {
    const u = [...posForm.items]; u[idx] = { ...u[idx], [field]: val };
    setPosForm({ ...posForm, items: u });
  };
  const addItemLine = () => setPosForm({ ...posForm, items: [...posForm.items, { serviceId: '', qty: 1, discount: 0, adjustment: 0 }] });
  const removeItemLine = (idx) => { if (posForm.items.length > 1) setPosForm({ ...posForm, items: posForm.items.filter((_, i) => i !== idx) }); };

  const loadBookingToPOS = (b) => {
    setSelectedBooking(b); setActiveTab('invoices');
    setPosForm({ customerType: 'list', customerId: b.customer_id.toString(), walkinName: '', items: [{ serviceId: b.service_id.toString(), qty: 1, discount: 0, adjustment: 0 }], paymentMethod: 'cash', amountTendered: '' });
  };
  const clearBookingSelection = () => { setSelectedBooking(null); setPosForm({ customerType: 'list', customerId: '', walkinName: '', items: [{ serviceId: '', qty: 1, discount: 0, adjustment: 0 }], paymentMethod: 'cash', amountTendered: '' }); };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (posSubtotal === 0) return setError('Add services');
    if (posForm.paymentMethod === 'cash' && posChange < 0) return setError('Insufficient cash');
    setIsLoading(true); setError(null);
    try {
      const itemsPayload = posForm.items.map(i => { const svc = services.find(s => s.id === Number(i.serviceId)); return { service: svc?.name || 'Unknown', qty: i.qty, price: svc?.price || 0, discount: i.discount, adjustment: i.adjustment }; });
      const invData = { customer_name: posForm.customerType === 'walkin' ? 'Walk-in' : (customers.find(c => c.id == posForm.customerId)?.name || 'Unknown'), items: JSON.stringify(itemsPayload), total_amount: posSubtotal, payment_method: posForm.paymentMethod, amount_tendered: posForm.paymentMethod === 'cash' ? Number(posForm.amountTendered) : posSubtotal, change_amount: posChange, status: 'paid', appointment_id: selectedBooking?.id || null };
      const { error } = await supabase.from('invoices').insert(invData); if (error) throw error;
      if (posForm.customerId) { const pts = Math.floor(posSubtotal / SALON_CONFIG.loyaltyRate); if (pts > 0) await supabase.from('customers').update({ loyalty_points: (customers.find(c => c.id == posForm.customerId)?.loyalty_points || 0) + pts }).eq('id', posForm.customerId); }
      if (selectedBooking) await supabase.from('appointments').update({ status: 'completed' }).eq('id', selectedBooking.id);
      await fetchData(); clearBookingSelection();
    } catch (err) { setError('Failed: ' + err.message); } finally { setIsLoading(false); }
  };

  const redeemLoyalty = async (cid, pts) => {
    if (!cid) return setError('Select customer');
    const c = customers.find(x => x.id == cid);
    if (!c || c.loyalty_points < pts) return setError('Insufficient points');
    setPosForm({ ...posForm, items: posForm.items.map((it, i) => i === 0 ? { ...it, adjustment: -pts } : it) });
    setError(`✅ Redeemed ${pts} points (LKR ${pts} off)`);
  };

  const printInvoice = (inv) => {
    const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice #${inv.id}</title><style>body{font-family:monospace;width:320px;margin:0 auto;padding:10px}h1,h3{text-align:center;margin:5px 0}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:4px 0;font-size:0.9rem}.total{font-weight:bold;font-size:1.2rem;margin-top:8px;text-align:right}@media print{body{margin:0}}</style></head><body><h1>${salonName}</h1><h3>Invoice #${inv.id}</h3><div class="row"><span>Date:</span><span>${new Date(inv.issued_at).toLocaleDateString()}</span></div><div class="row"><span>Customer:</span><span>${inv.customer_name}</span></div><div class="line"></div>${items.map(i => `<div class="row"><span>${i.qty}x ${i.service}</span><span>LKR ${((i.price*i.qty)-(i.discount||0)+(i.adjustment||0)).toFixed(2)}</span></div>`).join('')}<div class="line"></div><div class="row"><span>Total:</span><span>LKR ${inv.total_amount.toFixed(2)}</span></div>${inv.payment_method==='cash'?`<div class="row"><span>Cash:</span><span>LKR ${inv.amount_tendered?.toFixed(2)||'0.00'}</span></div><div class="total"><span>Change:</span><span>LKR ${inv.change_amount?.toFixed(2)||'0.00'}</span></div>`:`<div class="row"><span>Method:</span><span>${inv.payment_method.toUpperCase()}</span></div>`}<div class="line"></div><p style="text-align:center;margin-top:15px;font-size:0.85rem">PAID • Thank you! ❤️</p><script>window.print();window.close()</script></body></html>`);
  };

  const printLedger = (type) => {
    const data = accountingData[type];
    const openBal = type === 'cash' ? openingCash : openingBank;
    const openDate = type === 'cash' ? cashOpenDate : bankOpenDate;
    const title = type === 'cash' ? 'Cash Book' : 'Bank & Card Ledger';
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>${title} ${ledgerFrom} to ${ledgerTo}</title><style>body{font-family:Arial,sans-serif;margin:40px auto;padding:20px;max-width:800px}h1{text-align:center;color:#1e3a8a;border-bottom:2px solid #1e3a8a;padding-bottom:10px}.meta{display:flex;justify-content:space-between;margin-bottom:20px;font-size:0.9rem;color:#64748b}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f8fafc;font-weight:600}tfoot td{font-weight:bold;background:#f0f9ff}.inc{color:#10b981}.exp{color:#dc2626}@media print{body{margin:0}}</style></head><body><h1>${salonName}</h1><p style="text-align:center;font-size:1.1rem">${title} Statement</p><div class="meta"><span>Period: ${ledgerFrom} to ${ledgerTo}</span><span>Opening Balance: LKR ${openBal.toFixed(2)} (as of ${openDate})</span></div><table><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Balance</th></tr></thead><tbody>${data.txns.map(t => `<tr><td>${new Date(t.date).toLocaleDateString()}</td><td>${t.desc}</td><td class="${t.type==='income'?'inc':'exp'}">${t.type==='income'?'+':t.type==='opening'?'':'-'}LKR ${Math.abs(t.amount).toFixed(2)}</td><td>LKR ${t.balance.toFixed(2)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3" style="text-align:right">Closing Balance:</td><td>LKR ${data.closing.toFixed(2)}</td></tr></tfoot></table><p style="text-align:center;margin-top:30px;font-size:0.8rem;color:#94a3b8">Generated: ${new Date().toLocaleString()}</p><script>window.print();window.close()</script></body></html>`);
  };

  // 💵 Ledger Data - STRICT Cash vs Bank separation
  const accountingData = useMemo(() => {
    const inPeriod = (d) => { 
      if (!d) return false; 
      const s = d.includes('T') ? d.split('T')[0] : d; 
      return s >= ledgerFrom && s <= ledgerTo; 
    };
    
    const buildLedger = (allowedPaymentMethods, opening, openDate) => {
      let txns = [], tIn = 0, tOut = 0;
      
      // Add opening balance as first transaction (only if within period)
      if (inPeriod(openDate)) {
        txns.push({ 
          date: openDate, 
          desc: '🏦 Opening Balance', 
          amount: opening, 
          type: 'opening' 
        });
      }
      
      // Filter invoices by payment method AND period
      invoices
        .filter(inv => 
          inv.status === 'paid' && 
          inPeriod(inv.issued_at) && 
          allowedPaymentMethods.includes(inv.payment_method)
        )
        .forEach(inv => { 
          const a = Number(inv.total_amount || 0); 
          tIn += a; 
          txns.push({ 
            date: inv.issued_at.split('T')[0], 
            desc: `INV #${inv.id} • ${inv.customer_name}`, 
            amount: a, 
            type: 'income' 
          }); 
        });
      
      // Filter bills by payment method AND period
      bills
        .filter(b => 
          inPeriod(b.bill_date) && 
          allowedPaymentMethods.includes(b.payment_method)
        )
        .forEach(b => { 
          const a = Number(b.amount || 0); 
          tOut += a; 
          txns.push({ 
            date: b.bill_date, 
            desc: `BILL • ${b.supplier_name} (${b.category})`, 
            amount: a, 
            type: 'expense' 
          }); 
        });
      
      // Sort by date
      txns.sort((a,b) => new Date(a.date) - new Date(b.date));
      
      // Calculate running balance
      let bal = inPeriod(openDate) ? 0 : opening;
      txns = txns.map(t => { 
        if (t.type === 'opening') {
          bal = t.amount; // Opening balance sets the starting point
        } else if (t.type === 'income') {
          bal += t.amount;
        } else {
          bal -= t.amount;
        }
        return {...t, balance: bal}; 
      });
      
      return { txns, totalIn: tIn, totalOut: tOut, closing: bal };
    };
    
    // 🔹 CASH LEDGER: Only 'cash' payments
    const cashLedger = buildLedger(['cash'], openingCash, cashOpenDate);
    
    // 🔹 BANK LEDGER: Only card/bank/transfer payments
    const bankLedger = buildLedger(
      ['card', 'transfer', 'bank_transfer', 'credit_card', 'debit_card'], 
      openingBank, 
      bankOpenDate
    );
    
    return { 
      cash: cashLedger, 
      bank: bankLedger 
    };
  }, [invoices, bills, ledgerFrom, ledgerTo, openingCash, openingBank, cashOpenDate, bankOpenDate]);

  // 📊 Dashboard Data - Bar Chart with Fixed Ranges
  const dashboardData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Generate date ranges based on period
    const generateDateRange = () => {
      const dates = [];
      if (chartPeriod === 'day') {
        // Last 14 days
        for (let i = 13; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split('T')[0]);
        }
      } else if (chartPeriod === 'month') {
        // Last 12 months
        for (let i = 11; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          dates.push(d.toISOString().slice(0, 7)); // YYYY-MM
        }
      } else if (chartPeriod === 'year') {
        // Last 5 years
        for (let i = 4; i >= 0; i--) {
          const d = new Date();
          d.setFullYear(d.getFullYear() - i);
          dates.push(d.getFullYear().toString());
        }
      }
      return dates;
    };

    const dateRange = generateDateRange();
    const revData = {};
    const expData = {};

    // Initialize all dates with 0
    dateRange.forEach(d => {
      revData[d] = 0;
      expData[d] = 0;
    });

    // Filter and aggregate invoices
    invoices.filter(inv => inv.status === 'paid').forEach(inv => {
      const dateStr = inv.issued_at?.split('T')[0];
      if (!dateStr) return;
      
      let key = null;
      if (chartPeriod === 'day') {
        key = dateStr;
      } else if (chartPeriod === 'month') {
        key = dateStr.slice(0, 7);
      } else if (chartPeriod === 'year') {
        key = dateStr.slice(0, 4);
      }
      
      if (key && dateRange.includes(key)) {
        revData[key] = (revData[key] || 0) + Number(inv.total_amount || 0);
      }
    });

    // Filter and aggregate bills
    bills.forEach(b => {
      const dateStr = b.bill_date;
      if (!dateStr) return;
      
      let key = null;
      if (chartPeriod === 'day') {
        key = dateStr;
      } else if (chartPeriod === 'month') {
        key = dateStr.slice(0, 7);
      } else if (chartPeriod === 'year') {
        key = dateStr.slice(0, 4);
      }
      
      if (key && dateRange.includes(key)) {
        expData[key] = (expData[key] || 0) + Number(b.amount || 0);
      }
    });

    return { revData, expData, period: chartPeriod, dateRange };
  }, [invoices, bills, chartPeriod]);

  // 🔐 Login
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
        <form onSubmit={handleAuth} style={{ background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', width: '100%', maxWidth: '340px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>{salonName} {authMode === 'login' ? 'Login' : 'Create Account'}</h2>
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', position: 'relative' }}>
      <style>{`
        @media (max-width: 640px) {
          .main-container { padding: 0.5rem !important; }
          .nav-tabs { gap: 4px !important; }
          .nav-tabs button { font-size: 0.75rem !important; padding: 6px 8px !important; }
          .card-grid { grid-template-columns: 1fr !important; }
          .form-row { grid-template-columns: 1fr !important; }
          .table-wrap { font-size: 0.85rem !important; }
          th, td { padding: 6px 4px !important; }
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 641px) and (max-width: 1024px) { .card-grid { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>

      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url("https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1920&q=80")', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.05, zIndex: -1 }} />
      
      <div style={{ background: '#1e3a8a', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {salonLogo && <img src={salonLogo} alt="Logo" style={{ height: '40px', borderRadius: '8px' }} />}
          <div>
            <span style={{ color: '#fff', fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', fontWeight: '700', display: 'block', lineHeight: '1.2' }}>{salonName}</span>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', marginTop: '2px' }}>{SALON_CONFIG.address} • {SALON_CONFIG.telephone}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ color: '#fff', fontSize: '0.85rem', textAlign: 'right' }}><div>{currentTime.toLocaleDateString()}</div><div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{currentTime.toLocaleTimeString()}</div></div>
          <button onClick={handleLogout} style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>🚪 Logout</button>
        </div>
      </div>
      
      <div className="main-container" style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
        {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>️ {error}</div>}
        {isLoading && <div style={{ textAlign: 'center', padding: '10px', color: '#64748b' }}>⏳ Syncing...</div>}
        
        <nav className="nav-tabs" style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', flexWrap: 'wrap', overflowX: 'auto' }}>
          {['dashboard', 'bookings', 'invoices', 'services', 'suppliers_expenses', 'cash_bank', 'statements'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 12px', background: activeTab === tab ? '#3b82f6' : '#f1f5f9', color: activeTab === tab ? '#fff' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: activeTab === tab ? '600' : '400', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
              {tab === 'bookings' ? 'Booking & Customers' : tab === 'suppliers_expenses' ? 'Suppliers & Expenses' : tab === 'cash_bank' ? 'Cash & Bank Ledgers' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        <main>
          {/*  Dashboard */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#f0fdf4', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem' }}>📅</div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#15803d' }}>{appointments.filter(a => a.status === 'booked').length}</div>
                  <div style={{ fontSize: '0.9rem', color: '#166534' }}>Active Bookings</div>
                </div>
                <div style={{ background: '#eff6ff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem' }}>💵</div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#2563eb' }}>LKR {Object.values(dashboardData.revData).reduce((a,b)=>a+b,0).toFixed(0)}</div>
                  <div style={{ fontSize: '0.9rem', color: '#1e40af' }}>{chartPeriod === 'day' ? 'Today' : chartPeriod === 'month' ? 'This Month' : 'This Year'} Revenue</div>
                </div>
                <div style={{ background: '#fef2f2', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem' }}></div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#dc2626' }}>LKR {Object.values(dashboardData.expData).reduce((a,b)=>a+b,0).toFixed(0)}</div>
                  <div style={{ fontSize: '0.9rem', color: '#991b1b' }}>{chartPeriod === 'day' ? 'Today' : chartPeriod === 'month' ? 'This Month' : 'This Year'} Expenses</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                {['day', 'month', 'year'].map(p => (
                  <button key={p} onClick={() => setChartPeriod(p)} style={{ padding: '6px 12px', background: chartPeriod === p ? '#3b82f6' : '#f1f5f9', color: chartPeriod === p ? '#fff' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: chartPeriod === p ? '600' : '400' }}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
                ))}
              </div>

              {/* Revenue Chart */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3>📈 Revenue Trend ({chartPeriod === 'day' ? 'Last 14 Days' : chartPeriod === 'month' ? 'Last 12 Months' : 'Last 5 Years'})</h3>
                  <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '600' }}>
                    Total: LKR {Object.values(dashboardData.revData).reduce((a,b)=>a+b,0).toLocaleString()}
                  </div>
                </div>
                
                <div style={{ position: 'relative', height: '200px', marginTop: '1rem' }}>
                  {/* Y-Axis Labels */}
                  <div style={{ position: 'absolute', left: '0', top: '0', bottom: '30px', width: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                    {(() => {
                      const max = Math.max(...Object.values(dashboardData.revData), 1000);
                      return [1, 0.75, 0.5, 0.25, 0].map(pct => (
                        <div key={pct} style={{ textAlign: 'right', paddingRight: '8px' }}>
                          LKR {((max * pct) / 1000).toFixed(0)}k
                        </div>
                      ));
                    })()}
                  </div>
                  
                  {/* Bars Container */}
                  <div style={{ marginLeft: '55px', marginRight: '10px', height: '100%', display: 'flex', alignItems: 'flex-end', gap: '4px', paddingBottom: '30px' }}>
                    {dashboardData.dateRange.map((k, i) => {
                      const v = dashboardData.revData[k] || 0;
                      const max = Math.max(...Object.values(dashboardData.revData), 1);
                      const height = (v / max) * 100;
                      const label = chartPeriod === 'day' ? k.slice(5) : chartPeriod === 'month' ? k.slice(5) : k;
                      
                      // Color gradient based on value
                      const getColor = (val) => {
                        if (val === 0) return '#cbd5e1';
                        if (val < max * 0.33) return '#60a5fa';
                        if (val < max * 0.66) return '#3b82f6';
                        return '#2563eb';
                      };
                      
                      return (
                        <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', position: 'relative' }}>
                          {/* Bar */}
                          <div 
                            style={{ 
                              width: '100%', 
                              height: `${height}%`, 
                              background: `linear-gradient(to top, ${getColor(v)}, ${getColor(v).replace('2563eb', '60a5fa').replace('3b82f6', '93c5fd').replace('60a5fa', 'bfdbfe')})`,
                              borderRadius: '4px 4px 0 0',
                              transition: 'all 0.3s ease',
                              boxShadow: v > 0 ? '0 -2px 8px rgba(59, 130, 246, 0.3)' : 'none',
                              cursor: 'pointer'
                            }}
                            title={`LKR ${v.toLocaleString()}`}
                          />
                          {/* Label */}
                          <div style={{ 
                            position: 'absolute', 
                            bottom: '-25px', 
                            fontSize: '0.7rem', 
                            color: '#64748b',
                            transform: 'rotate(-45deg)',
                            transformOrigin: 'top center',
                            whiteSpace: 'nowrap',
                            textAlign: 'center'
                          }}>
                            {label}
                          </div>
                          {/* Value on top of bar */}
                          {v > 0 && height > 10 && (
                            <div style={{ 
                              position: 'absolute', 
                              top: '-20px', 
                              fontSize: '0.65rem', 
                              fontWeight: '600', 
                              color: '#2563eb',
                              whiteSpace: 'nowrap'
                            }}>
                              {(v/1000).toFixed(1)}k
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Expense Pie Chart */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h3>💸 Expense Breakdown</h3>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                  <svg width="200" height="200" viewBox="0 0 200 200">
                    {(() => {
                      const cats = expenseTypes;
                      const data = cats.map(c => ({ name: c, val: bills.filter(b => b.category === c).reduce((s,b) => s + Number(b.amount||0), 0) })).filter(x => x.val > 0);
                      const total = data.reduce((s,x) => s + x.val, 0);
                      if (total === 0) return <text x="100" y="100" textAnchor="middle" fill="#64748b">No Data</text>;
                      let start = 0;
                      const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'];
                      return data.map((d, i) => {
                        const angle = (d.val / total) * 360;
                        const x1 = 100 + 80 * Math.cos(Math.PI * 2 * start / 360);
                        const y1 = 100 + 80 * Math.sin(Math.PI * 2 * start / 360);
                        start += angle;
                        const x2 = 100 + 80 * Math.cos(Math.PI * 2 * start / 360);
                        const y2 = 100 + 80 * Math.sin(Math.PI * 2 * start / 360);
                        const large = angle > 180 ? 1 : 0;
                        return (
                          <path key={d.name} d={`M100,100 L${x1},${y1} A80,80 0 ${large},1 ${x2},${y2} Z`} fill={colors[i % colors.length]} stroke="#fff" strokeWidth="2" />
                        );
                      });
                    })()}
                    <circle cx="100" cy="100" r="40" fill="#fff" />
                    <text x="100" y="100" textAnchor="middle" fill="#334155" fontSize="12" fontWeight="bold">Total</text>
                  </svg>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '1rem' }}>
                  {expenseTypes.map((c, i) => {
                    const val = bills.filter(b => b.category === c).reduce((s,b) => s + Number(b.amount||0), 0);
                    if (val === 0) return null;
                    return <span key={c} style={{ fontSize: '0.8rem', color: '#64748b' }}><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'][i], marginRight: '4px' }}></span>{c}: LKR {val.toFixed(0)}</span>;
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 👥 Booking & Customers */}
          {activeTab === 'bookings' && (
            <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {/* Customer Add & Search */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>👥 Add Customer</h2>
                <form onSubmit={handleAddCustomer} style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                  <input value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="Name" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <input value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder="Phone (10 digits)" maxLength="10" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <select value={newCustomer.gender} onChange={e => setNewCustomer({...newCustomer, gender: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <option value="">Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    <input type="number" min="0" max="120" value={newCustomer.age} onChange={e => setNewCustomer({...newCustomer, age: e.target.value})} placeholder="Age" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <button type="submit" disabled={isLoading} style={{ padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{isLoading ? 'Saving...' : '+ Add Customer'}</button>
                </form>
                
                <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>📅 Add Booking</h3>
                <form onSubmit={handleBookAppointment} style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                  <select value={newAppointment.customerId} onChange={e => setNewAppointment({...newAppointment, customerId: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  <select value={newAppointment.serviceId} onChange={e => setNewAppointment({...newAppointment, serviceId: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Service</option>{services.map(s => <option key={s.id} value={s.id}>{s.name} (LKR {s.price})</option>)}</select>
                  <input type="datetime-local" value={newAppointment.time} onChange={e => setNewAppointment({...newAppointment, time: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <button type="submit" disabled={isLoading || !services.length} style={{ padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>✅ Book Appointment</button>
                </form>

                <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>🔍 Search Customers</h3>
                <input placeholder="Name or Phone..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                
                <h3 style={{ marginTop: '1rem', marginBottom: '1rem' }}>Customers ({customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).length})</h3>
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <div><strong style={{ fontSize: '1rem', color: '#0f172a' }}>{c.name}</strong><div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>{c.phone} {c.gender ? `• ${c.gender}` : ''} {c.age ? `• ${c.age}y` : ''}{c.loyalty_points > 0 && ` • ⭐${c.loyalty_points}`}</div></div>
                      <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                        {c.loyalty_points > 0 && <button onClick={() => setShowLoyaltyCard(c)} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>🎴 View Card</button>}
                        <button onClick={() => handleEditCustomer(c.id)} style={{ background: '#fff', color: '#d97706', border: '1px solid #fbbf24', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>✏️ Edit</button>
                        <button onClick={() => handleDeleteCustomer(c.id)} style={{ background: '#fff', color: '#dc2626', border: '1px solid #f87171', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>🗑️ Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blockouts & Bookings List */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>🚫 Block Dates/Hours</h2>
                <form onSubmit={e => { e.preventDefault(); handleAddBlockout(); }} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <input type="date" value={newBlockout.date} onChange={e => setNewBlockout({...newBlockout, date: e.target.value})} style={{ flex: 1, minWidth: '120px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <input type="time" value={newBlockout.startTime} onChange={e => setNewBlockout({...newBlockout, startTime: e.target.value})} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <span style={{ alignSelf: 'center' }}>-</span>
                  <input type="time" value={newBlockout.endTime} onChange={e => setNewBlockout({...newBlockout, endTime: e.target.value})} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <input placeholder="Reason" value={newBlockout.reason} onChange={e => setNewBlockout({...newBlockout, reason: e.target.value})} style={{ flex: 1, minWidth: '100px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <button type="submit" style={{ padding: '8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🚫 Block Time</button>
                </form>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {blockouts.map(b => (
                    <div key={b.date+b.startTime} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                      <div><strong>{new Date(b.date).toLocaleDateString()}</strong> {b.startTime} - {b.endTime} • {b.reason || 'Blocked'}</div>
                      <button onClick={() => handleRemoveBlockout(b.date+b.startTime)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>✕ Remove</button>
                    </div>
                  ))}
                </div>

                <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>📅 All Bookings ({appointments.length})</h3>
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <input placeholder="🔍 Filter bookings..." value={bookingsFilter} onChange={e => setBookingsFilter(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  {appointments.filter(a => a.customer_name?.toLowerCase().includes(bookingsFilter.toLowerCase()) || a.service_name?.toLowerCase().includes(bookingsFilter.toLowerCase())).map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                      <div><strong>{a.customer_name}</strong> • {a.service_name}<div style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(a.time).toLocaleString()}</div></div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {a.status === 'booked' && <button onClick={() => loadBookingToPOS(a)} style={{ padding: '4px 8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>💳 Create Invoice</button>}
                        <select value={a.status} onChange={e => handleStatusChange(a.id, e.target.value)} style={{ padding: '4px', borderRadius: '12px', border: 'none', fontWeight: '600', fontSize: '0.75rem', background: a.status==='booked'?'#dbeafe':a.status==='completed'?'#dcfce7':'#fee2e2', color: a.status==='booked'?'#1d4ed8':a.status==='completed'?'#166534':'#991b1b' }}>
                          <option value="booked">BOOKED</option><option value="completed">COMPLETED</option><option value="cancelled">CANCELLED</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 🧾 Invoices */}
          {activeTab === 'invoices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>🧾 Create Invoice</h2>
                {upcomingBookings.length > 0 && !selectedBooking && (
                  <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#0369a1' }}>📅 Quick Select Booking</h3>
                    <div style={{ display: 'grid', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                      {upcomingBookings.slice(0, 5).map(b => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#fff', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.9rem' }}><strong>{b.customer_name}</strong> • {b.service_name}<div style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(b.time).toLocaleString()}</div></div>
                          <button onClick={() => loadBookingToPOS(b)} style={{ padding: '4px 10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Select Booking</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedBooking && (
                  <div style={{ marginBottom: '1rem', padding: '10px', background: '#dcfce7', borderRadius: '8px', border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><strong>📅 Booking:</strong> {selectedBooking.customer_name} - {selectedBooking.service_name}</div>
                    <button onClick={clearBookingSelection} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✕ Clear Selection</button>
                  </div>
                )}
                <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Customer</label>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        <button type="button" onClick={() => setPosForm({...posForm, customerType: 'list'})} style={{ flex: 1, padding: '6px', background: posForm.customerType==='list'?'#3b82f6':'#e2e8f0', color: posForm.customerType==='list'?'#fff':'#333', border:'none', borderRadius:'6px 0 0 6px', cursor:'pointer' }}>From List</button>
                        <button type="button" onClick={() => setPosForm({...posForm, customerType: 'walkin'})} style={{ flex: 1, padding: '6px', background: posForm.customerType==='walkin'?'#3b82f6':'#e2e8f0', color: posForm.customerType==='walkin'?'#fff':'#333', border:'none', borderRadius:'0 6px 6px 0', cursor:'pointer' }}>Walk-in</button>
                      </div>
                      {posForm.customerType === 'list' ? (
                        <>
                          <select value={posForm.customerId} onChange={e => { setPosForm({...posForm, customerId: e.target.value}); if(showLoyaltyCard) setShowLoyaltyCard(null); }} style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Select Customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.loyalty_points||0} pts)</option>)}</select>
                          {posForm.customerId && customers.find(c => c.id == posForm.customerId)?.loyalty_points > 0 && (
                            <div style={{ marginTop: '6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', color: '#7c3aed' }}>⭐ {customers.find(c => c.id == posForm.customerId)?.loyalty_points} pts</span>
                              <button type="button" onClick={() => redeemLoyalty(posForm.customerId, Math.floor(posForm.customerId ? customers.find(c => c.id == posForm.customerId).loyalty_points : 0))} style={{ padding: '4px 8px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Redeem Points</button>
                            </div>
                          )}
                        </>
                      ) : <input placeholder="Walk-in Name" value={posForm.walkinName} onChange={e => setPosForm({...posForm, walkinName: e.target.value})} style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />}
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Payment Method</label>
                      <select value={posForm.paymentMethod} onChange={e => setPosForm({...posForm, paymentMethod: e.target.value})} style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="cash">💵 Cash</option><option value="card">💳 Card</option><option value="transfer">🏦 Bank Transfer</option></select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Services</label>
                    {posForm.items.map((item, idx) => {
                      const svc = services.find(s => s.id === Number(item.serviceId));
                      const base = svc ? Number(svc.price) * (Number(item.qty)||0) : 0;
                      const disc = Number(item.discount)||0;
                      const adj = Number(item.adjustment)||0;
                      return (
                        <div key={idx} style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', marginBottom: '6px' }}>
                            <select value={item.serviceId} onChange={e => updateItem(idx, 'serviceId', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Select Service</option>{services.map(s => <option key={s.id} value={s.id}>{s.name} (LKR {s.price})</option>)}</select>
                            <input type="tel" inputMode="numeric" placeholder="Qty" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                            <button type="button" onClick={() => removeItemLine(idx)} style={{ padding: '8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🗑️ Remove</button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <input type="tel" inputMode="numeric" placeholder="Discount (-)" value={item.discount || ''} onChange={e => updateItem(idx, 'discount', e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', color: disc > 0 ? '#dc2626' : 'inherit' }} />
                            <input type="tel" inputMode="numeric" placeholder="Adjustment (+)" value={item.adjustment || ''} onChange={e => updateItem(idx, 'adjustment', e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', color: adj > 0 ? '#10b981' : 'inherit' }} />
                          </div>
                          <div style={{ textAlign: 'right', marginTop: '4px', fontSize: '0.85rem', fontWeight: '600' }}>Line Total: LKR {Math.max(0, base - disc + adj).toFixed(2)}</div>
                        </div>
                      );
                    })}
                    <button type="button" onClick={addItemLine} style={{ marginTop: '8px', padding: '6px 12px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>+ Add Service Line</button>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '1.1rem', fontWeight: '700' }}><span>Total Amount:</span><strong>LKR {posSubtotal.toFixed(2)}</strong></div>
                    {posForm.paymentMethod === 'cash' && <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><input type="tel" inputMode="numeric" placeholder="Cash Tendered" value={posForm.amountTendered} onChange={e => setPosForm({...posForm, amountTendered: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} /><div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.8rem' }}>Change Due</div><strong style={{ fontSize: '1.2rem', color: posChange >= 0 ? '#166534' : '#dc2626' }}>LKR {posChange.toFixed(2)}</strong></div></div>}
                  </div>
                  <button type="submit" disabled={isLoading || posSubtotal === 0} style={{ padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: '600' }}>{isLoading ? 'Processing...' : selectedBooking ? '✅ Complete Booking & Invoice' : '✅ Create Invoice'}</button>
                </form>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>📋 Recent Invoices ({invoices.length})</h2>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {invoices.map(inv => (
                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                      <div><strong>#{inv.id}</strong> • {inv.customer_name}<br/><span style={{ fontSize: '0.8rem', color: '#64748b' }}>{inv.payment_method.toUpperCase()} • {new Date(inv.issued_at).toLocaleDateString()}</span></div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontWeight: '600' }}>LKR {inv.total_amount.toFixed(2)}</span>
                        <button onClick={() => printInvoice(inv)} style={{ padding: '6px 10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>🖨️ Print Invoice</button>
                        <button onClick={() => { if(window.confirm('Delete this invoice?')) { supabase.from('invoices').delete().eq('id', inv.id).then(() => fetchData()); }}} style={{ padding: '6px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>🗑️ Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ⚙️ Services */}
          {activeTab === 'services' && (
            <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>{editingService ? '✏️ Edit Service' : '➕ Add Service'}</h2>
                <form onSubmit={editingService ? handleUpdateService : handleAddService} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input placeholder="Service Name" value={editingService?.name || newService.name} onChange={e => editingService ? setEditingService({...editingService, name: e.target.value}) : setNewService({...newService, name: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="tel" inputMode="numeric" placeholder="Price (LKR)" value={editingService?.price || newService.price} onChange={e => editingService ? setEditingService({...editingService, price: e.target.value}) : setNewService({...newService, price: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                    <input type="tel" inputMode="numeric" placeholder="Duration (min)" value={editingService?.duration || newService.duration} onChange={e => editingService ? setEditingService({...editingService, duration: e.target.value}) : setNewService({...newService, duration: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  </div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Price Effective From:</label>
                  <input type="date" value={editingService?.effective_from || newService.effective_from} onChange={e => editingService ? setEditingService({...editingService, effective_from: e.target.value}) : setNewService({...newService, effective_from: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button type="submit" disabled={isLoading} style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{isLoading ? 'Saving...' : editingService ? '💾 Update Service' : '➕ Add Service'}</button>
                    {editingService && <button type="button" onClick={() => setEditingService(null)} style={{ padding: '10px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>❌ Cancel</button>}
                  </div>
                </form>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>📋 Services ({services.length})</h2>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {services.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <div><strong style={{ fontSize: '1rem', color: '#0f172a' }}>{s.name}</strong> • LKR {s.price} / {s.duration}m<div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>From: {new Date(s.price_effective_from).toLocaleDateString()}</div></div>
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

          {/* 🏭 Suppliers & Expenses */}
          {activeTab === 'suppliers_expenses' && (
            <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>🏭 Add Supplier</h2>
                <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <input placeholder="Supplier Name" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <input placeholder="Contact" value={newSupplier.contact} onChange={e => setNewSupplier({...newSupplier, contact: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <button type="submit" style={{ padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>💾 Save Supplier</button>
                </form>
                <h3>Suppliers ({suppliers.length})</h3>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {suppliers.map(s => <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}><strong>{s.name}</strong><span style={{ color: '#64748b', fontSize: '0.8rem' }}>{s.contact}</span></div>)}
                </div>
              </div>
              
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>📦 Record Bill</h2>
                <form onSubmit={handleAddBill} className="form-row" style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
                  <select value={newBill.supplier_id || ''} onChange={e => setNewBill({...newBill, supplier_id: e.target.value, supplier_name: suppliers.find(s => s.id == e.target.value)?.name || ''})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <option value="">Select Recurring</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input placeholder="Or type cash supplier" value={newBill.supplier_id ? '' : newBill.supplier_name} onChange={e => setNewBill({...newBill, supplier_name: e.target.value, supplier_id: ''})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <input type="tel" inputMode="numeric" placeholder="Amount (LKR)" value={newBill.amount} onChange={e => setNewBill({...newBill, amount: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <input type="date" value={newBill.bill_date} onChange={e => setNewBill({...newBill, bill_date: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <select value={newBill.category} onChange={e => setNewBill({...newBill, category: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    {expenseTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                  <select value={newBill.payment_method} onChange={e => setNewBill({...newBill, payment_method: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <option value="cash">💵 Cash</option>
                    <option value="card">💳 Card</option>
                    <option value="bank_transfer">🏦 Bank Transfer</option>
                  </select>
                  <input placeholder="Description" value={newBill.description} onChange={e => setNewBill({...newBill, description: e.target.value})} style={{ gridColumn: '1 / -1', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <button type="submit" disabled={isLoading} style={{ gridColumn: '1 / -1', padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{isLoading ? 'Saving...' : '📥 Add Bill'}</button>
                </form>
                
                <div style={{ marginTop: '1.5rem' }}>
                  <h3>🏷️ Manage Expense Types</h3>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input value={newExpenseType} onChange={e => setNewExpenseType(e.target.value)} placeholder="New type" style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    <button onClick={handleAddExpenseType} style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>➕ Add Type</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {expenseTypes.map(t => (
                      <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                        {t} <button onClick={() => handleDeleteExpenseType(t)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0 2px' }}>✕</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
                  <h3>Recent Bills</h3>
                  {bills.map(b => <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' }}><div><strong>{b.supplier_name}</strong> • {b.category}<div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(b.bill_date).toLocaleDateString()}</div></div><span style={{ fontWeight: '600', color: '#dc2626' }}>-LKR {b.amount}</span></div>)}
                </div>
              </div>
            </div>
          )}

          {/* 💵 Cash & Bank Ledgers */}
          {activeTab === 'cash_bank' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>📅 Period:</span>
                  <input type="date" value={ledgerFrom} onChange={e => setLedgerFrom(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  <span>to</span>
                  <input type="date" value={ledgerTo} onChange={e => setLedgerTo(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => printLedger('cash')} style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>🖨️ Print Cash Report</button>
                  <button onClick={() => printLedger('bank')} style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>🖨️ Print Bank Report</button>
                </div>
              </div>

              <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {/* Cash */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                  <h2>💵 Cash Book</h2>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', background: '#f8fafc', padding: '10px', borderRadius: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Opening Date (Fixed)</label>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                        <input type="date" value={cashOpenDate} onChange={e => setCashOpenDate(e.target.value)} disabled={!isEditingCashOB} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1, opacity: isEditingCashOB ? 1 : 0.7 }} />
                        <button onClick={() => setIsEditingCashOB(!isEditingCashOB)} style={{ padding: '6px', background: isEditingCashOB ? '#dc2626' : '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>{isEditingCashOB ? '✕ Cancel' : '✏️ Edit'}</button>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Opening Amount</label>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <input type="number" step="0.01" value={openingCash || ''} onChange={e => setOpeningCash(parseFloat(e.target.value || '0'))} disabled={!isEditingCashOB} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1, opacity: isEditingCashOB ? 1 : 0.7 }} />
                        <button onClick={() => { if(isEditingCashOB) { setIsEditingCashOB(false); localStorage.setItem('salon_opening_cash', openingCash); alert('💾 Cash opening balance saved!'); } }} style={{ padding: '6px 10px', background: isEditingCashOB ? '#10b981' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: isEditingCashOB ? 'pointer' : 'default', fontSize: '0.8rem' }} disabled={!isEditingCashOB}>💾 Save</button>
                      </div>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '500px' }}>
                      <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                        <tr><th style={{ padding: '8px' }}>Date</th><th style={{ padding: '8px' }}>Description</th><th style={{ padding: '8px', textAlign: 'right' }}>Amount</th><th style={{ padding: '8px', textAlign: 'right' }}>Balance</th></tr>
                      </thead>
                      <tbody>
                        {accountingData.cash.txns.length === 0 ? (<tr><td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>No transactions.</td></tr>) : accountingData.cash.txns.map(txn => (
                          <tr key={txn.date+txn.amount} style={{ borderBottom: '1px solid #f1f5f9', background: txn.type === 'opening' ? '#fef3c7' : 'transparent' }}>
                            <td style={{ padding: '8px' }}>{new Date(txn.date).toLocaleDateString()}</td>
                            <td style={{ padding: '8px' }}>{txn.desc}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: txn.type === 'income' ? '#10b981' : txn.type === 'opening' ? '#d97706' : '#dc2626', fontWeight: '600' }}>{txn.type === 'income' ? '+' : txn.type === 'opening' ? '' : '-'}LKR {Math.abs(txn.amount).toFixed(2)}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>LKR {txn.balance.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr style={{ background: '#eff6ff' }}><td colSpan="3" style={{ padding: '12px', textAlign: 'right', fontWeight: '700' }}>Closing:</td><td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#1e40af' }}>LKR {accountingData.cash.closing.toFixed(2)}</td></tr></tfoot>
                    </table>
                  </div>
                </div>

                {/* Bank */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                  <h2>🏦 Bank Ledger</h2>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', background: '#f8fafc', padding: '10px', borderRadius: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Opening Date (Fixed)</label>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                        <input type="date" value={bankOpenDate} onChange={e => setBankOpenDate(e.target.value)} disabled={!isEditingBankOB} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1, opacity: isEditingBankOB ? 1 : 0.7 }} />
                        <button onClick={() => setIsEditingBankOB(!isEditingBankOB)} style={{ padding: '6px', background: isEditingBankOB ? '#dc2626' : '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>{isEditingBankOB ? '✕ Cancel' : '✏️ Edit'}</button>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Opening Amount</label>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <input type="number" step="0.01" value={openingBank || ''} onChange={e => setOpeningBank(parseFloat(e.target.value || '0'))} disabled={!isEditingBankOB} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1, opacity: isEditingBankOB ? 1 : 0.7 }} />
                        <button onClick={() => { if(isEditingBankOB) { setIsEditingBankOB(false); localStorage.setItem('salon_opening_bank', openingBank); alert('💾 Bank opening balance saved!'); } }} style={{ padding: '6px 10px', background: isEditingBankOB ? '#10b981' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: isEditingBankOB ? 'pointer' : 'default', fontSize: '0.8rem' }} disabled={!isEditingBankOB}>💾 Save</button>
                      </div>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '500px' }}>
                      <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                        <tr><th style={{ padding: '8px' }}>Date</th><th style={{ padding: '8px' }}>Description</th><th style={{ padding: '8px', textAlign: 'right' }}>Amount</th><th style={{ padding: '8px', textAlign: 'right' }}>Balance</th></tr>
                      </thead>
                      <tbody>
                        {accountingData.bank.txns.length === 0 ? (<tr><td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>No transactions.</td></tr>) : accountingData.bank.txns.map(txn => (
                          <tr key={txn.date+txn.amount} style={{ borderBottom: '1px solid #f1f5f9', background: txn.type === 'opening' ? '#fef3c7' : 'transparent' }}>
                            <td style={{ padding: '8px' }}>{new Date(txn.date).toLocaleDateString()}</td>
                            <td style={{ padding: '8px' }}>{txn.desc}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: txn.type === 'income' ? '#10b981' : txn.type === 'opening' ? '#d97706' : '#dc2626', fontWeight: '600' }}>{txn.type === 'income' ? '+' : txn.type === 'opening' ? '🏦' : '-'}LKR {Math.abs(txn.amount).toFixed(2)}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>LKR {txn.balance.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr style={{ background: '#eff6ff' }}><td colSpan="3" style={{ padding: '12px', textAlign: 'right', fontWeight: '700' }}>Closing:</td><td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#1e40af' }}>LKR {accountingData.bank.closing.toFixed(2)}</td></tr></tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 📄 Statements */}
          {activeTab === 'statements' && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
                <h2>📄 Financial Statement</h2>
                <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>🖨️ Print Statement</button>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#fff', borderRadius: '6px' }}><span>📈 Revenue</span><strong style={{ color: '#10b981' }}>LKR {(accountingData.cash.totalIn + accountingData.bank.totalIn).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#fff', borderRadius: '6px' }}><span>📦 Materials</span><strong style={{ color: '#dc2626' }}>-LKR {bills.filter(b => b.category === 'materials').reduce((s,b) => s + Number(b.amount||0), 0).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#fff', borderRadius: '6px' }}><span>👷 Labour</span><strong style={{ color: '#dc2626' }}>-LKR {bills.filter(b => b.category === 'labour').reduce((s,b) => s + Number(b.amount||0), 0).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f0fdf4', borderRadius: '6px', fontWeight: 'bold' }}><span>💰 Gross Profit</span><strong style={{ color: '#15803d' }}>LKR {(accountingData.cash.totalIn + accountingData.bank.totalIn - bills.filter(b => b.category === 'materials' || b.category === 'labour').reduce((s,b) => s + Number(b.amount||0), 0)).toFixed(2)}</strong></div>
                
                {/* Other Expenses Breakdown */}
                {expenseTypes.filter(t => !['materials','labour'].includes(t)).map(cat => {
                  const total = bills.filter(b => b.category === cat).reduce((s,b) => s + Number(b.amount||0), 0);
                  if (total === 0) return null;
                  return (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#fff', borderRadius: '6px', marginLeft: '1rem' }}>
                      <span style={{ color: '#64748b' }}>• {cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                      <strong style={{ color: '#dc2626' }}>-LKR {total.toFixed(2)}</strong>
                    </div>
                  );
                })}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#eff6ff', borderRadius: '6px', fontWeight: 'bold', fontSize: '1.1em' }}><span>🎯 Net Profit</span><strong style={{ color: '#1e40af' }}>LKR {(accountingData.cash.totalIn + accountingData.bank.totalIn - bills.reduce((s,b) => s + Number(b.amount||0), 0)).toFixed(2)}</strong></div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer style={{ background: '#fff', borderTop: '2px solid #e2e8f0', padding: '1rem', textAlign: 'center', marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {bizHubLogo && <img src={bizHubLogo} alt="BizHub" style={{ height: '30px' }} />}
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Powered by <strong style={{ color: '#059669' }}>BizHub Solutions</strong></span>
        </div>
        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>Professional Business Management Solutions</div>
      </footer>

      {/* Loyalty Card Modal */}
      {showLoyaltyCard && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={() => setShowLoyaltyCard(null)}>
          <div style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', borderRadius: '16px', padding: '2rem', maxWidth: '350px', width: '100%', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '2rem' }}>⭐</span>
              <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>Loyalty Card</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>{showLoyaltyCard.name}</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '1.5rem' }}>Member since {new Date().toLocaleDateString()}</div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '3rem', fontWeight: '800' }}>{showLoyaltyCard.loyalty_points || 0}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Points Available</div>
              <div style={{ fontSize: '0.8rem', opacity: '0.8', marginTop: '4px' }}>Value: LKR {(showLoyaltyCard.loyalty_points || 0).toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowLoyaltyCard(null)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>❌ Close</button>
              <button onClick={() => { redeemLoyalty(showLoyaltyCard.id, Math.min(showLoyaltyCard.loyalty_points || 0, 100)); setShowLoyaltyCard(null); }} style={{ flex: 1, padding: '10px', background: '#fff', color: '#7c3aed', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>💰 Redeem Points</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}