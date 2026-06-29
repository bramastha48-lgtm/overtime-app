/* ===== DATA.JS - Data Storage Layer ===== */

const STORAGE_KEY = 'overtime_app_data';

const DataStore = {
    // Default data structure
    getDefault() {
        return {
            profile: {
                name: '',
                salary: 0,
                familyStatus: 'single',
                leaveQuota: 12,
                mealAllowance: 30000,
                setupComplete: false
            },
            // Daily attendance: { "2026-06-25": { type, present, overtimeEnd, weekendStart, weekendEnd, ... } }
            attendance: {},
            // Leave records: [{ date, days, reason }]
            leaves: [],
            // MC claims: [{ id, date, amount, desc, periodStart, periodEnd, payoutDate }]
            mcClaims: [],
            // Hospital claims: [{ id, date, amount, desc, periodStart, periodEnd, payoutDate }]
            hospitalClaims: [],
            // MC balance override (if manually adjusted)
            mcBalanceOverride: null,
            hospitalBalanceOverride: null
        };
    },

    // Load all data
    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                // Merge with defaults to handle new fields
                return { ...this.getDefault(), ...data };
            }
        } catch (e) {
            console.error('Data load error:', e);
        }
        return this.getDefault();
    },

    // Save all data
    save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            // Auto sync to cloud if available
            if (typeof Cloud !== 'undefined' && Cloud.user) {
                Cloud.autoSync(data);
            }
        } catch (e) {
            console.error('Data save error:', e);
        }
    },

    // Get profile
    getProfile() {
        return this.load().profile;
    },

    // Save profile
    saveProfile(profile) {
        const data = this.load();
        data.profile = { ...data.profile, ...profile };
        this.save(data);
        return data;
    },

    // Get attendance for a date
    getAttendance(dateStr) {
        const data = this.load();
        return data.attendance[dateStr] || null;
    },

    // Save attendance for a date
    saveAttendance(dateStr, record) {
        const data = this.load();
        data.attendance[dateStr] = record;
        this.save(data);
        return data;
    },

    // Get all attendance for a month (YYYY-MM)
    getAttendanceForMonth(yearMonth) {
        const data = this.load();
        const result = {};
        for (const [dateStr, record] of Object.entries(data.attendance)) {
            if (dateStr.startsWith(yearMonth)) {
                result[dateStr] = record;
            }
        }
        return result;
    },

    // Get leaves
    getLeaves() {
        return this.load().leaves;
    },

    // Add leave
    addLeave(leave) {
        const data = this.load();
        data.leaves.push(leave);
        this.save(data);
        return data;
    },

    // Get total leave days used
    getTotalLeaveUsed() {
        const data = this.load();
        return data.leaves.reduce((sum, l) => sum + (l.days || 1), 0);
    },

    // Delete leave by index
    deleteLeave(index) {
        const data = this.load();
        data.leaves.splice(index, 1);
        this.save(data);
        return data;
    },

    // Update leave quota
    updateLeaveQuota(quota) {
        const data = this.load();
        data.profile.leaveQuota = quota;
        this.save(data);
    },

    // Get MC claims
    getMcClaims() {
        return this.load().mcClaims;
    },

    // Add MC claim
    addMcClaim(claim) {
        const data = this.load();
        data.mcClaims.push(claim);
        this.save(data);
        return data;
    },

    // Get MC claims for a period
    getMcClaimsForPeriod(startDate, endDate) {
        const data = this.load();
        return data.mcClaims.filter(c => c.date >= startDate && c.date <= endDate);
    },

    // Delete MC claim by id
    deleteMcClaim(id) {
        const data = this.load();
        data.mcClaims = data.mcClaims.filter(c => c.id !== id);
        this.save(data);
        return data;
    },

    // Get hospital claims
    getHospitalClaims() {
        return this.load().hospitalClaims;
    },

    // Add hospital claim
    addHospitalClaim(claim) {
        const data = this.load();
        data.hospitalClaims.push(claim);
        this.save(data);
        return data;
    },

    // Get hospital claims for a period
    getHospitalClaimsForPeriod(startDate, endDate) {
        const data = this.load();
        return data.hospitalClaims.filter(c => c.date >= startDate && c.date <= endDate);
    },

    // Delete hospital claim by id
    deleteHospitalClaim(id) {
        const data = this.load();
        data.hospitalClaims = data.hospitalClaims.filter(c => c.id !== id);
        this.save(data);
        return data;
    },

    // Reset all data
    resetAll() {
        localStorage.removeItem(STORAGE_KEY);
    }
};
