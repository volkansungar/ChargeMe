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
    <h2 style="font-size: 18px; margin-bottom: 20px;">Wallet</h2>
    
    <div style="text-align: center; margin-bottom: 24px;">
      <div class="text-muted" style="font-size: 12px; margin-bottom: 4px;">Current Balance</div>
      <div style="font-size: 32px; font-weight: 700; color: var(--green);" id="modal-wallet-balance">
        ₺${currentBalance.toFixed(2)}
      </div>
    </div>

    <form id="topup-form">
      <div class="form-group">
        <label class="form-label">Top Up Amount (₺)</label>
        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <button type="button" class="btn btn-ghost" style="flex:1; padding: 6px;" onclick="document.getElementById('t-amount').value = 100">100</button>
          <button type="button" class="btn btn-ghost" style="flex:1; padding: 6px;" onclick="document.getElementById('t-amount').value = 250">250</button>
          <button type="button" class="btn btn-ghost" style="flex:1; padding: 6px;" onclick="document.getElementById('t-amount').value = 500">500</button>
          <button type="button" class="btn btn-ghost" style="flex:1; padding: 6px;" onclick="document.getElementById('t-amount').value = 1000">1000</button>
        </div>
        <input type="number" id="t-amount" class="form-input" min="1" max="10000" required placeholder="Custom amount">
      </div>
      
      <button type="submit" class="btn btn-success" style="width: 100%; margin-top: 8px;">Top Up</button>
    </form>
  `;

  window.openModal(html);

  document.getElementById('topup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
      const amount = parseFloat(document.getElementById('t-amount').value);
      const res = await api.topupWallet(amount);
      
      document.getElementById('modal-wallet-balance').textContent = `₺${res.balance.toFixed(2)}`;
      await updateWalletDisplay();
      
      window.showToast(`Added ₺${amount.toFixed(2)} to wallet`);
      setTimeout(() => window.closeModal(), 1500);
    } catch (err) {
      window.showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Top Up';
    }
  });
}
