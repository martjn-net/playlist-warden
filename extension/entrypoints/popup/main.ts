// Popup wiring: open the options page (MV3 CSP forbids inline handlers).
import { browser } from 'wxt/browser';

const button = document.getElementById('open-options');
button?.addEventListener('click', () => {
  void browser.runtime.openOptionsPage();
  window.close();
});
