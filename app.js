/* ===== APP.JS - Main Application Logic ===== */

// === APP CONTROLLER ===
const App = {
    currentSection: 'dashboard',

    init() {
        const profile = DataStore.getProfile();
        if (profile.setupComplete) {
            this.showMainApp();
        } else {
            this.showPage('setup');
        }
    },

    showPage(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
    },

    saveSetup() {
        const name = document.getElementById('input-name').value.trim();
        const salary = Utils.parseRupiah(document.getElementById('input-salary').value);
        const family = document.getElementById('input-family').value;
        const leaveQuota = parseInt(document.getElementById('input-leave-quota').value) || 0;

        if (!name) return alert('Nama harus diisi!');
        if (!salary || salary < 1) return alert('Gaji harus diisi!');

        DataStore.saveProfile({
            name, salary, familyStatus: family, leaveQuota, setupComplete: true
        });

        this.showMainApp();
    },

    showMainApp() {
        this.showPage('main');
        this.navigate('dashboard');
        this.initMonthSelectors();
        Settings.loadProfile();
        Settings.checkBackupReminder();
        Leave.refresh();
        Medical.refresh();
        Hospital.refresh();
        // Initialize cloud sync
        if (typeof Cloud !== 'undefined' && Cloud.isConfigured()) {
            Cloud.init();
        }
    },

    navigate(section) {
        this.currentSection = section;

        // Update header
        const titles = {
            dashboard: 'Dashboard',
            attendance: 'Absensi Harian',
            overtime: 'Detail Lemburan',
            medical: 'Klaim & Benefit',
            leave: 'Cuti Tahunan',
            settings: 'Pengaturan'
        };
        document.getElementById('header-title').textContent = titles[section] || 'Dashboard';

        // Update sections
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${section}`).classList.add('active');

        // Update nav
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.nav-btn[data-section="${section}"]`).classList.add('active');

        // Refresh data
        if (section === 'dashboard') Dashboard.refresh();
        if (section === 'attendance') Attendance.init();
        if (section === 'overtime') Overtime.refresh();
        if (section === 'medical') { Medical.refresh(); Hospital.refresh(); }
        if (section === 'leave') Leave.refresh();
        if (section === 'settings') Settings.loadProfile();
    },

    initMonthSelectors() {
        const options = Utils.getMonthOptions();
        const dashMonth = document.getElementById('dashboard-month');
        const otMonth = document.getElementById('ot-month');
        const currentMonth = Utils.today().substring(0, 7);

        [dashMonth, otMonth].forEach(sel => {
            sel.innerHTML = '';
            options.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.val;
                opt.textContent = o.label;
                if (o.val === currentMonth) opt.selected = true;
                sel.appendChild(opt);
            });
        });
    }
};

// === DASHBOARD ===
const Dashboard = {
    refresh() {
        const yearMonth = document.getElementById('dashboard-month').value;
        const profile = DataStore.getProfile();
        const summary = Calc.calcMonthSummary(yearMonth);

        // Update summary
        document.getElementById('sum-overtime').textContent = Utils.formatRupiah(summary.totalOvertime);
        document.getElementById('sum-meal').textContent = Utils.formatRupiah(summary.totalMeal);
        document.getElementById('sum-total').textContent = Utils.formatRupiah(summary.total);

        // Pending MC claims
        const mcClaims = DataStore.getMcClaims().filter(c => c.date.startsWith(yearMonth));
        const mcPending = mcClaims.reduce((s, c) => s + c.amount, 0);
        document.getElementById('sum-mc-claim').textContent = Utils.formatRupiah(mcPending);

        // Balance - Leave
        const leaveUsed = DataStore.getTotalLeaveUsed();
        const leaveRemaining = profile.leaveQuota - leaveUsed;
        document.getElementById('leave-detail').textContent = `${leaveUsed} / ${profile.leaveQuota} hari`;
        document.getElementById('leave-remaining').textContent = `${leaveRemaining} hari`;

        // Balance - MC
        const mcTotal = Calc.getMcBalance(profile.salary, profile.familyStatus);
        const mcRemain = Calc.getMcRemaining();
        document.getElementById('mc-detail').textContent = `Total: ${Utils.formatRupiah(mcTotal)}`;
        document.getElementById('mc-balance').textContent = Utils.formatRupiah(mcRemain);

        // Balance - Hospital
        const hospTotal = Calc.getHospitalBalance(profile.salary, profile.familyStatus);
        const hospRemain = Calc.getHospitalRemaining();
        document.getElementById('hospital-detail').textContent = `Total: ${Utils.formatRupiah(hospTotal)}`;
        document.getElementById('hospital-balance').textContent = Utils.formatRupiah(hospRemain);

        // Next payout
        const nextPayout = Utils.getNextPayoutDate();
        document.querySelector('.payout-date').textContent = Utils.formatDateDisplay(nextPayout.payout);
        document.querySelector('.payout-period').textContent =
            `Periode: ${Utils.formatDateDisplay(nextPayout.start)} - ${Utils.formatDateDisplay(nextPayout.end)}`;

        // Calculate payout amounts for this period
        const allAttendance = DataStore.load().attendance;
        let periodOvertime = 0;
        let periodMeal = 0;
        for (const [dateStr, record] of Object.entries(allAttendance)) {
            if (dateStr >= nextPayout.start && dateStr <= nextPayout.end && record.present) {
                const earning = Calc.calcDayEarning(profile.salary, record);
                periodOvertime += earning.overtime;
                periodMeal += earning.meal;
            }
        }
        const periodMcClaims = DataStore.getMcClaims().filter(c =>
            c.date >= nextPayout.start && c.date <= nextPayout.end);
        const periodMc = periodMcClaims.reduce((s, c) => s + c.amount, 0);
        const periodHospitalClaims = DataStore.getHospitalClaims().filter(c =>
            c.date >= nextPayout.start && c.date <= nextPayout.end);
        const periodHospital = periodHospitalClaims.reduce((s, c) => s + c.amount, 0);
        const periodTotal = periodOvertime + periodMeal + periodMc + periodHospital;

        document.getElementById('payout-overtime').textContent = Utils.formatRupiah(periodOvertime);
        document.getElementById('payout-meal').textContent = Utils.formatRupiah(periodMeal);
        document.getElementById('payout-mc').textContent = Utils.formatRupiah(periodMc + periodHospital);
        document.getElementById('payout-total').textContent = Utils.formatRupiah(periodTotal);
    }
};

// === ATTENDANCE ===
const Attendance = {
    currentType: 'weekday',

    init() {
        const dateInput = document.getElementById('att-date');
        if (!dateInput.value) {
            dateInput.value = Utils.today();
        }
        this.loadDate();
        this.loadRecap();
    },

    loadDate() {
        const dateStr = document.getElementById('att-date').value;
        if (!dateStr) return;

        const record = DataStore.getAttendance(dateStr);
        if (record) {
            this.setType(record.type);
            if (record.type === 'weekday') {
                document.getElementById('att-present').value = record.present ? 'yes' : 'no';
                document.getElementById('att-ot-end').value = record.overtimeEnd || 'none';
                this.togglePresent();
            } else if (record.type === 'weekend') {
                document.getElementById('att-wk-start').value = record.weekendStart || '08:00';
                document.getElementById('att-wk-end').value = record.weekendEnd || '17:00';
            } else if (record.type === 'holiday') {
                document.getElementById('att-hol-present').value = record.present ? 'yes' : 'no';
                document.getElementById('att-hol-start').value = record.holidayStart || '08:00';
                document.getElementById('att-hol-end').value = record.holidayEnd || '17:00';
                this.toggleHolidayPresent();
            }
        } else {
            // Auto-detect type
            if (Utils.isWeekend(dateStr)) {
                this.setType('weekend');
                document.getElementById('att-wk-start').value = '08:00';
                document.getElementById('att-wk-end').value = '17:00';
            } else {
                this.setType('weekday');
                document.getElementById('att-present').value = 'yes';
                document.getElementById('att-ot-end').value = 'none';
                this.togglePresent();
            }
        }
    },

    setType(type) {
        this.currentType = type;
        document.querySelectorAll('.att-type-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.type === type);
        });
        document.getElementById('att-weekday-panel').classList.toggle('hidden', type !== 'weekday');
        document.getElementById('att-weekend-panel').classList.toggle('hidden', type !== 'weekend');
        document.getElementById('att-holiday-panel').classList.toggle('hidden', type !== 'holiday');
    },

    togglePresent() {
        const isPresent = document.getElementById('att-present').value === 'yes';
        document.getElementById('weekday-overtime-section').style.display = isPresent ? 'block' : 'none';
    },

    toggleHolidayPresent() {
        const isPresent = document.getElementById('att-hol-present').value === 'yes';
        document.getElementById('holiday-detail-section').style.display = isPresent ? 'block' : 'none';
    },

    save() {
        const dateStr = document.getElementById('att-date').value;
        if (!dateStr) return alert('Pilih tanggal terlebih dahulu!');

        let record = { type: this.currentType };

        if (this.currentType === 'weekday') {
            record.present = document.getElementById('att-present').value === 'yes';
            record.overtimeEnd = document.getElementById('att-ot-end').value;
        } else if (this.currentType === 'weekend') {
            record.present = true; // Weekend always "present" if recorded
            record.weekendStart = document.getElementById('att-wk-start').value;
            record.weekendEnd = document.getElementById('att-wk-end').value;

            // Validate
            if (Utils.parseTime(record.weekendEnd) <= Utils.parseTime(record.weekendStart)) {
                return Utils.showResult('att-result', '❌ Jam pulang harus setelah jam masuk!', 'error');
            }
        } else if (this.currentType === 'holiday') {
            record.present = document.getElementById('att-hol-present').value === 'yes';
            record.holidayStart = document.getElementById('att-hol-start').value;
            record.holidayEnd = document.getElementById('att-hol-end').value;
        }

        DataStore.saveAttendance(dateStr, record);

        // Calculate result
        const earning = Calc.calcDayEarning(DataStore.getProfile().salary, record);
        const profile = DataStore.getProfile();

        let msg = `✅ <strong>${Utils.formatDateDisplay(dateStr)}</strong> tersimpan!<br>`;
        if (record.present) {
            msg += `💰 Lembur: ${Utils.formatRupiah(earning.overtime)}`;
            if (earning.detail) msg += ` (${earning.detail})`;
            msg += `<br>🍽️ Uang Makan: ${Utils.formatRupiah(earning.meal)}`;
            msg += `<br><strong>Total: ${Utils.formatRupiah(earning.overtime + earning.meal)}</strong>`;
        } else {
            msg += `Tidak masuk - tidak ada pendapatan`;
        }

        Utils.showResult('att-result', msg, 'success');
        this.loadRecap();
    },

    loadRecap() {
        const yearMonth = document.getElementById('att-date').value.substring(0, 7);
        const records = DataStore.getAttendanceForMonth(yearMonth);
        const profile = DataStore.getProfile();
        const container = document.getElementById('att-recap');

        const sorted = Object.entries(records).sort(([a], [b]) => a.localeCompare(b));

        if (sorted.length === 0) {
            container.innerHTML = '<div class="claim-empty">Belum ada data absensi bulan ini</div>';
            return;
        }

        let html = '';
        for (const [dateStr, record] of sorted) {
            const earning = Calc.calcDayEarning(profile.salary, record);
            const statusClass = record.present ? 'present' : 'absent';
            const statusText = record.present ? 'Masuk' : 'Tidak Masuk';
            const typeLabel = record.type === 'holiday' ? ' 🔴' : record.type === 'weekend' ? ' 📅' : '';

            html += `
                <div class="att-recap-item">
                    <span class="att-recap-date">${Utils.formatDateDisplay(dateStr)}${typeLabel}</span>
                    <span class="att-recap-status ${statusClass}">${statusText}</span>
                    <span class="att-recap-amount">${record.present ? Utils.formatRupiah(earning.overtime + earning.meal) : '-'}</span>
                </div>`;
        }
        container.innerHTML = html;
    }
};

// === OVERTIME DETAIL ===
const Overtime = {
    refresh() {
        const yearMonth = document.getElementById('ot-month').value;
        const profile = DataStore.getProfile();
        const summary = Calc.calcMonthSummary(yearMonth);

        document.getElementById('ot-total-hours').textContent = `${summary.totalOtHours.toFixed(1)} jam`;
        document.getElementById('ot-total-money').textContent = Utils.formatRupiah(summary.totalOvertime);
        document.getElementById('ot-total-meal').textContent = Utils.formatRupiah(summary.totalMeal);

        const container = document.getElementById('ot-detail-list');
        const details = summary.dailyDetails.filter(d => d.present);

        if (details.length === 0) {
            container.innerHTML = '<div class="claim-empty">Belum ada data lembur bulan ini</div>';
            return;
        }

        let html = '';
        for (const d of details) {
            const typeLabel = d.type === 'holiday' ? '🔴 Libur Nasional' :
                d.type === 'weekend' ? '📅 Weekend' : '';
            html += `
                <div class="ot-detail-item">
                    <div class="ot-detail-header">
                        <span class="ot-detail-date">${Utils.formatDateDisplay(d.date)} ${typeLabel}</span>
                        <span class="ot-detail-money">${Utils.formatRupiah(d.overtime + d.meal)}</span>
                    </div>
                    <div class="ot-detail-sub">
                        <span>⏱️ ${d.otHours.toFixed(1)}j lembur = ${Utils.formatRupiah(d.overtime)}</span>
                        <span>🍽️ Makan = ${Utils.formatRupiah(d.meal)}</span>
                    </div>
                    ${d.detail ? `<div style="font-size:11px;color:#5f6368;margin-top:2px">${d.detail}</div>` : ''}
                </div>`;
        }
        container.innerHTML = html;
    }
};

// === MEDICAL CLAIMS ===
const Medical = {
    refresh() {
        const profile = DataStore.getProfile();
        const remaining = Calc.getMcRemaining();
        const total = Calc.getMcBalance(profile.salary, profile.familyStatus);

        document.getElementById('mc-current-balance').textContent = Utils.formatRupiah(remaining);

        // History
        const claims = DataStore.getMcClaims();
        const container = document.getElementById('mc-claim-history');

        if (claims.length === 0) {
            container.innerHTML = '<div class="claim-empty">Belum ada klaim MC</div>';
            return;
        }

        let html = '';
        for (const c of claims.slice().reverse()) {
            const period = Utils.getPayPeriod(c.date);
            html += `
                <div class="claim-item">
                    <div class="claim-info">
                        <div class="claim-date">${Utils.formatDateDisplay(c.date)}</div>
                        <div class="claim-desc">${c.desc || 'Klaim MC'}</div>
                        <div class="claim-payout">Cair: ${Utils.formatDateDisplay(period.payout)}</div>
                    </div>
                    <div class="claim-amount">- ${Utils.formatRupiah(c.amount)}</div>
                </div>`;
        }
        container.innerHTML = html;
    },

    claim() {
        const dateStr = document.getElementById('mc-claim-date').value;
        const amount = Utils.parseRupiah(document.getElementById('mc-claim-amount').value);
        const desc = document.getElementById('mc-claim-desc').value.trim();

        if (!dateStr) return Utils.showResult('mc-claim-result', '❌ Pilih tanggal klaim!', 'error');
        if (!amount || amount < 1) return Utils.showResult('mc-claim-result', '❌ Masukkan jumlah klaim!', 'error');

        const remaining = Calc.getMcRemaining();
        if (amount > remaining) {
            return Utils.showResult('mc-claim-result',
                `❌ Saldo MC tidak cukup! Sisa: ${Utils.formatRupiah(remaining)}`, 'error');
        }

        const period = Utils.getPayPeriod(dateStr);
        const claim = {
            id: Date.now(),
            date: dateStr,
            amount,
            desc: desc || 'Klaim MC',
            periodStart: period.start,
            periodEnd: period.end,
            payoutDate: period.payout
        };

        DataStore.addMcClaim(claim);

        const newRemaining = remaining - amount;
        Utils.showResult('mc-claim-result',
            `✅ Klaim MC ${Utils.formatRupiah(amount)} berhasil!<br>
            📅 Periode: ${Utils.formatDateDisplay(period.start)} - ${Utils.formatDateDisplay(period.end)}<br>
            💰 Cair: ${Utils.formatDateDisplay(period.payout)}<br>
            🏥 Sisa Saldo MC: ${Utils.formatRupiah(newRemaining)}`, 'success');

        // Clear inputs
        document.getElementById('mc-claim-amount').value = '';
        document.getElementById('mc-claim-desc').value = '';

        this.refresh();
    }
};

// === HOSPITAL CLAIMS ===
const Hospital = {
    refresh() {
        const profile = DataStore.getProfile();
        const remaining = Calc.getHospitalRemaining();

        document.getElementById('hospital-current-balance').textContent = Utils.formatRupiah(remaining);

        const claims = DataStore.getHospitalClaims();
        const container = document.getElementById('hospital-claim-history');

        if (claims.length === 0) {
            container.innerHTML = '<div class="claim-empty">Belum ada klaim rawat inap</div>';
            return;
        }

        let html = '';
        for (const c of claims.slice().reverse()) {
            const period = Utils.getPayPeriod(c.date);
            html += `
                <div class="claim-item">
                    <div class="claim-info">
                        <div class="claim-date">${Utils.formatDateDisplay(c.date)}</div>
                        <div class="claim-desc">${c.desc || 'Klaim Rawat Inap'}</div>
                        <div class="claim-payout">Cair: ${Utils.formatDateDisplay(period.payout)}</div>
                    </div>
                    <div class="claim-amount">- ${Utils.formatRupiah(c.amount)}</div>
                </div>`;
        }
        container.innerHTML = html;
    },

    claim() {
        const dateStr = document.getElementById('hospital-claim-date').value;
        const amount = Utils.parseRupiah(document.getElementById('hospital-claim-amount').value);
        const desc = document.getElementById('hospital-claim-desc').value.trim();

        if (!dateStr) return Utils.showResult('hospital-claim-result', '❌ Pilih tanggal klaim!', 'error');
        if (!amount || amount < 1) return Utils.showResult('hospital-claim-result', '❌ Masukkan jumlah klaim!', 'error');

        const remaining = Calc.getHospitalRemaining();
        if (amount > remaining) {
            return Utils.showResult('hospital-claim-result',
                `❌ Saldo rawat inap tidak cukup! Sisa: ${Utils.formatRupiah(remaining)}`, 'error');
        }

        const period = Utils.getPayPeriod(dateStr);
        const claim = {
            id: Date.now(),
            date: dateStr,
            amount,
            desc: desc || 'Klaim Rawat Inap',
            periodStart: period.start,
            periodEnd: period.end,
            payoutDate: period.payout
        };

        DataStore.addHospitalClaim(claim);

        const newRemaining = remaining - amount;
        Utils.showResult('hospital-claim-result',
            `✅ Klaim rawat inap ${Utils.formatRupiah(amount)} berhasil!<br>
            📅 Periode: ${Utils.formatDateDisplay(period.start)} - ${Utils.formatDateDisplay(period.end)}<br>
            💰 Cair: ${Utils.formatDateDisplay(period.payout)}<br>
            🛏️ Sisa Saldo: ${Utils.formatRupiah(newRemaining)}`, 'success');

        document.getElementById('hospital-claim-amount').value = '';
        document.getElementById('hospital-claim-desc').value = '';

        this.refresh();
    }
};

// === LEAVE ===
const Leave = {
    refresh() {
        const profile = DataStore.getProfile();
        const used = DataStore.getTotalLeaveUsed();
        const remaining = profile.leaveQuota - used;

        document.getElementById('leave-quota-display').textContent = profile.leaveQuota;
        document.getElementById('leave-used-display').textContent = used;
        document.getElementById('leave-left-display').textContent = remaining;
        document.getElementById('leave-remaining-big').textContent = remaining;
        document.getElementById('leave-set-quota').value = profile.leaveQuota;

        // Update circle
        const circumference = 2 * Math.PI * 45; // r=45
        const percent = profile.leaveQuota > 0 ? (remaining / profile.leaveQuota) : 0;
        const offset = circumference * (1 - Math.max(0, Math.min(1, percent)));
        document.getElementById('leave-circle-fill').setAttribute('stroke-dashoffset', offset);

        // Update dashboard
        document.getElementById('leave-detail').textContent = `${used} / ${profile.leaveQuota} hari`;
        document.getElementById('leave-remaining').textContent = `${remaining} hari`;

        // History
        const leaves = DataStore.getLeaves();
        const container = document.getElementById('leave-history');

        if (leaves.length === 0) {
            container.innerHTML = '<div class="claim-empty">Belum ada catatan cuti</div>';
            return;
        }

        let html = '';
        for (const l of leaves.slice().reverse()) {
            html += `
                <div class="leave-item">
                    <div>
                        <div class="leave-item-date">${Utils.formatDateDisplay(l.date)}</div>
                        <div class="leave-item-reason">${l.reason || 'Cuti'}</div>
                    </div>
                    <div class="leave-item-days">${l.days} hari</div>
                </div>`;
        }
        container.innerHTML = html;
    },

    updateQuota() {
        const quota = parseInt(document.getElementById('leave-set-quota').value) || 0;
        DataStore.updateLeaveQuota(quota);
        this.refresh();
    },

    add() {
        const dateStr = document.getElementById('leave-date').value;
        const days = parseInt(document.getElementById('leave-days').value) || 1;
        const reason = document.getElementById('leave-reason').value.trim();

        if (!dateStr) return Utils.showResult('leave-result', '❌ Pilih tanggal cuti!', 'error');

        const profile = DataStore.getProfile();
        const used = DataStore.getTotalLeaveUsed();
        const remaining = profile.leaveQuota - used;

        if (days > remaining) {
            return Utils.showResult('leave-result',
                `❌ Sisa cuti tidak cukup! Sisa: ${remaining} hari`, 'error');
        }

        DataStore.addLeave({
            date: dateStr,
            days,
            reason: reason || 'Cuti'
        });

        const newRemaining = remaining - days;
        Utils.showResult('leave-result',
            `✅ Cuti ${days} hari berhasil dicatat!<br>
            📅 ${Utils.formatDateDisplay(dateStr)}<br>
            🏖️ Sisa cuti: ${newRemaining} hari`, 'success');

        document.getElementById('leave-reason').value = '';
        this.refresh();
    }
};

// === SETTINGS ===
const Settings = {
    loadProfile() {
        const profile = DataStore.getProfile();
        document.getElementById('set-name').value = profile.name;
        document.getElementById('set-salary').value = Utils.formatNumberInput(profile.salary);
        document.getElementById('set-family').value = profile.familyStatus;
        this.updateInfo();
        this.updateBackupStatus();
    },

    save() {
        const name = document.getElementById('set-name').value.trim();
        const salary = Utils.parseRupiah(document.getElementById('set-salary').value);
        const family = document.getElementById('set-family').value;

        if (!name) return Utils.showResult('settings-result', '❌ Nama harus diisi!', 'error');
        if (!salary) return Utils.showResult('settings-result', '❌ Gaji harus diisi!', 'error');

        DataStore.saveProfile({ name, salary, familyStatus: family });
        this.updateInfo();
        Dashboard.refresh();
        Utils.showResult('settings-result', `✅ Profil berhasil disimpan!<br>👤 ${name}<br>💰 Gaji: ${Utils.formatRupiah(salary)}`, 'success');
    },

    updateInfo() {
        const profile = DataStore.getProfile();
        const hourlyRate = Calc.getHourlyRate(profile.salary);
        const mcBalance = Calc.getMcBalance(profile.salary, profile.familyStatus);
        const hospBalance = Calc.getHospitalBalance(profile.salary, profile.familyStatus);

        const familyLabels = {
            'single': 'Belum Berkeluarga',
            'married_no_child': 'Berkeluarga (Belum Punya Anak)',
            'child_1': 'Berkeluarga (Anak 1)',
            'child_2': 'Berkeluarga (Anak 2)',
            'child_3': 'Berkeluarga (Anak 3)'
        };

        document.getElementById('settings-info').innerHTML = `
            <p><strong>Nama:</strong> ${profile.name}</p>
            <p><strong>Gaji Pokok:</strong> ${Utils.formatRupiah(profile.salary)}</p>
            <p><strong>Status:</strong> ${familyLabels[profile.familyStatus]}</p>
            <p><strong>Tarif Per Jam (173 jam/bulan):</strong> ${Utils.formatRupiah(hourlyRate)}</p>
            <br>
            <p><strong>📊 Rumus Lembur (Disnaker):</strong></p>
            <p>• Weekday: Jam ke-1 = 1.5x, jam ke-2 dst = 2x</p>
            <p>• Weekend/Libur: 8j pertama = 2x, jam ke-9 = 3x, jam ke-10-11 = 4x</p>
            <p>• Istirahat weekday lembur: 18:00-18:30 (30 menit)</p>
            <p>• Istirahat weekend/libur: 12:00-13:00 (1 jam)</p>
            <br>
            <p><strong>🍽️ Uang Makan:</strong> Rp 30.000 / hari masuk</p>
            <br>
            <p><strong>🏥 Saldo MC:</strong> ${Utils.formatRupiah(mcBalance)}</p>
            <p><strong>🛏️ Saldo Rawat Inap:</strong> ${Utils.formatRupiah(hospBalance)}</p>
            <br>
            <p><strong>📅 Siklus Pencairan:</strong></p>
            <p>Periode Kamis → Rabu, cair Jumat minggu ke-2</p>
        `;
    },

    exportData() {
        const data = DataStore.load();
        data._lastBackup = new Date().toISOString();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_lembur_${Utils.today()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        localStorage.setItem('lastBackup', new Date().toISOString());
        this.updateBackupStatus();
        Utils.showResult('settings-result', '✅ Backup berhasil didownload! Simpan file ini di tempat aman.', 'success');
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.profile || !data.profile.name) {
                    return Utils.showResult('settings-result', '❌ File backup tidak valid!', 'error');
                }
                if (confirm(`Restore data milik "${data.profile.name}"?

Data saat ini akan ditimpa. Lanjutkan?`)) {
                    DataStore.save(data);
                    localStorage.setItem('lastBackup', new Date().toISOString());
                    location.reload();
                }
            } catch (err) {
                Utils.showResult('settings-result', '❌ Gagal membaca file backup!', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    updateBackupStatus() {
        const last = localStorage.getItem('lastBackup');
        const el = document.getElementById('last-backup');
        if (el) {
            if (last) {
                const d = new Date(last);
                const days = Math.floor((new Date() - d) / 86400000);
                const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                el.textContent = dateStr;
                if (days > 7) {
                    el.style.color = '#d93025';
                    el.textContent += ' ⚠️ Sudah ' + days + ' hari!';
                }
            } else {
                el.textContent = 'Belum pernah';
                el.style.color = '#d93025';
            }
        }
    },

    checkBackupReminder() {
        const last = localStorage.getItem('lastBackup');
        if (!last) return;
        const days = Math.floor((new Date() - new Date(last)) / 86400000);
        if (days >= 7) {
            setTimeout(() => {
                if (confirm(`⚠️ Backup terakhir ${days} hari yang lalu!

Disarankan backup sekarang untuk mencegah data hilang.

Klik OK untuk backup sekarang.`)) {
                    this.exportData();
                }
            }, 2000);
        }
    },

    resetAll() {
        if (confirm('⚠️ SEMUA DATA AKAN DIHAPUS!\n\nApakah Anda yakin?')) {
            if (confirm('Konfirmasi sekali lagi: Hapus semua data?')) {
                DataStore.resetAll();
                location.reload();
            }
        }
    }
};

// === Rupiah Input Formatting ===
document.addEventListener('DOMContentLoaded', () => {
    // Format rupiah inputs
    const rupiahInputs = ['input-salary', 'set-salary', 'mc-claim-amount', 'hospital-claim-amount'];
    rupiahInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function () {
                const cursorPos = this.selectionStart;
                const oldLen = this.value.length;
                this.value = Utils.formatNumberInput(this.value);
                const newLen = this.value.length;
                this.setSelectionRange(cursorPos + (newLen - oldLen), cursorPos + (newLen - oldLen));
            });
        }
    });

    // Initialize app
    App.init();
});
