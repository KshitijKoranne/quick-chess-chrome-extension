// Background service worker for QuickChess extension
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed successfully
});

// Handle extension icon click (optional functionality)
chrome.action.onClicked.addListener((tab) => {
  // This is handled by the popup, but we can add additional logic here if needed
});