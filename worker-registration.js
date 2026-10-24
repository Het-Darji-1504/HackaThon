/**
 * Work Satthi — Worker registration page logic (worker-registration.js)
 * Handles: form validation, API submission.
 * Does NOT write inline styles or inject CSS rules.
 */

(function () {
  'use strict';

  const form     = document.getElementById('reg-form');
  const feedback = document.getElementById('reg-feedback');
  const submitBtn = document.getElementById('reg-submit');

  /* -----------------------------------------------------------------------
     Helpers
  ----------------------------------------------------------------------- */
  function showFeedback(message, type) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.remove('is-error', 'is-success');
    if (type) feedback.classList.add(type);
  }

  function clearFeedback() {
    if (!feedback) return;
    feedback.textContent = '';
    feedback.classList.remove('is-error', 'is-success');
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidPhone(phone) {
    return /^\+?[0-9\s()\-]{8,18}$/.test(phone);
  }

  function markField(id, invalid) {
    const field = document.getElementById(id);
    if (!field) return;
    if (invalid) {
      field.setAttribute('aria-invalid', 'true');
    } else {
      field.removeAttribute('aria-invalid');
    }
  }

  /* -----------------------------------------------------------------------
     Validation
  ----------------------------------------------------------------------- */
  function validate(data) {
    if (!data.name || !data.name.trim()) {
      markField('reg-name', true);
      return 'Please enter your full name.';
    }
    markField('reg-name', false);

    if (!data.email || !isValidEmail(data.email)) {
      markField('reg-email', true);
      return 'Please enter a valid email address.';
    }
    markField('reg-email', false);

    if (!data.phone || !isValidPhone(data.phone)) {
      markField('reg-phone', true);
      return 'Please enter a valid phone number.';
    }
    markField('reg-phone', false);

    if (!data.area || !data.area.trim()) {
      markField('reg-area', true);
      return 'Please enter your service area.';
    }
    markField('reg-area', false);

    if (!data.category) {
      markField('reg-category', true);
      return 'Please choose your service category.';
    }
    markField('reg-category', false);

    if (!data.experience) {
      markField('reg-experience', true);
      return 'Please select your experience level.';
    }
    markField('reg-experience', false);

    if (!data.bio || !data.bio.trim() || data.bio.trim().length < 20) {
      markField('reg-bio', true);
      return 'Please write at least a short description of your skills (20 characters minimum).';
    }
    markField('reg-bio', false);

    if (!data.password || data.password.length < 8) {
      markField('reg-password', true);
      return 'Password must be at least 8 characters.';
    }
    markField('reg-password', false);

    if (data.password !== data.passwordConfirm) {
      markField('reg-password-confirm', true);
      return 'Passwords do not match. Please check and try again.';
    }
    markField('reg-password-confirm', false);

    return null; // valid
  }

  /* -----------------------------------------------------------------------
     Form submission
  ----------------------------------------------------------------------- */
  if (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearFeedback();

      const rawData = Object.fromEntries(new FormData(form).entries());
      const error = validate(rawData);

      if (error) {
        showFeedback(error, 'is-error');
        return;
      }

      // Build the payload the API expects
      const payload = {
        name:     rawData.name.trim(),
        email:    rawData.email.trim().toLowerCase(),
        password: rawData.password,
        role:     'worker',
        phone:    rawData.phone.trim(),
        area:     rawData.area.trim(),
        service:  rawData.category,
        rate:     rawData.rate ? rawData.rate.trim() : '',
        bio:      rawData.bio.trim(),
        experience: rawData.experience,
        availability: rawData.availability || '',
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering…';
      }

      try {
        const result = await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        localStorage.setItem('workSatthiToken', result.token);
        localStorage.setItem('workSatthiUser', JSON.stringify(result.user));

        showFeedback(
          (result.message || 'Account created!') +
          ' Redirecting to your dashboard…',
          'is-success'
        );

        setTimeout(function () {
          window.location.href = 'dashboard.html';
        }, 1200);
      } catch (err) {
        showFeedback(err.message || 'Registration failed. Please try again.', 'is-error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Register as a worker';
        }
      }
    });
  }

}());
