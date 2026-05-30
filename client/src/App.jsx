import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';

// 🏢 SALON CONFIGURATION - Edit these values directly
const SALON_CONFIG = {
  name: 'Salon Enoka',
  address: '251/8, Kirula Road, Colombo 5',
  telephone: '+94 112 369 777',
  //  Replace these with your actual Supabase Storage public URLs
  salonLogoUrl: 'https://yhkgbcppoealusdhhakp.supabase.co/storage/v1/object/public/Saloon%20App/Enoka%20logo.jpg',
  bizHubLogoUrl: 'https://yhkgbcppoealusdhhakp.supabase.co/storage/v1/object/public/Saloon%20App/BizHub%20Solutions_Company%20Logo.png'
  loyaltyRate: 10,
  openTime: '09:00',
  closeTime: '18:00',
  currentYear: new Date().getFullYear(),
  currency: 'LKR'

export default function App() {
  // 🔐 Auth
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);

  //  Salon Branding
  const [salonName, setSalonName] = useState(SALON_CONFIG.name);
  const [salonLogo, setSalonLogo] = useState(SALON_CONFIG.salonLogoUrl);
  const [bizHubLogo, setBizHubLogo] = useState(SALON_CONFIG.bizHubLogoUrl);
  
  useEffect(() => localStorage.setItem('salon_name', salonName), [salonName]);
  useEffect(() => localStorage.setItem('salon_logo', salonLogo), [salonLogo]);
  useEffect(() => localStorage.setItem('bizhub_logo', bizHubLogo), [bizHubLogo]);

  // ⏰ Current Time
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 📊 Dashboard State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
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

  //  Forms
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', gender: '', age: '' });
  const [newAppointment, setNewAppointment] = useState({ customerId: '', serviceId: '', time: '' });
  const [newSupplier, setNewSupplier] = useState({ name: '', contact: '' });
  const [newBill, setNewBill] = useState({ supplier_id: '', supplier_name: '', amount: '', description: '', bill_date: new Date().toISOString().split('T')[0], category: 'other', payment_method: 'cash' });
  const [newService, setNewService] = useState({ name: '', price: '', duration: '', effective_from: new Date().toISOString().split('T')[0] });
  const [editingService, setEditingService] = useState(null);
  const [newExpenseType, setNewExpenseType] = useState('');
  const [newBlockout, setNewBlockout] = useState({ date: '', reason: '' });

  // 💰 Opening Balances (SEPARATE from ledger period)
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

  // 📅 Ledger Date Range
  const [ledgerFrom, setLedgerFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [ledgerTo, setLedgerTo] = useState(() => new Date().toISOString().split('T')[0]);

  //  POS
  const [posForm, setPosForm] = useState({
    customerType: 'list', customerId: '', walkinName: '',
    items: [{ serviceId: '', qty: 1 }], paymentMethod: 'cash', amountTendered: '',
    discountType: 'none', discountValue: ''
  });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showLoyaltyCard, setShowLoyaltyCard] = useState(null);

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
    setCustomers([]); setServices([]); setAppointments([]); setInvoices([]); setSuppliers([]); setBills([]); setBlockouts([]);
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
      
      // Load custom expense types from localStorage
      const savedTypes = localStorage.getItem('salon_expense_types');
      if (savedTypes) setExpenseTypes(JSON.parse(savedTypes));
      
      // Load blockouts from localStorage (or DB if you add a table later)
      const savedBlockouts = localStorage.getItem('salon_blockouts');
      if (savedBlockouts) setBlockouts(JSON.parse(savedBlockouts));
    } catch (err) { setError('Failed to load data: ' + err.message); }
    finally { setIsLoading(false); }
  };

  // 👤 Customers
  const handleAddCustomer = async (e) => {
    e.preventDefault(); if (!newCustomer.name || !newCustomer.phone) return;
    setIsLoading(true);
    try { 
      const { error } = await supabase.from('customers').insert([{ ...newCustomer, loyalty_points: 0 }]); 
      if (error) throw error; await fetchData(); setNewCustomer({ name: '', phone: '', gender: '', age: '' }); 
    }
    catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };
  const handleEditCustomer = async (id) => {
    const c = customers.find(x => x.id === id); if (!c) return;
    const name = prompt('Name:', c.name);
    const phone = prompt('Phone:', c.phone);
    if (name === null || phone === null) return;
    const gender = prompt('Gender (Male/Female):', c.gender || '');
    const age = prompt('Age:', c.age || '');
    
    setIsLoading(true);
    try {
      const { error } = await supabase.from('customers').update({
        name, phone,
        gender: gender || null,
        age: age ? Number(age) : null
      }).eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };
  const handleDeleteCustomer = async (id) => {
    if (!window.confirm('Delete this customer?')) return; setIsLoading(true);
    try { const { error } = await supabase.from('customers').delete().eq('id', id); if (error) throw error; await fetchData(); } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  // 📅 Bookings
  const isDateBlocked = (dateStr) => {
    const dateOnly = dateStr.split('T')[0];
    return blockouts.some(b => b.date === dateOnly);
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    const dateOnly = newAppointment.time.split('T')[0];
    if (isDateBlocked(dateOnly)) return setError(' This date is blocked. Please choose another date.');
    if (!newAppointment.customerId || !newAppointment.serviceId || !newAppointment.time) return;
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
      const { error } = await supabase.from('supplier_bills').insert({
        supplier_name: finalName, amount: Number(newBill.amount), description: newBill.description,
        bill_date: newBill.bill_date, category: newBill.category, payment_method: newBill.payment_method
      });
      if (error) throw error; await fetchData();
      setNewBill({ supplier_id: '', supplier_name: '', amount: '', description: '', bill_date: new Date().toISOString().split('T')[0], category: expenseTypes[0], payment_method: 'cash' });
    } catch (err) { setError('Failed: ' + err.message); } finally { setIsLoading(false); }
  };

  const handleAddExpenseType = () => {
    if (!newExpenseType.trim()) return;
    const newType = newExpenseType.trim().toLowerCase();
    if (expenseTypes.includes(newType)) return setError('Expense type already exists');
    const updated = [...expenseTypes, newType];
    setExpenseTypes(updated);
    localStorage.setItem('salon_expense_types', JSON.stringify(updated));
    setNewExpenseType('');
  };

  const handleDeleteExpenseType = (type) => {
    if (!window.confirm(`Delete "${type}" expense type?`)) return;
    const updated = expenseTypes.filter(t => t !== type);
    setExpenseTypes(updated);
    localStorage.setItem('salon_expense_types', JSON.stringify(updated));
  };

  const handleAddBlockout = () => {
    if (!newBlockout.date) return;
    const updated = [...blockouts, newBlockout];
    setBlockouts(updated);
    localStorage.setItem('salon_blockouts', JSON.stringify(updated));
    setNewBlockout({ date: '', reason: '' });
  };

  const handleRemoveBlockout = (date) => {
    const updated = blockouts.filter(b => b.date !== date);
    setBlockouts(updated);
    localStorage.setItem('salon_blockouts', JSON.stringify(updated));
  };

  // 🛒 POS Logic
  const posSubtotal = posForm.items.reduce((sum, item) => {
    const svc = services.find(s => s.id === Number(item.serviceId));
    const qty = Number(item.qty) || 0;
    return sum + (svc ? Number(svc.price) * qty : 0);
  }, 0);

  const posDiscount = posForm.discountType === 'percent' 
    ? posSubtotal * (Number(posForm.discountValue) || 0) / 100 
    : posForm.discountType === 'fixed' 
      ? Number(posForm.discountValue) || 0 
      : 0;

  const posTotal = posSubtotal - posDiscount;
  const posChange = posForm.paymentMethod === 'cash' ? Math.max(0, Number(posForm.amountTendered || 0) - posTotal) : 0;

  const updateItem = (index, field, value) => {
    const updated = [...posForm.items]; updated[index] = { ...updated[index], [field]: value };
    setPosForm({ ...posForm, items: updated });
  };
  const addItemLine = () => setPosForm({ ...posForm, items: [...posForm.items, { serviceId: '', qty: 1 }] });
  const removeItemLine = (index) => { if (posForm.items.length > 1) setPosForm({ ...posForm, items: posForm.items.filter((_, i) => i !== index) }); };

  const loadBookingToPOS = (booking) => {
    setSelectedBooking(booking);
    setActiveTab('invoices');
    setPosForm({
      customerType: 'list', customerId: booking.customer_id.toString(), walkinName: '',
      items: [{ serviceId: booking.service_id.toString(), qty: 1 }], paymentMethod: 'cash', amountTendered: '',
      discountType: 'none', discountValue: ''
    });
  };

  const clearBookingSelection = () => {
    setSelectedBooking(null);
    setPosForm({ customerType: 'list', customerId: '', walkinName: '', items: [{ serviceId: '', qty: 1 }], paymentMethod: 'cash', amountTendered: '', discountType: 'none', discountValue: '' });
  };

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
        amount_tendered: posForm.paymentMethod === 'cash' ? Number(posForm.amountTendered) : posTotal, change_amount: posChange, status: 'paid',
        appointment_id: selectedBooking ? selectedBooking.id : null,
        discount_type: posForm.discountType, discount_value: posForm.discountValue
      };
      const { error } = await supabase.from('invoices').insert(invData);
      if (error) throw error;
      
      // Award loyalty points
      if (posForm.customerId) {
        const pointsEarned = Math.floor(posTotal / SALON_CONFIG.loyaltyRate);
        if (pointsEarned > 0) {
          await supabase.from('customers').update({ loyalty_points: (customers.find(c => c.id == posForm.customerId)?.loyalty_points || 0) + pointsEarned }).eq('id', posForm.customerId);
        }
      }
      
      if (selectedBooking) await supabase.from('appointments').update({ status: 'completed' }).eq('id', selectedBooking.id);
      await fetchData();
      clearBookingSelection();
    } catch (err) { setError('Failed to create invoice: ' + err.message); } finally { setIsLoading(false); }
  };

  const redeemLoyalty = async (customerId, points) => {
    if (!customerId) return setError('Select a customer first');
    const customer = customers.find(c => c.id == customerId);
    if (!customer || customer.loyalty_points < points) return setError('Insufficient loyalty points');
    
    const discount = points; // 1 point = $1 discount
    setPosForm({ ...posForm, discountType: 'fixed', discountValue: discount.toString(), customerId });
    setError(`✅ Redeemed ${points} points for $${discount} discount`);
  };

  const printInvoice = (inv) => {
    const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice #${inv.id}</title>
      <style>body{font-family:monospace;width:320px;margin:0 auto;padding:10px}h1,h3{text-align:center;margin:5px 0}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:4px 0;font-size:0.9rem}.total{font-weight:bold;font-size:1.2rem;margin-top:8px;text-align:right}@media print{body{margin:0}}</style></head><body>
      <h1>${salonName}</h1><h3>Invoice #${inv.id}</h3>
      <div class="row"><span>Date:</span><span>${new Date(inv.issued_at).toLocaleDateString()}</span></div>
      <div class="row"><span>Customer:</span><span>${inv.customer_name}</span></div><div class="line"></div>
      ${items.map(i => `<div class="row"><span>${i.qty}x ${i.service}</span><span>$${(i.price * i.qty).toFixed(2)}</span></div>`).join('')}
      ${inv.discount_type !== 'none' ? `<div class="row"><span>Discount (${inv.discount_type === 'percent' ? inv.discount_value + '%' : '$' + inv.discount_value}):</span><span>-$${inv.discount_value}</span></div>` : ''}
      <div class="line"></div>
      <div class="row"><span>Total:</span><span>$${inv.total_amount.toFixed(2)}</span></div>
      ${inv.payment_method === 'cash' ? `<div class="row"><span>Cash:</span><span>$${inv.amount_tendered?.toFixed(2) || '0.00'}</span></div><div class="total"><span>Change:</span><span>$${inv.change_amount?.toFixed(2) || '0.00'}</span></div>` : `<div class="row"><span>Method:</span><span>${inv.payment_method.toUpperCase()}</span></div>`}
      <div class="line"></div><p style="text-align:center;margin-top:15px;font-size:0.85rem">PAID • Thank you! ❤️</p><script>window.print();window.close()</script></body></html>`);
  };

  const printLedger = (type) => {
    const data = accountingData[type];
    const openBal = type === 'cash' ? openingCash : openingBank;
    const openDate = type === 'cash' ? cashOpenDate : bankOpenDate;
    const title = type === 'cash' ? 'Cash Book' : 'Bank & Card Ledger';
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title} ${ledgerFrom} to ${ledgerTo}</title>
      <style>body{font-family:Arial,sans-serif;margin:40px auto;padding:20px;max-width:800px}h1{text-align:center;color:#1e3a8a;border-bottom:2px solid #1e3a8a;padding-bottom:10px}.meta{display:flex;justify-content:space-between;margin-bottom:20px;font-size:0.9rem;color:#64748b}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f8fafc;font-weight:600}tfoot td{font-weight:bold;background:#f0f9ff}.inc{color:#10b981}.exp{color:#dc2626}@media print{body{margin:0}}</style></head><body>
      <h1>${salonName}</h1><p style="text-align:center;font-size:1.1rem">${title} Statement</p>
      <div class="meta"><span>Period: ${ledgerFrom} to ${ledgerTo}</span><span>Opening Balance: $${openBal.toFixed(2)} (as of ${openDate})</span></div>
      <table><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Balance</th></tr></thead><tbody>
      ${data.txns.map(t => `<tr><td>${new Date(t.date).toLocaleDateString()}</td><td>${t.desc}</td><td class="${t.type==='income'?'inc':'exp'}">${t.type==='income'?'+':'-'}$${t.amount.toFixed(2)}</td><td>$${t.balance.toFixed(2)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="3" style="text-align:right">Closing Balance:</td><td>$${data.closing.toFixed(2)}</td></tr></tfoot></table>
      <p style="text-align:center;margin-top:30px;font-size:0.8rem;color:#94a3b8">Generated: ${new Date().toLocaleString()}</p>
      <script>window.print();window.close()</script></body></html>`);
  };

  // 💵 AUTO-LEDGER
  const accountingData = useMemo(() => {
    const inPeriod = (dateStr) => {
      if (!dateStr) return false;
      const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      return d >= ledgerFrom && d <= ledgerTo;
    };

    const buildLedger = (paymentTypes, opening, openingDate) => {
      let txns = [];
      let totalIn = 0, totalOut = 0;
      
      // Add opening balance as first transaction
      if (inPeriod(openingDate)) {
        txns.push({ date: openingDate, desc: ' Opening Balance', amount: opening, type: 'opening' });
      }
      
      invoices.filter(inv => inv.status === 'paid' && inPeriod(inv.issued_at) && paymentTypes.includes(inv.payment_method))
        .forEach(inv => {
          const amt = Number(inv.total_amount || 0);
          totalIn += amt;
          txns.push({ date: inv.issued_at.split('T')[0], desc: `INV #${inv.id} • ${inv.customer_name}`, amount: amt, type: 'income' });
        });
      bills.filter(b => inPeriod(b.bill_date) && paymentTypes.includes(b.payment_method))
        .forEach(b => {
          const amt = Number(b.amount || 0);
          totalOut += amt;
          txns.push({ date: b.bill_date, desc: `BILL • ${b.supplier_name} (${b.category})`, amount: amt, type: 'expense' });
        });
      txns.sort((a, b) => new Date(a.date) - new Date(b.date));
      let runBal = inPeriod(openingDate) ? 0 : opening;
      txns = txns.map(t => {
        runBal += (t.type === 'opening' ? t.amount : t.type === 'income' ? t.amount : -t.amount);
        return { ...t, balance: runBal };
      });
      return { txns, totalIn, totalOut, closing: runBal };
    };

    return {
      cash: buildLedger(['cash'], openingCash, cashOpenDate),
      bank: buildLedger(['card', 'transfer', 'bank_transfer', 'credit_card', 'debit_card'], openingBank, bankOpenDate)
    };
  }, [invoices, bills, ledgerFrom, ledgerTo, openingCash, openingBank, cashOpenDate, bankOpenDate]);

  const upcomingBookings = appointments.filter(a => a.status === 'booked');

  //  Dashboard Data
  const dashboardData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.slice(0, 7);
    const todayInvoices = invoices.filter(inv => inv.status === 'paid' && inv.issued_at?.startsWith(today));
    const monthInvoices = invoices.filter(inv => inv.status === 'paid' && inv.issued_at?.startsWith(thisMonth));
    const todayBookings = appointments.filter(a => a.time?.startsWith(today));
    const todayRevenue = todayInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const monthRevenue = monthInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const todayBills = bills.filter(b => b.bill_date === today);
    const todayExpenses = todayBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    
    // Monthly breakdown for charts
    const monthlyData = {};
    invoices.filter(inv => inv.status === 'paid').forEach(inv => {
      const month = inv.issued_at?.slice(0, 7);
      if (month) monthlyData[month] = (monthlyData[month] || 0) + Number(inv.total_amount || 0);
    });
    
    return { todayInvoices: todayInvoices.length, monthInvoices: monthInvoices.length, todayBookings: todayBookings.length, todayRevenue, monthRevenue, todayExpenses, monthlyData };
  }, [invoices, appointments, bills]);

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
        @media (min-width: 641px) and (max-width: 1024px) {
          .card-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url("https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1920&q=80")', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.05, zIndex: -1 }} />
      
      <div style={{ background: '#1e3a8a', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {salonLogo && <img src={salonLogo} alt="Salon Logo" style={{ height: '40px', borderRadius: '8px' }} />}
          <div>
            <span style={{ color: '#fff', fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', fontWeight: '700', display: 'block', lineHeight: '1.2' }}>{salonName}</span>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', marginTop: '2px' }}>{SALON_CONFIG.address} • {SALON_CONFIG.telephone}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ color: '#fff', fontSize: '0.85rem', textAlign: 'right' }}>
            <div>{currentTime.toLocaleDateString()}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{currentTime.toLocaleTimeString()}</div>
          </div>
          <button onClick={handleLogout} style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>🚪 Logout</button>
        </div>
      </div>
      
      <div className="main-container" style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
        {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>⚠️ {error}</div>}
        {isLoading && <div style={{ textAlign: 'center', padding: '10px', color: '#64748b' }}> Syncing...</div>}
        
        <nav className="nav-tabs" style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', flexWrap: 'wrap', overflowX: 'auto' }}>
          {['dashboard', 'bookings', 'invoices', 'services', 'suppliers_expenses', 'cash_bank', 'statements'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 12px', background: activeTab === tab ? '#3b82f6' : '#f1f5f9', color: activeTab === tab ? '#fff' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: activeTab === tab ? '600' : '400', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
              {tab === 'bookings' ? 'Booking & Customers' : tab === 'suppliers_expenses' ? 'Suppliers & Expenses' : tab === 'cash_bank' ? 'Cash & Bank Ledgers' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        <main>
          {/* 📊 Dashboard */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#f0fdf4', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem' }}>📅</div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#15803d' }}>{dashboardData.todayBookings}</div>
                  <div style={{ fontSize: '0.9rem', color: '#166534' }}>Today's Bookings</div>
                </div>
                <div style={{ background: '#eff6ff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem' }}>💵</div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#2563eb' }}>${dashboardData.todayRevenue.toFixed(0)}</div>
                  <div style={{ fontSize: '0.9rem', color: '#1e40af' }}>Today's Revenue</div>
                </div>
                <div style={{ background: '#fef2f2', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem' }}>📉</div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#dc2626' }}>${dashboardData.todayExpenses.toFixed(0)}</div>
                  <div style={{ fontSize: '0.9rem', color: '#991b1b' }}>Today's Expenses</div>
                </div>
                <div style={{ background: '#f5f3ff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem' }}>📊</div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#7c3aed' }}>{dashboardData.monthInvoices}</div>
                  <div style={{ fontSize: '0.9rem', color: '#5b21b6' }}>Monthly Invoices</div>
                </div>
              </div>

              {/* Revenue Chart */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h3>📈 Monthly Revenue Trend</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '150px', marginTop: '1rem' }}>
                  {Object.entries(dashboardData.monthlyData).slice(-6).map(([month, amount], i) => {
                    const maxVal = Math.max(...Object.values(dashboardData.monthlyData), 1);
                    const height = Math.max((amount / maxVal) * 100, 5);
                    return (
                      <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '100%', height: `${height}%`, background: `linear-gradient(to top, #3b82f6, #60a5fa)`, borderRadius: '4px 4px 0 0', minWidth: '30px' }}></div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{month.slice(5)}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600' }}>${(amount/1000).toFixed(1)}k</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expense Breakdown */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h3>💸 Expense Breakdown</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  {['materials', 'labour', 'utilities', 'rent', 'marketing', 'other'].map(cat => {
                    const catBills = bills.filter(b => b.category === cat);
                    const catTotal = catBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
                    if (catTotal === 0) return null;
                    return (
                      <div key={cat} style={{ flex: '1 1 120px', background: '#f8fafc', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{cat === 'materials' ? '📦' : cat === 'labour' ? '👷' : cat === 'utilities' ? '' : cat === 'rent' ? '' : cat === 'marketing' ? '📢' : '📋'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'capitalize' }}>{cat}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#dc2626' }}>${catTotal.toFixed(0)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 👥 Booking & Customers */}
          {activeTab === 'bookings' && (
            <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2> Add Customer</h2>
                <form onSubmit={handleAddCustomer} style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                  <input value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="Name" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <input value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder="Phone" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
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
                
                <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Customers ({customers.length})</h3>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {customers.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <div>
                        <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{c.name}</strong>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>{c.phone} {c.gender ? `• ${c.gender}` : ''} {c.age ? `• ${c.age}y` : ''}</div>
                        {c.loyalty_points > 0 && <div style={{ fontSize: '0.8rem', color: '#7c3aed', marginTop: '2px' }}>⭐ {c.loyalty_points} points</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                        {c.loyalty_points > 0 && <button onClick={() => setShowLoyaltyCard(c)} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>🎴 Card</button>}
                        <button onClick={() => handleEditCustomer(c.id)} style={{ background: '#fff', color: '#d97706', border: '1px solid #fbbf24', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>✏️</button>
                        <button onClick={() => handleDeleteCustomer(c.id)} style={{ background: '#fff', color: '#dc2626', border: '1px solid #f87171', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blockouts */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2> Blocked Dates</h2>
                <form onSubmit={e => { e.preventDefault(); handleAddBlockout(); }} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input type="date" value={newBlockout.date} onChange={e => setNewBlockout({...newBlockout, date: e.target.value})} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <input placeholder="Reason" value={newBlockout.reason} onChange={e => setNewBlockout({...newBlockout, reason: e.target.value})} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <button type="submit" style={{ padding: '8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Block</button>
                </form>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {blockouts.map(b => (
                    <div key={b.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                      <div><strong>{new Date(b.date).toLocaleDateString()}</strong> • {b.reason || 'Blocked'}</div>
                      <button onClick={() => handleRemoveBlockout(b.date)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bookings List */}
              <div className="card-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                  <h2>📅 Bookings ({appointments.length})</h2>
                  <form onSubmit={handleBookAppointment} className="form-row" style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
                    <select value={newAppointment.customerId} onChange={e => setNewAppointment({...newAppointment, customerId: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <select value={newAppointment.serviceId} onChange={e => setNewAppointment({...newAppointment, serviceId: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Service</option>{services.map(s => <option key={s.id} value={s.id}>{s.name} (${s.price})</option>)}</select>
                    <input type="datetime-local" value={newAppointment.time} onChange={e => setNewAppointment({...newAppointment, time: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', gridColumn: '1 / -1' }} />
                    <button type="submit" disabled={isLoading || !services.length} style={{ padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', gridColumn: '1 / -1' }}>✅ Book</button>
                  </form>
                  <div style={{ marginTop: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
                    <input placeholder="🔍 Filter..." value={bookingsFilter} onChange={e => setBookingsFilter(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    {appointments.filter(a => a.customer_name?.toLowerCase().includes(bookingsFilter.toLowerCase()) || a.service_name?.toLowerCase().includes(bookingsFilter.toLowerCase())).map(a => (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                        <div><strong>{a.customer_name}</strong> • {a.service_name}<div style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(a.time).toLocaleString()}</div></div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {a.status === 'booked' && <button onClick={() => loadBookingToPOS(a)} style={{ padding: '4px 8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>💳 Invoice</button>}
                          <select value={a.status} onChange={e => handleStatusChange(a.id, e.target.value)} style={{ padding: '4px', borderRadius: '12px', border: 'none', fontWeight: '600', fontSize: '0.75rem', background: a.status==='booked'?'#dbeafe':a.status==='completed'?'#dcfce7':'#fee2e2', color: a.status==='booked'?'#1d4ed8':a.status==='completed'?'#166534':'#991b1b' }}>
                            <option value="booked">BOOKED</option>
                            <option value="completed">COMPLETED</option>
                            <option value="cancelled">CANCELLED</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
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
                      {upcomingBookings.slice(0, 5).map(booking => (
                        <div key={booking.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#fff', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.9rem' }}><strong>{booking.customer_name}</strong> • {booking.service_name}<div style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(booking.time).toLocaleString()}</div></div>
                          <button onClick={() => loadBookingToPOS(booking)} style={{ padding: '4px 10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Select</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedBooking && (
                  <div style={{ marginBottom: '1rem', padding: '10px', background: '#dcfce7', borderRadius: '8px', border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><strong>📅 Booking:</strong> {selectedBooking.customer_name} - {selectedBooking.service_name}</div>
                    <button onClick={clearBookingSelection} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✕ Clear</button>
                  </div>
                )}
                <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Customer</label>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        <button type="button" onClick={() => setPosForm({...posForm, customerType: 'list'})} style={{ flex: 1, padding: '6px', background: posForm.customerType==='list'?'#3b82f6':'#e2e8f0', color: posForm.customerType==='list'?'#fff':'#333', border:'none', borderRadius:'6px 0 0 6px', cursor:'pointer' }}>List</button>
                        <button type="button" onClick={() => setPosForm({...posForm, customerType: 'walkin'})} style={{ flex: 1, padding: '6px', background: posForm.customerType==='walkin'?'#3b82f6':'#e2e8f0', color: posForm.customerType==='walkin'?'#fff':'#333', border:'none', borderRadius:'0 6px 6px 0', cursor:'pointer' }}>Walk-in</button>
                      </div>
                      {posForm.customerType === 'list' ? (
                        <>
                          <select value={posForm.customerId} onChange={e => { setPosForm({...posForm, customerId: e.target.value}); if(showLoyaltyCard) setShowLoyaltyCard(null); }} style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Select</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} (${c.loyalty_points || 0} pts)</option>)}</select>
                          {posForm.customerId && customers.find(c => c.id == posForm.customerId)?.loyalty_points > 0 && (
                            <div style={{ marginTop: '6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', color: '#7c3aed' }}>⭐ {customers.find(c => c.id == posForm.customerId)?.loyalty_points} pts</span>
                              <button type="button" onClick={() => redeemLoyalty(posForm.customerId, Math.floor(posForm.customerId ? customers.find(c => c.id == posForm.customerId).loyalty_points : 0))} style={{ padding: '4px 8px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Redeem All</button>
                            </div>
                          )}
                        </>
                      ) : <input placeholder="Walk-in Name" value={posForm.walkinName} onChange={e => setPosForm({...posForm, walkinName: e.target.value})} style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Subtotal:</span><strong>${posSubtotal.toFixed(2)}</strong></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '8px' }}>
                      <select value={posForm.discountType} onChange={e => setPosForm({...posForm, discountType: e.target.value, discountValue: ''})} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                        <option value="none">No Discount</option>
                        <option value="percent">% Discount</option>
                        <option value="fixed">$ Fixed Discount</option>
                      </select>
                      {posForm.discountType !== 'none' && <input type="tel" inputMode="numeric" placeholder={posForm.discountType === 'percent' ? 'Percent %' : 'Amount $'} value={posForm.discountValue} onChange={e => setPosForm({...posForm, discountValue: e.target.value})} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '1.1rem', fontWeight: '700' }}><span>Total:</span><strong>${posTotal.toFixed(2)}</strong></div>
                    {posForm.paymentMethod === 'cash' && <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><input type="tel" inputMode="numeric" placeholder="Cash Tendered" value={posForm.amountTendered} onChange={e => setPosForm({...posForm, amountTendered: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} /><div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.8rem' }}>Change Due</div><strong style={{ fontSize: '1.2rem', color: posChange >= 0 ? '#166534' : '#dc2626' }}>${posChange.toFixed(2)}</strong></div></div>}
                  </div>
                  <button type="submit" disabled={isLoading || posTotal === 0} style={{ padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: '600' }}>{isLoading ? 'Processing...' : selectedBooking ? '✅ Complete & Invoice' : '✅ Create Invoice'}</button>
                </form>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>📋 Recent Invoices ({invoices.length})</h2>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
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
              </div>
            </div>
          )}

          {/* ️ Services */}
          {activeTab === 'services' && (
            <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>{editingService ? '✏️ Edit Service' : '➕ Add Service'}</h2>
                <form onSubmit={editingService ? handleUpdateService : handleAddService} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input placeholder="Service Name" value={editingService?.name || newService.name} onChange={e => editingService ? setEditingService({...editingService, name: e.target.value}) : setNewService({...newService, name: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
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

          {/*  Suppliers & Expenses */}
          {activeTab === 'suppliers_expenses' && (
            <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <h2>🏭 Add Supplier</h2>
                <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <input placeholder="Supplier Name" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <input placeholder="Contact (Optional)" value={newSupplier.contact} onChange={e => setNewSupplier({...newSupplier, contact: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <button type="submit" style={{ padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Save Supplier</button>
                </form>
                <h3>Existing Suppliers ({suppliers.length})</h3>
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
                  <input type="tel" inputMode="numeric" placeholder="Amount ($)" value={newBill.amount} onChange={e => setNewBill({...newBill, amount: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <input type="date" value={newBill.bill_date} onChange={e => setNewBill({...newBill, bill_date: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  <select value={newBill.category} onChange={e => setNewBill({...newBill, category: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    {expenseTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                  <select value={newBill.payment_method} onChange={e => setNewBill({...newBill, payment_method: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <option value="cash">💵 Cash</option><option value="bank_transfer">🏦 Bank Transfer</option><option value="credit_card">💳 Credit Card</option><option value="debit_card">💳 Debit Card</option><option value="card">💳 Card</option>
                  </select>
                  <input placeholder="Description (Optional)" value={newBill.description} onChange={e => setNewBill({...newBill, description: e.target.value})} style={{ gridColumn: '1 / -1', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <button type="submit" disabled={isLoading} style={{ gridColumn: '1 / -1', padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{isLoading ? 'Saving...' : '📥 Add Bill'}</button>
                </form>
                
                {/* Custom Expense Types */}
                <div style={{ marginTop: '1.5rem' }}>
                  <h3>🏷️ Manage Expense Types</h3>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input value={newExpenseType} onChange={e => setNewExpenseType(e.target.value)} placeholder="New type name" style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    <button onClick={handleAddExpenseType} style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {expenseTypes.map(t => (
                      <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                        {t}
                        <button onClick={() => handleDeleteExpenseType(t)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0 2px' }}>✕</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
                  <h3>Recent Bills</h3>
                  {bills.map(b => <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' }}><div><strong>{b.supplier_name}</strong> • {b.category}<div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(b.bill_date).toLocaleDateString()}</div></div><span style={{ fontWeight: '600', color: '#dc2626' }}>-${b.amount}</span></div>)}
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
                  <button onClick={() => printLedger('cash')} style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>️ Print Cash</button>
                  <button onClick={() => printLedger('bank')} style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>🖨️ Print Bank</button>
                </div>
              </div>

              <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {/* Cash Panel */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                  <h2>💵 Cash Book</h2>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', background: '#f8fafc', padding: '10px', borderRadius: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Opening Balance Date (Fixed)</label>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                        <input type="date" value={cashOpenDate} onChange={e => setCashOpenDate(e.target.value)} disabled={!isEditingCashOB} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1, opacity: isEditingCashOB ? 1 : 0.7 }} />
                        <button onClick={() => setIsEditingCashOB(!isEditingCashOB)} style={{ padding: '6px', background: isEditingCashOB ? '#dc2626' : '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>{isEditingCashOB ? '✕' : '✏️'}</button>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Opening Amount</label>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <input type="number" step="0.01" value={openingCash || ''} onChange={e => setOpeningCash(parseFloat(e.target.value || '0'))} disabled={!isEditingCashOB} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1, opacity: isEditingCashOB ? 1 : 0.7 }} />
                        <button onClick={() => { if(isEditingCashOB) { setIsEditingCashOB(false); localStorage.setItem('salon_opening_cash', openingCash); alert('💾 Cash opening balance saved!'); } }} style={{ padding: '6px 10px', background: isEditingCashOB ? '#10b981' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: isEditingCashOB ? 'pointer' : 'default', fontSize: '0.8rem' }} disabled={!isEditingCashOB}></button>
                      </div>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '500px' }}>
                      <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                        <tr><th style={{ padding: '8px' }}>Date</th><th style={{ padding: '8px' }}>Description</th><th style={{ padding: '8px', textAlign: 'right' }}>Amount</th><th style={{ padding: '8px', textAlign: 'right' }}>Balance</th></tr>
                      </thead>
                      <tbody>
                        {accountingData.cash.txns.length === 0 ? (
                          <tr><td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>No transactions.</td></tr>
                        ) : accountingData.cash.txns.map(txn => (
                          <tr key={txn.date+txn.amount} style={{ borderBottom: '1px solid #f1f5f9', background: txn.type === 'opening' ? '#fef3c7' : 'transparent' }}>
                            <td style={{ padding: '8px' }}>{new Date(txn.date).toLocaleDateString()}</td>
                            <td style={{ padding: '8px' }}>{txn.desc}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: txn.type === 'income' ? '#10b981' : txn.type === 'opening' ? '#d97706' : '#dc2626', fontWeight: '600' }}>{txn.type === 'income' ? '+' : txn.type === 'opening' ? '🏦' : '-'}${txn.amount.toFixed(2)}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>${txn.balance.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr style={{ background: '#eff6ff' }}><td colSpan="3" style={{ padding: '12px', textAlign: 'right', fontWeight: '700' }}>Closing Balance:</td><td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#1e40af' }}>${accountingData.cash.closing.toFixed(2)}</td></tr></tfoot>
                    </table>
                  </div>
                </div>

                {/* Bank Panel */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                  <h2>🏦 Bank & Card Ledger</h2>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', background: '#f8fafc', padding: '10px', borderRadius: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Opening Balance Date (Fixed)</label>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                        <input type="date" value={bankOpenDate} onChange={e => setBankOpenDate(e.target.value)} disabled={!isEditingBankOB} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1, opacity: isEditingBankOB ? 1 : 0.7 }} />
                        <button onClick={() => setIsEditingBankOB(!isEditingBankOB)} style={{ padding: '6px', background: isEditingBankOB ? '#dc2626' : '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>{isEditingBankOB ? '✕' : '️'}</button>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Opening Amount</label>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <input type="number" step="0.01" value={openingBank || ''} onChange={e => setOpeningBank(parseFloat(e.target.value || '0'))} disabled={!isEditingBankOB} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1, opacity: isEditingBankOB ? 1 : 0.7 }} />
                        <button onClick={() => { if(isEditingBankOB) { setIsEditingBankOB(false); localStorage.setItem('salon_opening_bank', openingBank); alert('💾 Bank opening balance saved!'); } }} style={{ padding: '6px 10px', background: isEditingBankOB ? '#10b981' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: isEditingBankOB ? 'pointer' : 'default', fontSize: '0.8rem' }} disabled={!isEditingBankOB}></button>
                      </div>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '500px' }}>
                      <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                        <tr><th style={{ padding: '8px' }}>Date</th><th style={{ padding: '8px' }}>Description</th><th style={{ padding: '8px', textAlign: 'right' }}>Amount</th><th style={{ padding: '8px', textAlign: 'right' }}>Balance</th></tr>
                      </thead>
                      <tbody>
                        {accountingData.bank.txns.length === 0 ? (
                          <tr><td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>No transactions.</td></tr>
                        ) : accountingData.bank.txns.map(txn => (
                          <tr key={txn.date+txn.amount} style={{ borderBottom: '1px solid #f1f5f9', background: txn.type === 'opening' ? '#fef3c7' : 'transparent' }}>
                            <td style={{ padding: '8px' }}>{new Date(txn.date).toLocaleDateString()}</td>
                            <td style={{ padding: '8px' }}>{txn.desc}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: txn.type === 'income' ? '#10b981' : txn.type === 'opening' ? '#d97706' : '#dc2626', fontWeight: '600' }}>{txn.type === 'income' ? '+' : txn.type === 'opening' ? '🏦' : '-'}${txn.amount.toFixed(2)}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>${txn.balance.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr style={{ background: '#eff6ff' }}><td colSpan="3" style={{ padding: '12px', textAlign: 'right', fontWeight: '700' }}>Closing Balance:</td><td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#1e40af' }}>${accountingData.bank.closing.toFixed(2)}</td></tr></tfoot>
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
                <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🖨️ Print</button>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#fff', borderRadius: '6px' }}><span> Revenue</span><strong style={{ color: '#10b981' }}>${(accountingData.cash.totalIn + accountingData.bank.totalIn).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#fff', borderRadius: '6px' }}><span>📦 Materials</span><strong style={{ color: '#dc2626' }}>-${bills.filter(b => b.category === 'materials').reduce((s,b) => s + Number(b.amount||0), 0).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#fff', borderRadius: '6px' }}><span>👷 Labour</span><strong style={{ color: '#dc2626' }}>-${bills.filter(b => b.category === 'labour').reduce((s,b) => s + Number(b.amount||0), 0).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f0fdf4', borderRadius: '6px', fontWeight: 'bold' }}><span>💰 Gross Profit (Rev - Mat - Lab)</span><strong style={{ color: '#15803d' }}>${(accountingData.cash.totalIn + accountingData.bank.totalIn - bills.filter(b => b.category === 'materials' || b.category === 'labour').reduce((s,b) => s + Number(b.amount||0), 0)).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#fff', borderRadius: '6px' }}><span>📋 Other Expenses</span><strong style={{ color: '#dc2626' }}>-${bills.filter(b => !['materials','labour'].includes(b.category)).reduce((s,b) => s + Number(b.amount||0), 0).toFixed(2)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#eff6ff', borderRadius: '6px', fontWeight: 'bold', fontSize: '1.1em' }}><span>🎯 Net Profit (Gross - Other)</span><strong style={{ color: '#1e40af' }}>${(accountingData.cash.totalIn + accountingData.bank.totalIn - bills.reduce((s,b) => s + Number(b.amount||0), 0)).toFixed(2)}</strong></div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer style={{ background: '#fff', borderTop: '2px solid #e2e8f0', padding: '1rem', textAlign: 'center', marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {bizHubLogo && <img src={bizHubLogo} alt="BizHub Solutions" style={{ height: '30px' }} />}
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
              <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '4px' }}>Value: ${(showLoyaltyCard.loyalty_points || 0).toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowLoyaltyCard(null)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
              <button onClick={() => { redeemLoyalty(showLoyaltyCard.id, Math.min(showLoyaltyCard.loyalty_points || 0, 100)); setShowLoyaltyCard(null); }} style={{ flex: 1, padding: '10px', background: '#fff', color: '#7c3aed', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Redeem</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}