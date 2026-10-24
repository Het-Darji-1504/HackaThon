/**
 * Work Satthi dashboard — direct Supabase integration.
 * Uses the browser publishable key and Supabase RLS; no separate API server required.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const client = window.supabase && window.supabase.createClient &&
    window.WORK_SATTHI_SUPABASE_URL && window.WORK_SATTHI_SUPABASE_KEY
      ? window.supabase.createClient(window.WORK_SATTHI_SUPABASE_URL, window.WORK_SATTHI_SUPABASE_KEY)
      : null;
  let currentUser = null;
  let profile = null;
  let services = [];

  function setMessage(id, message, isError) {
    const el = $(id);
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', Boolean(isError));
  }
  function failIfError(result) {
    if (result.error) throw result.error;
    return result.data;
  }
  function serviceName(slug) {
    const item = services.find((s) => s.slug === slug);
    return item ? item.name : slug;
  }
  function applyProfile() {
    if (!profile) return;
    const welcome = $('welcome');
    if (welcome) welcome.textContent = 'Hello, ' + (profile.full_name || currentUser.email.split('@')[0]).split(' ')[0];
    const roleNote = $('role-note');
    if (roleNote) roleNote.textContent = profile.role === 'worker'
      ? 'Worker account · Make your skills easy to discover.'
      : 'Customer account · Find local services and manage requests.';
    const isWorker = profile.role === 'worker';
    ['worker-profile-fields'].forEach((id) => $(id)?.classList.toggle('hidden', !isWorker));
    ['booking-card', 'workers-card', 'bookings-card'].forEach((id) => $(id)?.classList.toggle('hidden', isWorker));
    const form = $('profile-form');
    if (form) {
      form.elements.name.value = profile.full_name || '';
      form.elements.phone.value = profile.phone || '';
      form.elements.area.value = profile.area || '';
    }
    if (isWorker && profile.worker) {
      const w = profile.worker;
      if (form.elements.service) form.elements.service.value = w.service_slug || '';
      if (form.elements.rate) form.elements.rate.value = w.hourly_rate == null ? '' : String(w.hourly_rate);
      if (form.elements.experience) form.elements.experience.value = w.experience_level || '';
      if (form.elements.availability) form.elements.availability.value = w.availability_summary || '';
      if (form.elements.bio) form.elements.bio.value = w.bio || '';
    }
    const bookingPhone = $('booking-form')?.elements.phone;
    if (bookingPhone && profile.phone) bookingPhone.value = profile.phone;
  }
  async function loadProfile(user) {
    currentUser = user;
    const p = failIfError(await client.from('profiles').select('*').eq('id', user.id).maybeSingle());
    if (!p) {
      const inserted = failIfError(await client.from('profiles').insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
        phone: user.user_metadata?.phone || null,
        area: user.user_metadata?.area || null,
        role: user.user_metadata?.role === 'worker' ? 'worker' : 'customer'
      }).select().single());
      profile = inserted;
    } else profile = p;
    // Older accounts may have a profile row but be missing the worker_profiles row.
    // Do not silently treat these users as disconnected: initialise the worker row when
    // the trusted profile role is already worker, then load it for editing.
    if (profile.role === 'worker') {
      const w = failIfError(await client.from('worker_profiles').select('*, services(slug,name)').eq('user_id', user.id).maybeSingle());
      if (!w) {
        const serviceSlug = user.user_metadata?.service || '';
        const service = services.find((item) => item.slug === serviceSlug);
        const created = failIfError(await client.from('worker_profiles').upsert({
          user_id: user.id,
          service_id: service?.id || null,
          service_area: profile.area || user.user_metadata?.area || null,
          city: profile.area || user.user_metadata?.area || null,
          hourly_rate: null,
          experience_years: 0,
          bio: '',
          is_listed: true
        }, { onConflict: 'user_id' }).select('*, services(slug,name)').single());
        profile.worker = created ? {
          ...created,
          service_slug: created.services?.slug || serviceSlug,
          experience_level: 'beginner'
        } : null;
        applyProfile();
        return;
      }
      profile.worker = w ? {
        ...w,
        service_slug: w.services?.slug || '',
        experience_level: w.experience_years < 1 ? 'beginner' : w.experience_years < 3 ? 'intermediate' : w.experience_years < 7 ? 'experienced' : 'expert'
      } : null;
    }
    applyProfile();
  }
  async function loadServices() {
    services = failIfError(await client.from('services').select('id,slug,name').eq('is_active', true).order('name')) || [];
  }
  async function loadBookings() {
    const results = $('booking-results');
    if (!results) return;
    results.textContent = 'Loading your requests…';
    const rows = failIfError(await client.from('bookings')
      .select('id,service_name,preferred_at,address,city,status,created_at')
      .eq('customer_id', currentUser.id).order('created_at', { ascending: false }));
    results.innerHTML = '';
    if (!rows?.length) { results.textContent = 'No booking requests yet.'; return; }
    rows.forEach((b) => {
      const article = document.createElement('article'); article.className = 'booking-result';
      const h = document.createElement('h3'); h.textContent = b.service_name;
      const detail = document.createElement('p'); detail.className = 'dash-muted';
      detail.textContent = (b.preferred_at ? new Date(b.preferred_at).toLocaleString() : 'Date to be confirmed') + ' · ' + b.address + ', ' + b.city;
      const status = document.createElement('p'); status.className = 'dash-muted'; status.textContent = 'Status: ' + b.status;
      article.append(h, detail, status); results.append(article);
    });
  }
  const profileForm = $('profile-form');
  profileForm?.addEventListener('submit', async (e) => {
    e.preventDefault(); setMessage('profile-message', 'Saving profile…');
    try {
      const fd = new FormData(profileForm);
      const name = String(fd.get('name') || '').trim();
      if (!name) throw new Error('Please enter your full name.');
      const updated = failIfError(await client.from('profiles').update({
        full_name: name, phone: String(fd.get('phone') || '').trim() || null,
        area: String(fd.get('area') || '').trim() || null, updated_at: new Date().toISOString()
      }).eq('id', currentUser.id).select().single());
      profile = { ...profile, ...updated };
      if (profile.role === 'worker') {
        const slug = String(fd.get('service') || '');
        const service = services.find((s) => s.slug === slug);
        const rateText = String(fd.get('rate') || '').replace(/[^0-9.]/g, '');
        const rate = rateText ? Number(rateText) : null;
        const experienceMap = { beginner: 0, intermediate: 2, experienced: 5, expert: 8 };
        const workerData = {
          user_id: currentUser.id, bio: String(fd.get('bio') || '').trim(),
          service_id: service?.id || null, custom_service: null,
          service_area: profile.area, city: profile.area,
          hourly_rate: Number.isFinite(rate) ? rate : null,
          experience_years: experienceMap[String(fd.get('experience') || '')] ?? 0,
          availability_summary: String(fd.get('availability') || '') || null,
          is_listed: true
        };
        failIfError(await client.from('worker_profiles').upsert(workerData, { onConflict: 'user_id' }));
        profile.worker = { ...workerData, service_slug: slug, experience_level: String(fd.get('experience') || '') };
      }
      applyProfile(); setMessage('profile-message', 'Profile saved to Work Satthi successfully.');
    } catch (err) { setMessage('profile-message', err.message || 'Could not save profile.', true); }
  });
  const bookingForm = $('booking-form');
  bookingForm?.addEventListener('submit', async (e) => {
    e.preventDefault(); setMessage('booking-message', 'Submitting request…');
    try {
      const fd = new FormData(bookingForm);
      const slug = String(fd.get('serviceId') || '');
      const service = services.find((s) => s.slug === slug);
      const location = String(fd.get('location') || '').trim();
      const date = String(fd.get('preferredDate') || '');
      const time = String(fd.get('preferredTime') || '');
      const phone = String(fd.get('phone') || '').trim();
      if (!service || !location || !date || !time || !phone) throw new Error('Please complete all required booking fields.');
      const preferredAt = new Date(date + 'T' + time).toISOString();
      const area = location.split(',').map((v) => v.trim()).filter(Boolean);
      failIfError(await client.from('bookings').insert({
        customer_id: currentUser.id, worker_id: null, service_id: service.id,
        service_name: service.name, description: String(fd.get('details') || '').trim(),
        preferred_at: preferredAt, address: location, city: area.length > 1 ? area[area.length - 1] : (profile.area || location),
        area: area[0] || profile.area || null, contact_phone: phone, status: 'pending'
      }));
      setMessage('booking-message', 'Booking request saved! It is pending until a worker confirms availability.');
      bookingForm.reset();
      if (profile.phone) bookingForm.elements.phone.value = profile.phone;
      await loadBookings();
    } catch (err) { setMessage('booking-message', err.message || 'Could not submit booking.', true); }
  });
  $('worker-search')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get('q') || '').trim().toLowerCase();
    const area = String(fd.get('area') || '').trim().toLowerCase();
    const results = $('worker-results'); results.textContent = 'Searching…';
    try {
      let query = client.from('worker_profiles').select('user_id,bio,experience_years,service_area,city,hourly_rate,availability_summary,profiles!inner(full_name,phone),services(slug,name)').eq('is_listed', true);
      if (area) query = query.or('service_area.ilike.%' + area.replace(/[%_]/g, '') + '%,city.ilike.%' + area.replace(/[%_]/g, '') + '%');
      const rows = failIfError(await query.limit(50));
      const filtered = (rows || []).filter((w) => !q || (w.services?.name || w.custom_service || '').toLowerCase().includes(q) || (w.bio || '').toLowerCase().includes(q));
      results.innerHTML = '';
      if (!filtered.length) { results.textContent = 'No matching worker profiles yet. Try another service or area.'; return; }
      filtered.forEach((w) => {
        const article = document.createElement('article'); article.className = 'worker-result';
        const h = document.createElement('h3'); h.textContent = w.profiles?.full_name || 'Local worker';
        const meta = document.createElement('p'); meta.className = 'dash-muted'; meta.textContent = (w.services?.name || 'Local services') + ' · ' + (w.service_area || w.city || 'Area not listed');
        const rate = document.createElement('p'); rate.className = 'dash-muted'; rate.textContent = w.hourly_rate == null ? 'Rate to be discussed' : '₹' + w.hourly_rate + ' (indicative rate)';
        const bio = document.createElement('p'); bio.textContent = w.bio || 'Local service professional.';
        article.append(h, meta, rate, bio); results.append(article);
      });
    } catch (err) { results.textContent = err.message || 'Worker search failed.'; }
  });
  $('logout')?.addEventListener('click', async () => { await client.auth.signOut(); localStorage.removeItem('workSatthiToken'); localStorage.removeItem('workSatthiUser'); window.location.href = 'login.html'; });
  (async function init() {
    if (!client) { setMessage('profile-message', 'Supabase configuration could not load. Refresh the page or check supabase-config.js.', true); return; }
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) { window.location.href = 'login.html'; return; }
      currentUser = data.session.user;
      await loadServices();
      await loadProfile(currentUser);
      if (profile.role === 'customer') await loadBookings();
    } catch (err) {
      const detail = err && (err.message || err.details || err.hint || err.code);
      setMessage('profile-message', 'Supabase connection reached, but dashboard setup failed: ' + (detail || 'Unknown error') + '. Check the Supabase tables, row-level security policies, and whether the latest dashboard.js has deployed.', true);
    }
  })();
}());
