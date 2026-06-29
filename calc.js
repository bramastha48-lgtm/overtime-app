/* ===== CALC.JS - Calculation Engine (Disnaker compliant) ===== */

const Calc = {
    // === OVERTIME RATES (PP 35/2021 / Permenaker) ===
    // Weekday overtime:
    //   First hour: 1.5x hourly rate
    //   Second hour onwards: 2x hourly rate
    // Weekend/Holiday:
    //   First 8 hours: 2x hourly rate
    //   9th hour: 3x hourly rate
    //   10th-11th hour: 4x hourly rate

    // Hourly rate = salary / 173
    getHourlyRate(salary) {
        return salary / 173;
    },

    // Daily rate = salary / working days per month (used for meal allowance base)
    // But meal allowance is fixed 30k per day

    /**
     * Calculate weekday overtime pay
     * @param {number} salary - Monthly salary
     * @param {string} overtimeEnd - End time like "18:00", "19:00", "19:30", "20:00"
     * @returns {object} { hours, pay, detail }
     */
    calcWeekdayOvertime(salary, overtimeEnd) {
        if (!overtimeEnd || overtimeEnd === 'none') {
            return { hours: 0, pay: 0, detail: 'Tidak lembur' };
        }

        const hourlyRate = this.getHourlyRate(salary);
        const otStartMinutes = 17 * 60; // 17:00
        const breakStart = 18 * 60; // 18:00
        const breakEnd = 18 * 60 + 30; // 18:30
        const otEndMinutes = Utils.parseTime(overtimeEnd);

        // Calculate effective overtime minutes (excluding break)
        let effectiveMinutes = 0;
        let current = otStartMinutes;

        while (current < otEndMinutes) {
            const nextBlock = Math.min(current + 30, otEndMinutes);
            const blockDuration = nextBlock - current;

            // Skip break period
            if (current >= breakStart && current < breakEnd) {
                // This block overlaps with break
                const overlapStart = Math.max(current, breakStart);
                const overlapEnd = Math.min(nextBlock, breakEnd);
                const overlap = overlapEnd - overlapStart;
                effectiveMinutes += blockDuration - overlap;
            } else if (current < breakEnd && nextBlock > breakStart) {
                // Partial overlap
                const overlapStart = Math.max(current, breakStart);
                const overlapEnd = Math.min(nextBlock, breakEnd);
                const overlap = overlapEnd - overlapStart;
                effectiveMinutes += blockDuration - overlap;
            } else {
                effectiveMinutes += blockDuration;
            }
            current = nextBlock;
        }

        const totalHours = effectiveMinutes / 60;

        // First hour at 1.5x, rest at 2x
        const firstHour = Math.min(totalHours, 1);
        const remainingHours = Math.max(totalHours - 1, 0);
        const pay = (firstHour * hourlyRate * 1.5) + (remainingHours * hourlyRate * 2);

        return {
            hours: totalHours,
            pay: Math.round(pay),
            detail: `${totalHours.toFixed(1)} jam (${firstHour.toFixed(1)}j × 1.5x + ${remainingHours.toFixed(1)}j × 2x)`
        };
    },

    /**
     * Calculate weekend/holiday overtime pay
     * @param {number} salary - Monthly salary
     * @param {string} startTime - Start time "HH:MM"
     * @param {string} endTime - End time "HH:MM"
     * @returns {object} { hours, pay, detail }
     */
    calcWeekendOvertime(salary, startTime, endTime) {
        const hourlyRate = this.getHourlyRate(salary);
        const startMin = Utils.parseTime(startTime);
        const endMin = Utils.parseTime(endTime);

        // Break 12:00-13:00
        const breakStart = 12 * 60;
        const breakEnd = 13 * 60;

        // Calculate effective work minutes (excluding break)
        let effectiveMinutes = 0;
        let current = startMin;

        while (current < endMin) {
            const nextMin = Math.min(current + 1, endMin);

            // Check if current minute is in break
            if (current >= breakStart && current < breakEnd) {
                // Skip break
                current = breakEnd;
                continue;
            }
            effectiveMinutes++;
            current = nextMin;
        }

        const totalHours = effectiveMinutes / 60;

        // First 8 hours at 2x, 9th hour at 3x, 10th-11th at 4x
        let pay = 0;
        let remaining = totalHours;

        const hours8 = Math.min(remaining, 8);
        pay += hours8 * hourlyRate * 2;
        remaining -= hours8;

        if (remaining > 0) {
            const hour1 = Math.min(remaining, 1);
            pay += hour1 * hourlyRate * 3;
            remaining -= hour1;
        }

        if (remaining > 0) {
            pay += remaining * hourlyRate * 4;
        }

        return {
            hours: totalHours,
            pay: Math.round(pay),
            detail: `${totalHours.toFixed(1)} jam (8j × 2x${totalHours > 8 ? ` + ${(totalHours - 8).toFixed(1)}j × 3x/4x` : ''})`
        };
    },

    /**
     * Calculate total earnings for a day
     */
    calcDayEarning(salary, attendance) {
        if (!attendance || !attendance.present) {
            return { overtime: 0, meal: 0, otHours: 0, detail: '' };
        }

        let overtime = 0;
        let otHours = 0;
        let detail = '';
        const meal = 30000; // Fixed 30k per day

        if (attendance.type === 'weekday') {
            const result = this.calcWeekdayOvertime(salary, attendance.overtimeEnd);
            overtime = result.pay;
            otHours = result.hours;
            detail = result.detail;
        } else if (attendance.type === 'weekend') {
            const result = this.calcWeekendOvertime(salary, attendance.weekendStart, attendance.weekendEnd);
            overtime = result.pay;
            otHours = result.hours;
            detail = result.detail;
        } else if (attendance.type === 'holiday') {
            // Holiday = same as weekend rate
            const result = this.calcWeekendOvertime(salary, attendance.holidayStart, attendance.holidayEnd);
            overtime = result.pay;
            otHours = result.hours;
            detail = 'Libur Nasional: ' + result.detail;
        }

        return { overtime, meal, otHours, detail };
    },

    /**
     * Calculate monthly summary
     */
    calcMonthSummary(yearMonth) {
        const profile = DataStore.getProfile();
        const salary = profile.salary;
        const records = DataStore.getAttendanceForMonth(yearMonth);

        let totalOvertime = 0;
        let totalMeal = 0;
        let totalOtHours = 0;
        const dailyDetails = [];

        for (const [dateStr, record] of Object.entries(records).sort()) {
            const earning = this.calcDayEarning(salary, record);
            totalOvertime += earning.overtime;
            totalMeal += earning.meal;
            totalOtHours += earning.otHours;

            dailyDetails.push({
                date: dateStr,
                type: record.type,
                present: record.present,
                overtime: earning.overtime,
                meal: earning.meal,
                otHours: earning.otHours,
                detail: earning.detail
            });
        }

        return {
            totalOvertime,
            totalMeal,
            totalOtHours,
            total: totalOvertime + totalMeal,
            dailyDetails
        };
    },

    /**
     * Calculate MC balance based on family status
     */
    getMcBalance(salary, familyStatus) {
        const multipliers = {
            'single': 1.0,
            'married_no_child': 1.2,
            'child_1': 1.3,
            'child_2': 1.4,
            'child_3': 1.5
        };
        return salary * (multipliers[familyStatus] || 1.0);
    },

    /**
     * Calculate Hospitalization balance based on family status
     */
    getHospitalBalance(salary, familyStatus) {
        const multipliers = {
            'single': 4.0,
            'married_no_child': 6.0,
            'child_1': 8.0,
            'child_2': 8.0,
            'child_3': 8.0
        };
        return salary * (multipliers[familyStatus] || 4.0);
    },

    /**
     * Get remaining MC balance after claims
     */
    getMcRemaining() {
        const profile = DataStore.getProfile();
        const totalBalance = this.getMcBalance(profile.salary, profile.familyStatus);
        const claims = DataStore.getMcClaims();
        const totalClaimed = claims.reduce((sum, c) => sum + c.amount, 0);
        return totalBalance - totalClaimed;
    },

    /**
     * Get remaining Hospitalization balance after claims
     */
    getHospitalRemaining() {
        const profile = DataStore.getProfile();
        const totalBalance = this.getHospitalBalance(profile.salary, profile.familyStatus);
        const claims = DataStore.getHospitalClaims();
        const totalClaimed = claims.reduce((sum, c) => sum + c.amount, 0);
        return totalBalance - totalClaimed;
    },

    /**
     * Get pending (uncashed) MC claims for a month
     */
    getPendingMcClaims(yearMonth) {
        const claims = DataStore.getMcClaims();
        return claims.filter(c => {
            // Claims that haven't been "cashed" yet in this month's payout
            const claimMonth = c.date.substring(0, 7);
            return claimMonth === yearMonth;
        });
    }
};
