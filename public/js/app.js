// ACO Dashboard - Main JavaScript

// Utility functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Auto-hide alerts after 5 seconds
document.addEventListener('DOMContentLoaded', function() {
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(function(alert) {
    setTimeout(function() {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 0.5s ease';
      setTimeout(function() {
        alert.remove();
      }, 500);
    }, 5000);
  });
});

// Form validation
document.querySelectorAll('form').forEach(function(form) {
  form.addEventListener('submit', function(e) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(function(field) {
      if (!field.value.trim()) {
        isValid = false;
        field.style.borderColor = 'var(--danger)';
      } else {
        field.style.borderColor = 'var(--border)';
      }
    });
    
    if (!isValid) {
      e.preventDefault();
      alert('Please fill in all required fields.');
    }
  });
});

// Confirm before delete
document.querySelectorAll('form[method="DELETE"]').forEach(function(form) {
  form.addEventListener('submit', function(e) {
    if (!confirm('Are you sure you want to delete this item?')) {
      e.preventDefault();
    }
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Escape to close modals
  if (e.key === 'Escape') {
    const modals = document.querySelectorAll('.modal-overlay.active');
    modals.forEach(function(modal) {
      modal.classList.remove('active');
    });
  }
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Copy to clipboard functionality
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      showNotification('Copied to clipboard!');
    }).catch(function(err) {
      console.error('Failed to copy:', err);
    });
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showNotification('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
    document.body.removeChild(textarea);
  }
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'alert alert-success';
  notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999;';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(function() {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease';
    setTimeout(function() {
      notification.remove();
    }, 500);
  }, 2000);
}

// Loading state for buttons
document.querySelectorAll('button[type="submit"]').forEach(function(button) {
  button.addEventListener('click', function() {
    this.textContent = 'Loading...';
    this.disabled = true;
    this.classList.add('loading-state');
  });
});

// Table row click to expand details (if needed)
document.querySelectorAll('table tbody tr').forEach(function(row) {
  row.style.cursor = 'pointer';
  row.addEventListener('click', function() {
    // Add your expand/collapse logic here if needed
  });
});
