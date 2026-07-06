/* ===== NOTIFICATION.JS - Weekly Friday Overtime Notification ===== */

const Notif = {
    // Check if notifications are supported
    isSupported() {
        return 'Notification' in window && 'serviceWorker' in navigator;
    },

    // Request notification permission
    async requestPermission() {
        if (!this.isSupported()) {
            alert('Browser tidak mendukung notifikasi.');
            return false;
        }

        const result = await Notification.requestPermission();
        if (result === 'granted') {
            this.enableWeeklyNotif();
            return true;
        }
        return false;
    },

    // Register service worker
    async registerSW() {
        if (!('serviceWorker' in navigator)) return null;
        try {
            const reg = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registered:', reg.scope);
            return reg;
        } catch (e) {
            console.error('SW registration failed:', e);
            return null;
        }
    },

    // Enable weekly Friday 6AM notification
    async enableWeeklyNotif() {
        const reg = await this.registerSW();
        if (!reg) return;

        // Save preference
        localStorage.setItem('notif_enabled', 'true');
        this.updateUI();

        // Schedule the check
        this.scheduleNext();
    },

    // Disable notifications
    disable() {
        localStorage.setItem('notif_enabled', 'false');
        if (this._timer) clearTimeout(this._timer);
        this.updateUI();
    },

    // Schedule next Friday 6AM check
    scheduleNext() {
        if (localStorage.getItem('notif_enabled') !== 'true') return;

        const now = new Date();
        const nextFriday6AM = this.getNextFriday6AM();
        const msUntil = nextFriday6AM.getTime() - now.getTime();

        console.log(`Next notif scheduled: ${nextFriday6AM.toLocaleString('id-ID')} (in ${Math.round(msUntil/60000)} min)`);

        // Set timer
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            this.sendWeeklyReport();
            // Reschedule for next week
            setTimeout(() => this.scheduleNext(), 60000);
        }, msUntil);
    },

    // Get next Friday 6:00 AM
    getNextFriday6AM() {
        const now = new Date();
        const day = now.getDay(); // 0=Sun, 5=Fri
        let daysUntilFri = (5 - day + 7) % 7;
        if (daysUntilFri === 0 && now.getHours() >= 6) {
            daysUntilFri = 7; // Already past 6AM this Friday, go to next
        }
        const next = new Date(now);
        next.setDate(now.getDate() + daysUntilFri);
        next.setHours(6, 0, 0, 0);
        return next;
    },

    // Get the last pay period (Thursday-Wednesday) ending before today
    getLastPayPeriod() {
        const today = new Date();
        const todayStr = Utils.formatDate(today);
        // Go back to find the most recent Wednesday
        const day = today.getDay(); // 0=Sun
        // Last Wednesday: if today is Fri(5), go back 2 days
        const daysBack = (day + 4) % 7; // days since last Wednesday
        const lastWed = new Date(today);
        lastWed.setDate(today.getDate() - (daysBack === 0 ? 7 : daysBack));

        const lastThu = new Date(lastWed);
        lastThu.setDate(lastWed.getDate() - 6);

        return {
            start: Utils.formatDate(lastThu),
            end: Utils.formatDate(lastWed)
        };
    },

    // Calculate overtime for a pay period
    calcPeriodEarnings(periodStart, periodEnd) {
        const profile = DataStore.getProfile();
        const allAttendance = DataStore.load().attendance;
        let totalOvertime = 0;
        let totalMeal = 0;
        let daysWorked = 0;

        for (const [dateStr, record] of Object.entries(allAttendance)) {
            if (dateStr >= periodStart && dateStr <= periodEnd && record.present) {
                const earning = Calc.calcDayEarning(profile.salary, record);
                totalOvertime += earning.overtime;
                totalMeal += earning.meal;
                daysWorked++;
            }
        }

        return {
            totalOvertime,
            totalMeal,
            total: totalOvertime + totalMeal,
            daysWorked,
            periodStart,
            periodEnd
        };
    },

    // Send the weekly notification
    async sendWeeklyReport() {
        if (Notification.permission !== 'granted') return;

        const period = this.getLastPayPeriod();
        const earnings = this.calcPeriodEarnings(period.start, period.end);
        const profile = DataStore.getProfile();

        const title = `💰 Laporan Lembur Minggu Ini`;
        const body = earnings.daysWorked > 0
            ? `Total: ${Utils.formatRupiah(earnings.total)} (${earnings.daysWorked} hari)\nLembur: ${Utils.formatRupiah(earnings.totalOvertime)} + Makan: ${Utils.formatRupiah(earnings.totalMeal)}\nPeriode: ${Utils.formatDateDisplay(period.start)} - ${Utils.formatDateDisplay(period.end)}`
            : `Tidak ada data lembur minggu ini.\nPeriode: ${Utils.formatDateDisplay(period.start)} - ${Utils.formatDateDisplay(period.end)}`;

        try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(title, {
                body: body,
                icon: 'icon-192.png',
                badge: 'icon-192.png',
                vibrate: [200, 100, 200],
                tag: 'weekly-overtime-report',
                renotify: true,
                data: { url: window.location.href }
            });
        } catch (e) {
            // Fallback: basic notification
            new Notification(title, { body: body, icon: 'icon-192.png' });
        }

        // Save last sent time
        localStorage.setItem('notif_last_sent', new Date().toISOString());
    },

    // Test notification now
    async testNotif() {
        if (Notification.permission !== 'granted') {
            const ok = await this.requestPermission();
            if (!ok) return;
        }
        await this.sendWeeklyReport();
    },

    // Update notification UI
    updateUI() {
        const btn = document.getElementById('notif-toggle-btn');
        const status = document.getElementById('notif-status-text');
        if (!btn || !status) return;

        const enabled = localStorage.getItem('notif_enabled') === 'true';
        const hasPermission = Notification.permission === 'granted';

        if (enabled && hasPermission) {
            btn.textContent = '🔕 Matikan Notifikasi';
            btn.className = 'btn btn-danger btn-sm';
            status.textContent = '✅ Aktif — Notif setiap Jumat 06:00';
            status.style.color = 'var(--success)';
        } else if (!hasPermission) {
            btn.textContent = '🔔 Aktifkan Notifikasi';
            btn.className = 'btn btn-primary btn-sm';
            status.textContent = '⚠️ Izin notifikasi belum diberikan';
            status.style.color = 'var(--warning)';
        } else {
            btn.textContent = '🔔 Aktifkan Notifikasi';
            btn.className = 'btn btn-primary btn-sm';
            status.textContent = 'Nonaktif';
            status.style.color = 'var(--text-secondary)';
        }
    },

    // Toggle notification on/off
    async toggle() {
        const enabled = localStorage.getItem('notif_enabled') === 'true';
        if (enabled) {
            this.disable();
        } else {
            const granted = await this.requestPermission();
            if (!granted) {
                alert('Izin notifikasi ditolak. Silakan aktifkan di pengaturan browser.');
            }
        }
    },

    // Initialize
    async init() {
        await this.registerSW();
        this.updateUI();

        // Auto-schedule if enabled
        if (localStorage.getItem('notif_enabled') === 'true') {
            this.scheduleNext();
        }

        // Also check on page load if it's Friday 6-7 AM (catch up missed notif)
        const now = new Date();
        if (now.getDay() === 5 && now.getHours() === 6) {
            const lastSent = localStorage.getItem('notif_last_sent');
            const today = Utils.formatDate(now);
            if (!lastSent || !lastSent.startsWith(today)) {
                this.sendWeeklyReport();
            }
        }
    }
};
