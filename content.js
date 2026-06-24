// ============================================================
// Inbox Focus — content.js
// Runs inside Gmail. Injects the tab bar and renders emails.
// ============================================================

// ---- Wait for Gmail to finish loading ----
function waitForGmail() {
  const observer = new MutationObserver((mutations, obs) => {
    const inboxPane = document.querySelector('div[role="main"]');
    if (inboxPane) {
      obs.disconnect();
      initInboxFocus();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ---- Kick everything off ----
function initInboxFocus() {
  console.log('Inbox Focus is running');
  injectTabBar();
  requestEmails();
}

// ---- Ask background.js for emails ----
function requestEmails() {
  chrome.runtime.sendMessage({ type: 'GET_EMAILS' }, function (response) {
    if (response && response.success) {
      console.log('Got emails:', response.data);
      categorizeEmails(response.data);
    } else {
      console.log('Failed to get emails:', response && response.error);
    }
  });
}

// ---- Sort emails into categories ----
function categorizeEmails(data) {
  chrome.storage.local.get(['highPriority'], function (result) {
    const highPriority = result.highPriority || [];

    const categories = {
      highPriority: [],
      work: [],
      financial: [],
      local: [],
      low: []
    };

    const keywords = {
      work: ['job', 'interview', 'application', 'hiring', 'recruit',
             'offer', 'position', 'career', 'linkedin'],
      financial: ['bank', 'payment', 'invoice', 'transaction', 'receipt',
                  'bloomberg', 'market', 'invest', 'finance', 'account'],
      local: ['richmond', 'local', 'community', 'neighborhood',
              'nextdoor', 'rva', 'city', 'county']
    };

    const messages = data.messages || [];
    messages.forEach(email => {
      const sender = (email.from || '').toLowerCase();
      const subject = (email.subject || '').toLowerCase();
      const combined = sender + ' ' + subject;

      if (highPriority.some(hp => combined.includes(hp.toLowerCase()))) {
        categories.highPriority.push(email); return;
      }
      if (keywords.work.some(w => combined.includes(w))) {
        categories.work.push(email); return;
      }
      if (keywords.financial.some(w => combined.includes(w))) {
        categories.financial.push(email); return;
      }
      if (keywords.local.some(w => combined.includes(w))) {
        categories.local.push(email); return;
      }
      categories.low.push(email);
    });

    console.log('Categories:', categories);
    renderTabs(categories);
  });
}

// ---- Inject the custom tab bar ----
function injectTabBar() {
  if (document.getElementById('inbox-focus-tabs')) return;

  const gmailTabs = document.querySelector('div[gh="tl"]');
  if (!gmailTabs) return;

  const tabBar = document.createElement('div');
  tabBar.id = 'inbox-focus-tabs';
  tabBar.innerHTML = `
    <div class="if-tab-bar">
      <div class="if-tab active" data-category="highPriority">
        <span class="if-tab-icon">&#9889;</span>
        <span class="if-tab-label">Priority</span>
        <span class="if-tab-badge" id="badge-highPriority">0</span>
      </div>
      <div class="if-tab" data-category="work">
        <span class="if-tab-icon">&#128188;</span>
        <span class="if-tab-label">Work</span>
        <span class="if-tab-badge" id="badge-work">0</span>
      </div>
      <div class="if-tab" data-category="financial">
        <span class="if-tab-icon">&#128176;</span>
        <span class="if-tab-label">Financial</span>
        <span class="if-tab-badge" id="badge-financial">0</span>
      </div>
      <div class="if-tab" data-category="local">
        <span class="if-tab-icon">&#128205;</span>
        <span class="if-tab-label">Local</span>
        <span class="if-tab-badge" id="badge-local">0</span>
      </div>
      <div class="if-tab" data-category="low">
        <span class="if-tab-icon">&#127991;</span>
        <span class="if-tab-label">Low priority</span>
        <span class="if-tab-badge" id="badge-low">0</span>
      </div>
      <span class="if-focus-badge">focus</span>
    </div>
  `;

  gmailTabs.parentNode.insertBefore(tabBar, gmailTabs);

  tabBar.querySelectorAll('.if-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      tabBar.querySelectorAll('.if-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      showCategory(this.getAttribute('data-category'));
    });
  });
}

// ---- Update badges + show default category ----
function renderTabs(categories) {
  Object.keys(categories).forEach(category => {
    const badge = document.getElementById('badge-' + category);
    if (badge) badge.textContent = categories[category].length;
  });
  chrome.storage.local.set({ cachedCategories: categories });
  showCategory('highPriority', categories);
}

// ---- Switch which category is visible ----
function showCategory(category, categories) {
  if (!categories) {
    chrome.storage.local.get(['cachedCategories'], function (result) {
      if (result.cachedCategories) {
        displayEmails(result.cachedCategories[category] || []);
      }
    });
    return;
  }
  displayEmails(categories[category] || []);
}

// ---- Render email rows ----
function displayEmails(emails) {
  let emailPane = document.getElementById('inbox-focus-emails');
  if (!emailPane) {
    emailPane = document.createElement('div');
    emailPane.id = 'inbox-focus-emails';
    const mainPane = document.querySelector('div[role="main"]');
    if (mainPane) mainPane.appendChild(emailPane);
  }

  if (!emails || emails.length === 0) {
    emailPane.innerHTML = `<div class="if-empty">No emails in this category</div>`;
    return;
  }

  emailPane.innerHTML = emails.map(email => `
    <div class="if-email-row">
      ${email.unread ? '<div class="if-unread-dot"></div>' : '<div style="width:8px;flex-shrink:0;"></div>'}
      <div class="if-avatar">${escapeHtml((email.from || 'U')[0].toUpperCase())}</div>
      <div class="if-email-content">
        <div class="if-email-top">
          <span class="if-sender">${escapeHtml(cleanSender(email.from))}</span>
          <span class="if-time">${escapeHtml(email.date || '')}</span>
        </div>
        <div class="if-subject">${escapeHtml(email.subject || 'No subject')}</div>
      </div>
      <button class="if-priority-btn" data-sender="${escapeHtml(email.from || '')}" title="Tag as high priority">&#9889;</button>
    </div>
  `).join('');

  emailPane.querySelectorAll('.if-priority-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      tagHighPriority(this.getAttribute('data-sender'));
      this.style.opacity = '1';
      this.title = 'Tagged as high priority';
    });
  });
}

// ---- Tag a sender as high priority ----
function tagHighPriority(senderEmail) {
  chrome.storage.local.get(['highPriority'], function (result) {
    const current = result.highPriority || [];
    if (!current.includes(senderEmail)) {
      current.push(senderEmail);
      chrome.storage.local.set({ highPriority: current }, function () {
        console.log('Tagged as high priority:', senderEmail);
        requestEmails();
      });
    }
  });
}

// ---- Helpers ----
function cleanSender(from) {
  if (!from) return 'Unknown';
  // "Sarah <sarah@x.com>" -> "Sarah"
  const match = from.match(/^(.*?)</);
  return (match ? match[1].trim() : from).replace(/"/g, '');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Go ----
waitForGmail();