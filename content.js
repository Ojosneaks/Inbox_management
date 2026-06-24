// Wait for Gmail to fully load before we do anything
function waitForGmail() {
  const observer = new MutationObserver((mutations, obs) => {
    const inboxPane = document.querySelector('div[role="main"]');
    if (inboxPane) {
      obs.disconnect();
      initInboxFocus();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// This is the main function that kicks everything off
function initInboxFocus() {
  console.log('Inbox Focus is running');
  requestEmails();
  injectTabBar();
}

// Ask background.js to fetch emails
function requestEmails() {
  chrome.runtime.sendMessage({ type: 'GET_EMAILS' }, function(response) {
    if (response.success) {
      console.log('Got emails:', response.data);
      categorizeEmails(response.data);
    } else {
      console.log('Failed to get emails:', response.error);
    }
  });
}

// Sort emails into your three categories
function categorizeEmails(data) {
  // Get your saved high priority senders and categories
  chrome.storage.local.get(['highPriority', 'categories'], function(result) {
    const highPriority = result.highPriority || [];
    
    const categories = {
      highPriority: [],
      work: [],
      financial: [],
      local: [],
      low: []
    };

    // Keywords for each category
    const keywords = {
      work: ['job', 'interview', 'application', 'hiring', 'recruit', 
             'offer', 'position', 'career', 'linkedin'],
      financial: ['bank', 'payment', 'invoice', 'transaction', 'receipt',
                  'bloomberg', 'market', 'invest', 'finance', 'account'],
      local: ['richmond', 'local', 'community', 'neighborhood', 
              'nextdoor', 'rva', 'city', 'county']
    };

    // Loop through every email and sort it
    const messages = data.messages || [];
    messages.forEach(email => {
      const sender = (email.from || '').toLowerCase();
      const subject = (email.subject || '').toLowerCase();
      const combined = sender + ' ' + subject;

      // Check if sender is tagged as high priority first
      if (highPriority.some(hp => combined.includes(hp.toLowerCase()))) {
        categories.highPriority.push(email);
        return;
      }

      // Check work keywords
      if (keywords.work.some(word => combined.includes(word))) {
        categories.work.push(email);
        return;
      }

      // Check financial keywords
      if (keywords.financial.some(word => combined.includes(word))) {
        categories.financial.push(email);
        return;
      }

      // Check local keywords
      if (keywords.local.some(word => combined.includes(word))) {
        categories.local.push(email);
        return;
      }

      // Everything else goes to low priority
      categories.low.push(email);
    });

    console.log('Categories:', categories);
    renderTabs(categories);
  });
}

// Inject your custom tab bar into Gmail
function injectTabBar() {
  // Check if we already injected to avoid duplicates
  if (document.getElementById('inbox-focus-tabs')) return;

  // Find Gmail's tab area
  const gmailTabs = document.querySelector('div[gh="tl"]');
  if (!gmailTabs) return;

  // Create your tab bar
  const tabBar = document.createElement('div');
  tabBar.id = 'inbox-focus-tabs';
  tabBar.innerHTML = `
    <div class="if-tab-bar">
      <div class="if-tab active" data-category="highPriority">
        <span class="if-tab-icon">⚡</span>
        <span class="if-tab-label">Priority</span>
        <span class="if-tab-badge" id="badge-highPriority">0</span>
      </div>
      <div class="if-tab" data-category="work">
        <span class="if-tab-icon">💼</span>
        <span class="if-tab-label">Work</span>
        <span class="if-tab-badge" id="badge-work">0</span>
      </div>
      <div class="if-tab" data-category="financial">
        <span class="if-tab-icon">💰</span>
        <span class="if-tab-label">Financial</span>
        <span class="if-tab-badge" id="badge-financial">0</span>
      </div>
      <div class="if-tab" data-category="local">
        <span class="if-tab-icon">📍</span>
        <span class="if-tab-label">Local</span>
        <span class="if-tab-badge" id="badge-local">0</span>
      </div>
      <div class="if-tab" data-category="low">
        <span class="if-tab-icon">🏷</span>
        <span class="if-tab-label">Low priority</span>
        <span class="if-tab-badge" id="badge-low">0</span>
      </div>
      <span class="if-focus-badge">focus</span>
    </div>
  `;

  // Insert your tab bar above Gmail's existing tabs
  gmailTabs.parentNode.insertBefore(tabBar, gmailTabs);

  // Add click handlers to each tab
  tabBar.querySelectorAll('.if-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      tabBar.querySelectorAll('.if-tab').forEach(t => 
        t.classList.remove('active'));
      this.classList.add('active');
      const category = this.getAttribute('data-category');
      showCategory(category);
    });
  });
}

// Update badge counts and render emails
function renderTabs(categories) {
  // Update badge numbers on each tab
  Object.keys(categories).forEach(category => {
    const badge = document.getElementById('badge-' + category);
    if (badge) {
      badge.textContent = categories[category].length;
    }
  });

  // Show high priority emails first by default
  showCategory('highPriority', categories);

  // Save categories to storage for later use
  chrome.storage.local.set({ cachedCategories: categories });
}

// Display emails for selected category
function showCategory(category, categories) {
  // If categories not passed in grab from storage
  if (!categories) {
    chrome.storage.local.get(['cachedCategories'], function(result) {
      if (result.cachedCategories) {
        displayEmails(result.cachedCategories[category] || []);
      }
    });
    return;
  }
  displayEmails(categories[category] || []);
}

// Render the actual email list
function displayEmails(emails) {
  // Find or create the email display area
  let emailPane = document.getElementById('inbox-focus-emails');
  if (!emailPane) {
    emailPane = document.createElement('div');
    emailPane.id = 'inbox-focus-emails';
    const mainPane = document.querySelector('div[role="main"]');
    if (mainPane) mainPane.appendChild(emailPane);
  }

  // Build email rows
  if (emails.length === 0) {
    emailPane.innerHTML = `
      <div class="if-empty">
        No emails in this category
      </div>`;
    return;
  }

  emailPane.innerHTML = emails.map(email => `
    <div class="if-email-row">
      <div class="if-unread-dot"></div>
      <div class="if-avatar">${(email.from || 'U')[0].toUpperCase()}</div>
      <div class="if-email-content">
        <div class="if-email-top">
          <span class="if-sender">${email.from || 'Unknown'}</span>
          <span class="if-time">${email.date || ''}</span>
        </div>
        <div class="if-subject">${email.subject || 'No subject'}</div>
      </div>
      <button class="if-priority-btn" data-sender="${email.from}">
        ⚡
      </button>
    </div>
  `).join('');

  // Add click handlers for the priority tag button
  emailPane.querySelectorAll('.if-priority-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const sender = this.getAttribute('data-sender');
      tagHighPriority(sender);
      this.style.opacity = '1';
      this.title = 'Tagged as high priority';
    });
  });
}

// Tag a sender as high priority
function tagHighPriority(senderEmail) {
  chrome.storage.local.get(['highPriority'], function(result) {
    const current = result.highPriority || [];
    if (!current.includes(senderEmail)) {
      current.push(senderEmail);
      chrome.storage.local.set({ highPriority: current }, function() {
        console.log('Tagged as high priority:', senderEmail);
        // Refresh emails to show the change
        requestEmails();
      });
    }
  });
}

// Kick everything off
waitForGmail();