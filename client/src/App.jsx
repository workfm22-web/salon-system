import { useState } from 'react';

// 🔌 PREVIEW MODE: Mock data (we'll connect Supabase in Week 2)
const MOCK_CUSTOMERS = [
  { id: 1, name: 'Sarah Johnson', phone: '+1 555-0192' },
  { id: 2, name: 'Mike Chen', phone: '+1 555-0873' }
];

const MOCK_SERVICES = [
  { id: 1, name: "Women's Haircut", price: 45, duration: 45 },
  { id: 2, name: 'Balayage Coloring', price: 120, duration: 120 },
  { id: 3, name: "Men's Grooming", price: 30, duration: 30 }
];

const MOCK_APPOINTMENTS = [
  { id: 1, customer: 'Sarah Johnson', service: "Women's Haircut", time: '2026-05-27T10:00', status: 'booked' },
  { id: 2, customer: 'Mike Chen', service: "Men's Grooming", time: '2026-05-27T14:30', status: 'booked' }
];

export default function App() {
  const [customers, setCustomers] = useState(MOCK_CUSTOMERS);
  const [services] = useState(MOCK_SERVICES);
  const [appointments, setAppointments] = useState(MOCK_APPOINTMENTS);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [newAppointment, setNewAppointment] = useState({ customerId: '', serviceId: '', time: '' });

  const handleAddCustomer = (e) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) return;
    const id = customers.length + 1;
    setCustomers([...customers, { id, ...newCustomer }]);
    setNewCustomer({ name: '', phone: '' });
  };

  const handleBookAppointment = (e) => {
    e.preventDefault();
    if (!newAppointment.customerId || !newAppointment.serviceId || !newAppointment.time) return;
    
    const customer = customers.find(c => c.id === Number(newAppointment.customerId));
    const service = services.find(s => s.id === Number(newAppointment.serviceId));
    
    const id = appointments.length + 1;
    setAppointments([...appointments, {
      id,
      customer: customer.name,
      service: service.name,
      time: newAppointment.time,
      status: 'booked'
    }]);
    setNewAppointment({ customerId: '', serviceId: '', time: '' });
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container">
      <header className="header">
        <h1>✂️ Salon Manager</h1>
        <span style={{ color: 'var(--text-light)' }}>v1.0 • Preview Mode</span>
      </header>

      <div className="grid">
        {/* 👥 Customers */}
        <div className="card">
          <h2>👥 Customers</h2>
          {customers.length === 0 ? <p className="empty">No customers yet</p> : (
            customers.map(c => (
              <div key={c.id} className="list-item">
                <span>{c.name}</span>
                <span style={{ color: 'var(--text-light)' }}>{c.phone}</span>
              </div>
            ))
          )}
          <form onSubmit={handleAddCustomer} style={{ marginTop: 15 }}>
            <div className="form-group">
              <label>Name</label>
              <input value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="Jane Doe" />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder="+1 555-0000" />
            </div>
            <button type="submit">+ Add Customer</button>
          </form>
        </div>

        {/* ✂️ Services */}
        <div className="card">
          <h2>💇‍♀️ Services</h2>
          {services.map(s => (
            <div key={s.id} className="list-item">
              <span>{s.name}</span>
              <span>${s.price} • {s.duration}m</span>
            </div>
          ))}
        </div>

        {/* 📅 Book Appointment */}
        <div className="card">
          <h2>📅 Book Appointment</h2>
          <form onSubmit={handleBookAppointment}>
            <div className="form-group">
              <label>Customer</label>
              <select value={newAppointment.customerId} onChange={e => setNewAppointment({...newAppointment, customerId: e.target.value})}>
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Service</label>
              <select value={newAppointment.serviceId} onChange={e => setNewAppointment({...newAppointment, serviceId: e.target.value})}>
                <option value="">Select service</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Date & Time</label>
              <input type="datetime-local" value={newAppointment.time} onChange={e => setNewAppointment({...newAppointment, time: e.target.value})} />
            </div>
            <button type="submit">✅ Book Now</button>
          </form>
        </div>
      </div>

      {/* 📋 Today's Schedule */}
      <div className="card">
        <h2>📋 Today's Schedule</h2>
        {appointments.length === 0 ? <p className="empty">No appointments booked</p> : (
          appointments.map(a => (
            <div key={a.id} className="list-item">
              <div>
                <strong>{a.customer}</strong> • {a.service}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>{formatDate(a.time)}</div>
              </div>
              <span className={`badge badge-${a.status}`}>{a.status.toUpperCase()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}