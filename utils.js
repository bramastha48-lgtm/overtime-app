/* ===== UTILS.JS - Utility Functions ===== */

const Utils = {
    // Format number to Rupiah
    formatRupiah(num) {
        if (num === null || num === undefined || isNaN(num)) return 'Rp 0';
        return 'Rp ' + Math.round(num).toLocaleString('id-ID');
    },

    // Parse Rupiah input to number
    parseRupiah(str) {
        if (!str) return 0;
        return parseInt(String(str).replace(/[^0-9]/g, '')) || 0;
    },

    // Format number input with dots
    formatNumberInput(str) {
        const num = String(str).replace(/[^0-9]/g, '');
        if (!num) return '';
        return parseInt(num).toLocaleString('id-ID');
    },

    // Get date string YYYY-MM-DD
    formatDate(date) {
        if (typeof date === 'string') date = new Date(date);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    // Format date for display
    formatDateDisplay(dateStr) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const d = new Date(dateStr + 'T00:00:00');
        return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    },

    // Get day of week (0=Sun, 1=Mon, ..., 6=Sat)
    getDayOfWeek(dateStr) {
        return new Date(dateStr + 'T00:00:00').getDay();
    },

    // Is weekday (Mon-Fri)
    isWeekday(dateStr) {
        const day = this.getDayOfWeek(dateStr);
        return day >= 1 && day <= 5;
    },

    // Is weekend (Sat-Sun)
    isWeekend(dateStr) {
        const day = this.getDayOfWeek(dateStr);
        return day === 0 || day === 6;
    },

    // Parse time string "HH:MM" to minutes from midnight
    parseTime(str) {
        const [h, m] = str.split(':').map(Number);
        return h * 60 + m;
    },

    // Format minutes to "HH:MM"
    formatTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },

    // Calculate time difference in hours (decimal)
    timeDiffHours(start, end) {
        const startMin = this.parseTime(start);
        const endMin = this.parseTime(end);
        return (endMin - startMin) / 60;
    },

    // Get today's date string
    today() {
        return this.formatDate(new Date());
    },

    // Show result message
    showResult(elementId, message, type = 'success') {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.className = `result-box ${type}`;
        el.innerHTML = message;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 5000);
    },

    // Generate month options
    getMonthOptions() {
        const months = [];
        const now = new Date();
        for (let i = -3; i <= 3; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            months.push({ val, label });
        }
        return months;
    },

    // Get period (Thursday-Wednesday) for a given date
    getPayPeriod(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const day = d.getDay(); // 0=Sun

        // Find the Thursday of this period
        let thursday = new Date(d);
        // If Sun(0), go back 3 days; Mon(1) back 4; Tue(2) back 5; Wed(3) back 6;
        // Thu(4) same; Fri(5) back 1; Sat(6) back 2
        const daysFromThu = (day + 3) % 7; // days since last Thursday
        thursday.setDate(d.getDate() - daysFromThu);

        const wednesday = new Date(thursday);
        wednesday.setDate(thursday.getDate() + 6);

        // Payout is 2 Fridays after the Wednesday
        // Find the Friday after the Wednesday
        const daysToFri = (5 - wednesday.getDay() + 7) % 7;
        const firstFri = new Date(wednesday);
        firstFri.setDate(wednesday.getDate() + daysToFri);
        // Second Friday
        const payoutDate = new Date(firstFri);
        payoutDate.setDate(firstFri.getDate() + 7);

        return {
            start: this.formatDate(thursday),
            end: this.formatDate(wednesday),
            payout: this.formatDate(payoutDate)
        };
    },

    // Get all pay periods that cover a month
    getPayPeriodsForMonth(yearMonth) {
        const [year, month] = yearMonth.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        const periods = [];
        const seen = new Set();

        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            const dateStr = this.formatDate(d);
            const period = this.getPayPeriod(dateStr);
            const key = period.start + '_' + period.end;
            if (!seen.has(key)) {
                seen.add(key);
                periods.push(period);
            }
        }
        return periods;
    },

    // Get next payout date
    getNextPayoutDate() {
        const today = new Date();
        const period = this.getPayPeriod(this.formatDate(today));
        return period;
    },

    // Number of weekdays in a month
    countWeekdays(year, month) {
        let count = 0;
        const lastDay = new Date(year, month, 0).getDate();
        for (let d = 1; d <= lastDay; d++) {
            const day = new Date(year, month - 1, d).getDay();
            if (day >= 1 && day <= 5) count++;
        }
        return count;
    }
};
