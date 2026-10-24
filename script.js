/**
 * Work Satthi — Shared script
 * Handles: mobile navigation toggle
 * Does NOT manipulate CSS or inline styles.
 */

(function () {
  'use strict';

  /**
   * Mobile navigation toggle
   */
  function initMobileNav() {
    const toggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    if (!toggle || !navLinks) return;

    toggle.addEventListener('click', function () {
      const isOpen = navLinks.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute(
        'aria-label',
        isOpen ? 'Close navigation menu' : 'Open navigation menu'
      );
    });

    // Close nav when a link inside it is clicked (SPA-style hash navigation)
    navLinks.addEventListener('click', function (event) {
      if (event.target.tagName === 'A') {
        navLinks.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation menu');
      }
    });

    // Close nav on Escape key
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && navLinks.classList.contains('is-open')) {
        navLinks.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation menu');
        toggle.focus();
      }
    });
  }

  // Initialise when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
}());
