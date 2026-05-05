import { renderMap } from './station-map.js';

export async function renderWelcome(container) {
  container.innerHTML = `
    <div class="welcome-container" style="animation: welcome-fade-in 0.8s var(--spring-easing);">
      
      <!-- Hero Section -->
      <section class="hero-section" style="text-align: center; padding: 60px 20px;">
        <div class="hero-icon" style="font-size: 64px; color: var(--blue); margin-bottom: 24px; animation: hero-icon-float 3s ease-in-out infinite;">
          <i class="ph-fill ph-lightning"></i>
        </div>
        <h1 style="font-size: 48px; font-weight: 800; letter-spacing: -0.05em; margin-bottom: 16px; color: var(--text-0);">
          ChargeMe
        </h1>
        <p style="font-size: 19px; color: var(--text-1); max-width: 600px; margin: 0 auto 32px auto; line-height: 1.4;">
          Experience the most advanced EV charging network in İzmir. 
          Real-time availability, seamless reservations, and instant payments.
        </p>
        <div style="display: flex; justify-content: center; gap: 16px;">
          <button id="btn-get-started" class="btn btn-primary" style="padding: 14px 40px; font-size: 17px;">
            Get Started
          </button>
          <button id="btn-learn-more" class="btn btn-ghost" style="padding: 14px 32px; font-size: 17px;">
            Learn More
          </button>
        </div>
      </section>

      <!-- Features Grid -->
      <section class="features-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 32px; padding: 60px 0;">
        
        <div class="glass-card feature-item" style="transition-delay: 0.1s; padding: 40px 32px; text-align: center;">
          <div class="feature-icon-wrapper" style="background: var(--blue-dim); color: var(--blue);">
            <i class="ph-fill ph-navigation-arrow"></i>
          </div>
          <h3 style="font-size: 20px; margin-bottom: 12px; font-weight: 700;">Smart Discovery</h3>
          <p class="text-secondary" style="font-size: 15px; line-height: 1.5;">Find available chargers near you with real-time status updates and turn-by-turn navigation.</p>
        </div>

        <div class="glass-card feature-item" style="transition-delay: 0.2s; padding: 40px 32px; text-align: center;">
          <div class="feature-icon-wrapper" style="background: var(--blue-dim); color: var(--blue);">
            <i class="ph-fill ph-calendar-check"></i>
          </div>
          <h3 style="font-size: 20px; margin-bottom: 12px; font-weight: 700;">Instant Booking</h3>
          <p class="text-secondary" style="font-size: 15px; line-height: 1.5;">Reserve your slot in seconds. No more waiting in line or checking multiple apps for availability.</p>
        </div>

        <div class="glass-card feature-item" style="transition-delay: 0.3s; padding: 40px 32px; text-align: center;">
          <div class="feature-icon-wrapper" style="background: var(--blue-dim); color: var(--blue);">
            <i class="ph-fill ph-credit-card"></i>
          </div>
          <h3 style="font-size: 20px; margin-bottom: 12px; font-weight: 700;">Secure Wallet</h3>
          <p class="text-secondary" style="font-size: 15px; line-height: 1.5;">Automatic billing and instant top-ups. Manage your charging expenses with a single tap.</p>
        </div>

      </section>

      <!-- Minimal Footer -->
      <footer style="text-align: center; padding: 60px 0; border-top: 0.5px solid var(--border); margin-top: 40px;">
        <p class="text-muted" style="font-size: 12px;">© 2026 EV Charge Network • Ege University FSE Project • Group 29</p>
      </footer>

      <style>
        @keyframes welcome-fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-icon-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .hero-section h1 {
          color: var(--text-0);
          line-height: 1.2;
          padding-bottom: 10px;
          margin-bottom: 6px;
        }
        .features-grid .glass-card {
          animation: welcome-fade-in 0.8s var(--spring-easing) both;
          border-radius: 28px; /* Slightly more rounded for premium feel */
        }
        .feature-icon-wrapper {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin: 0 auto 24px auto;
          transition: transform 0.3s var(--spring-easing);
        }
        .feature-item:hover .feature-icon-wrapper {
          transform: scale(1.1) rotate(5deg);
        }
        .feature-item {
          transition: all 0.4s var(--spring-easing) !important;
        }
        .feature-item:hover {
          background: var(--bg-2);
          transform: translateY(-10px);
          box-shadow: var(--shadow-lg);
        }
      </style>
    </div>
  `;

  document.getElementById('btn-get-started').addEventListener('click', () => {
    window.location.hash = '#/map';
  });

  document.getElementById('btn-learn-more').addEventListener('click', () => {
    window.openModal(`
      <div style="padding: 20px;">
        <h2 style="margin-bottom: 16px;">How it Works</h2>
        <ol style="color: var(--text-1); line-height: 1.45; padding-left: 20px;">
          <li>Register your vehicle details for compatibility checks.</li>
          <li>Find a station on the interactive map.</li>
          <li>Reserve a time slot that fits your schedule.</li>
          <li>Charge your vehicle and pay automatically from your wallet.</li>
        </ol>
        <button class="btn btn-primary" style="width: 100%; margin-top: 24px;" onclick="window.closeModal()">Got it</button>
      </div>
    `);
  });
}
