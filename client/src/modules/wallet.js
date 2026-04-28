import { api } from '../services/api.js';
import { updateWalletDisplay } from '../main.js';

export async function renderWalletModal() {
  let currentBalance = 0;
  try {
    const wallet = await api.getWallet();
    currentBalance = wallet.balance;
  } catch (e) {
    console.error(e);
  }

  const html = `
    <div class="modal-header">
      <h2 class="text-gradient">My Wallet</h2>
    </div>
    
    <div style="text-align: center; margin: var(--spacing-6) 0;">
      <div class="text-muted" style="margin-bottom: var(--spacing-2);">Current Balance</div>
      <div style="font-size: 3rem; font-weight: 700; color: var(--accent-emerald);" id="modal-wallet-balance">
        ₺${currentBalance.toFixed(2)}
      </div>
    </div>

    <form id="topup-form">
      <div class="form-group">
        <label class="form-label">Top Up Amount (₺)</label>
        <div style="display: flex; gap: var(--spacing-3); margin-bottom: var(--spacing-4);">
          <button type="button" class="btn btn-outline" style="flex:1" onclick="document.getElementById('t-amount').value = 100">100</button>
          <button type="button" class="btn btn-outline" style="flex:1" onclick="document.getElementById('t-amount').value = 250">250</button>
          <button type="button" class="btn btn-outline" style="flex:1" onclick="document.getElementById('t-amount').value = 500">500</button>
          <button type="button" class="btn btn-outline" style="flex:1" onclick="document.getElementById('t-amount').value = 1000">1000</button>
        </div>
        <input type="number" id="t-amount" class="form-input" min="1" max="10000" required placeholder="Enter custom amount">
      </div>
      
      <div class="form-group" style="margin-top: var(--spacing-6);">
        <button type="submit" class="btn btn-success" style="width: 100%;">Top Up via Secure Gateway</button>
      </div>
    </form>
  `;

  window.openModal(html);

  document.getElementById('topup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
      const amount = parseFloat(document.getElementById('t-amount').value);
      const res = await api.topupWallet(amount);
      
      document.getElementById('modal-wallet-balance').textContent = `₺${res.balance.toFixed(2)}`;
      await updateWalletDisplay();
      
      window.showToast(`Successfully added ₺${amount.toFixed(2)} to wallet`);
      setTimeout(() => window.closeModal(), 1500);
    } catch (err) {
      window.showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Top Up via Secure Gateway';
    }
  });
}
