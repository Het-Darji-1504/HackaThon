/**
 * Work Satthi — Dashboard page logic (dashboard.js)
 * Handles: auth check, profile load/save, booking request, worker search, booking list.
 * Does NOT write inline styles or inject CSS rules.
 */

(function () {
  'use strict';

  const token = localStorage.getItem('workSatthiToken');
  let currentUser = null;

  /* -----------------------------------------------------------------------
     Helpers
  ----------------------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }

  function setMessage(id, text, isError) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('is-error', Boolean(isError));
  }

  /* -----------------------------------------------------------------------
     Logout
  ----------------------------------------------------------------------- */
  function logout() {
    localStorage.removeItem('workSatthiToken');
    localStorage.removeItem('workSatthiUser');
    window.location.href = 'login.html';
  }

  const logoutBtn = $('logout');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  /* -----------------------------------------------------------------------
     Apply user data to dashboard
  ----------------------------------------------------------------------- */
  function applyUser(user) {
    currentUser = user;

    const welcomeEl = $('welcome');
    if (welcomeEl) {
      welcomeEl.textContent = 'Hello, ' + user.name.split(' ')[0];
    }

    const roleNoteEl = $('role-note');
    if (roleNoteEl) {
      roleNoteEl.textContent = user.role === 'worker'
        ? 'Worker account · Make your skills easy to discover.'
        : 'Customer account · Find local services and manage requests.';
    }

    // Show/hide worker-specific profile fields
    const workerFields = $('worker-profile-fields');
    if (workerFields) {
      workerFields.classList.toggle('hidden', user.role !== 'worker');
    }

    // Show/hide customer-only cards
    const bookingCard  = $('booking-card');
    const workersCard  = $('workers-card');
    const bookingsCard = $('bookings-card');

    if (bookingCard)  bookingCard.classList.toggle('hidden',  user.role === 'worker');
    if (workersCard)  workersCard.classList.toggle('hidden',  user.role === 'worker');
    if (bookingsCard) bookingsCard.classList.toggle('hidden', user.role === 'worker');

    // Populate profile form fields
    const profileForm = $('profile-form');
    if (profileForm) {
      const fields = ['name', 'phone', 'area', 'service', 'rate', 'bio', 'experience', 'availability'];
      fields.forEach(function (key) {
        const field = profileForm.elements.namedItem(key);
        if (field) field.value = user[key] || '';
      });
    }

    // Pre-fill phone in booking form
    const bookingForm = $('booking-form');
    if (bookingForm && user.phone) {
      const phoneField = bookingForm.elements.namedItem('phone');
      if (phoneField) phoneField.value = user.phone;
    }

    // Set date minimum to today
    const dateField = bookingForm && bookingForm.elements.preferredDate;
    if (dateField) {
      dateField.min = new Date().toISOString().slice(0, 10);
    }
  }

  /* -----------------------------------------------------------------------
     Load bookings
  ----------------------------------------------------------------------- */
  async function loadBookings() {
    const resultsEl = $('booking-results');
    if (!resultsEl) return;

    try {
      const data = await apiRequest('/api/bookings/mine');
      resultsEl.innerHTML = '';

      if (!data.bookings || !data.bookings.length) {
        resultsEl.innerHTML = '<p class="dash-empty">No booking requests yet.</p>';
        return;
      }

      data.bookings.forEach(function (booking) {
        const article = document.createElement('article');
        article.className = 'booking-result';

        const h = document.createElement('h3');
        h.textContent = booking.serviceName || booking.serviceId;

        const details = document.createElement('p');
        details.className = 'dash-muted';
        details.textContent = booking.preferredDate + ' · ' + booking.preferredTime + ' · ' + (booking.location || '');

        const status = document.createElement('p');
        status.className = 'dash-muted';
        status.textContent = 'Status: ' + booking.status;

        article.append(h, details, status);

        if (booking.status === 'pending') {
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'dash-cancel-btn';
          cancelBtn.type = 'button';
          cancelBtn.textContent = 'Cancel request';
          cancelBtn.addEventListener('click', async function () {
            try {
              await apiRequest('/api/bookings/' + booking.id, { method: 'DELETE' });
              await loadBookings();
            } catch (err) {
              status.textContent = 'Cancel failed: ' + err.message;
            }
          });
          article.append(cancelBtn);
        }

        resultsEl.append(article);
      });
    } catch (err) {
      if (resultsEl) resultsEl.textContent = err.message;
    }
  }

  /* -----------------------------------------------------------------------
     Profile form
  ----------------------------------------------------------------------- */
  const profileForm = $('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      setMessage('profile-message', 'Saving…');
      const form = e.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const result = await apiRequest('/api/users/me', {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        applyUser(result.user);
        setMessage('profile-message', 'Profile saved successfully.');
      } catch (err) {
        setMessage('profile-message', err.message, true);
      }
    });
  }

  /* -----------------------------------------------------------------------
     Booking request form
  ----------------------------------------------------------------------- */
  const bookingForm = $('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const form = e.currentTarget;
      setMessage('booking-message', 'Submitting request…');
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const result = await apiRequest('/api/bookings', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        setMessage('booking-message', result.message || 'Booking request sent.');
        form.reset();
        // Restore phone and date min after reset
        if (currentUser && currentUser.phone) {
          const phoneField = form.elements.namedItem('phone');
          if (phoneField) phoneField.value = currentUser.phone;
        }
        const dateField = form.elements.preferredDate;
        if (dateField) dateField.min = new Date().toISOString().slice(0, 10);
        await loadBookings();
      } catch (err) {
        setMessage('booking-message', err.message, true);
      }
    });
  }

  /* -----------------------------------------------------------------------
     Worker search
  ----------------------------------------------------------------------- */
  const workerSearchForm = $('worker-search');
  if (workerSearchForm) {
    workerSearchForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.currentTarget).entries());
      const query = new URLSearchParams(data);
      const resultsEl = $('worker-results');

      if (resultsEl) resultsEl.innerHTML = '<p class="dash-empty">Searching…</p>';

      try {
        const result = await apiRequest('/api/workers?' + query.toString());
        if (!resultsEl) return;
        resultsEl.innerHTML = '';

        if (!result.workers || !result.workers.length) {
          resultsEl.innerHTML = '<p class="dash-empty">No matching worker profiles yet. Try a different area or service.</p>';
          return;
        }

        result.workers.forEach(function (worker) {
          const article = document.createElement('article');
          article.className = 'worker-result';

          const h = document.createElement('h3');
          h.textContent = worker.name;

          const meta = document.createElement('p');
          meta.className = 'dash-muted';
          meta.textContent = worker.service + ' · ' + worker.area;

          const rate = document.createElement('p');
          rate.className = 'dash-muted';
          rate.textContent = worker.rate || 'Rate to be discussed';

          const bio = document.createElement('p');
          bio.textContent = worker.bio || 'Local service professional.';

          article.append(h, meta, rate, bio);
          resultsEl.append(article);
        });
      } catch (err) {
        if (resultsEl) resultsEl.textContent = err.message;
      }
    });
  }

  /* -----------------------------------------------------------------------
     Bootstrap — verify auth, load user
  ----------------------------------------------------------------------- */
  (async function init() {
    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    try {
      const data = await apiRequest('/api/auth/me');
      applyUser(data.user);
      if (data.user.role === 'customer') {
        await loadBookings();
      }
    } catch (err) {
      setMessage('profile-message', err.message, true);
      // If token is invalid / expired, send to login
      if (/session|log in|expired/i.test(err.message)) {
        logout();
      }
    }
  }());

}());
