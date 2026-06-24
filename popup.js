// ============================================================
// Inbox Focus — popup.js
// Powers the settings panel that opens from the toolbar icon.
// ============================================================

function loadPriorityList() {
  chrome.storage.local.get(['highPriority'], function (result) {
    const list = document.getElementById('priorityList');
    const senders = result.highPriority || [];

    if (senders.length === 0) {
      list.innerHTML = '<li class="empty">No senders tagged yet</li>';
      return;
    }

    list.innerHTML = senders.map(s => `
      <li>
        <span>${cleanSender(s)}</span>
        <button class="remove-btn" data-sender="${s}">Remove</button>
      </li>
    `).join('');

    list.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        removeSender(this.getAttribute('data-sender'));
      });
    });
  });
}

function removeSender(sender) {
  chrome.storage.local.get(['highPriority'], function (result) {
    const updated = (result.highPriority || []).filter(s => s !== sender);
    chrome.storage.local.set({ highPriority: updated }, loadPriorityList);
  });
}

function cleanSender(from) {
  if (!from) return 'Unknown';
  const match = from.match(/^(.*?)</);
  return (match ? match[1].trim() : from).replace(/"/g, '');
}

document.getElementById('refreshBtn').addEventListener('click', function () {
  chrome.tabs.query({ url: 'https://mail.google.com/*' }, function (tabs) {
    tabs.forEach(tab => chrome.tabs.reload(tab.id));
  });
  window.close();
});

loadPriorityList();