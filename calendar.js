/* ===== CALENDAR.JS - Work Calendar Upload & Parse ===== */

const WorkCalendar = {
    uploadedImage: null,
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    markedDates: {}, // { "2026-07-07": "holiday" | "collective_leave" | "workday" }

    init() {
        this.renderCalendar();
        this.loadMarkedDates();
    },

    // Handle image upload
    handleUpload(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.uploadedImage = e.target.result;
            document.getElementById('calendar-preview').src = e.target.result;
            document.getElementById('calendar-preview-container').style.display = 'block';
            document.getElementById('calendar-upload-hint').style.display = 'none';
            document.getElementById('btn-parse-calendar').style.display = 'inline-flex';

            // Try OCR
            this.tryOCR(e.target.result);
        };
        reader.readAsDataURL(file);
    },

    // Try OCR with Tesseract.js (loaded from CDN)
    async tryOCR(imageData) {
        const statusEl = document.getElementById('calendar-ocr-status');
        statusEl.textContent = '⏳ Menganalisis gambar...';
        statusEl.style.color = 'var(--primary)';

        try {
            // Dynamically load Tesseract.js if not loaded
            if (!window.Tesseract) {
                await this.loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
            }

            const result = await Tesseract.recognize(imageData, 'ind+eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const pct = Math.round(m.progress * 100);
                        statusEl.textContent = `⏳ OCR: ${pct}%...`;
                    }
                }
            });

            const text = result.data.text;
            console.log('OCR Result:', text);

            // Parse dates from OCR text
            const detected = this.parseDatesFromText(text);

            if (detected.length > 0) {
                statusEl.textContent = `✅ Terdeteksi ${detected.length} tanggal dari gambar. Klik "Terapkan" untuk menyimpan.`;
                statusEl.style.color = 'var(--success)';

                // Mark detected dates
                detected.forEach(d => {
                    this.markedDates[d.date] = d.type;
                });
                this.renderCalendar();
            } else {
                statusEl.textContent = '⚠️ Tidak terdeteksi tanggal otomatis. Silakan pilih manual di kalender.';
                statusEl.style.color = 'var(--warning)';
            }
        } catch (e) {
            console.error('OCR Error:', e);
            statusEl.textContent = '⚠️ OCR gagal. Silakan pilih tanggal manual di kalender.';
            statusEl.style.color = 'var(--warning)';
        }
    },

    // Load external script
    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    },

    // Parse dates from OCR text
    parseDatesFromText(text) {
        const results = [];
        const lines = text.split('\n');

        // Common patterns for Indonesian calendar:
        // "1 Januari", "17 Agustus", "25-26 Desember"
        // "Cuti Bersama: 2-3 April"
        // "Libur Nasional: 17 Agustus"

        const monthMap = {
            'januari': 0, 'jan': 0, 'january': 0,
            'februari': 1, 'feb': 1, 'february': 1,
            'maret': 2, 'mar': 2, 'march': 2,
            'april': 3, 'apr': 3,
            'mei': 4, 'may': 4,
            'juni': 5, 'jun': 5, 'june': 5,
            'juli': 6, 'jul': 6, 'july': 6,
            'agustus': 7, 'agu': 7, 'aug': 7, 'august': 7,
            'september': 8, 'sep': 8,
            'oktober': 9, 'okt': 9, 'oct': 9, 'october': 9,
            'november': 10, 'nov': 10,
            'desember': 11, 'des': 11, 'dec': 11, 'december': 11
        };

        // Detect "cuti bersama" context
        let isCutiBersama = false;

        for (const line of lines) {
            const lower = line.toLowerCase();

            // Check if line indicates cuti bersama
            if (lower.includes('cuti bersama') || lower.includes('cuti bersma') || lower.includes('cb:')) {
                isCutiBersama = true;
            } else if (lower.includes('libur nasional') || lower.includes('tanggal merah') || lower.includes('hari besar')) {
                isCutiBersama = false;
            }

            // Pattern: "DD Month" or "DD-DD Month" or "DD/DD Month"
            const datePattern = /(\d{1,2})\s*[-\/]\s*(\d{1,2})\s+([a-zA-Z\u00C0-\u024F]+)/g;
            let match;
            while ((match = datePattern.exec(line)) !== null) {
                const startDay = parseInt(match[1]);
                const endDay = parseInt(match[2]);
                const monthStr = match[3].toLowerCase();
                const monthIdx = monthMap[monthStr];

                if (monthIdx !== undefined && startDay >= 1 && endDay <= 31) {
                    for (let d = startDay; d <= endDay; d++) {
                        const dateStr = `${this.currentYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        results.push({
                            date: dateStr,
                            type: isCutiBersama ? 'collective_leave' : 'holiday'
                        });
                    }
                }
            }

            // Pattern: "DD Month" (single date)
            const singlePattern = /(\d{1,2})\s+([a-zA-Z\u00C0-\u024F]+)/g;
            while ((match = singlePattern.exec(line)) !== null) {
                // Skip if already matched by range pattern
                const day = parseInt(match[1]);
                const monthStr = match[2].toLowerCase();
                const monthIdx = monthMap[monthStr];

                if (monthIdx !== undefined && day >= 1 && day <= 31) {
                    const dateStr = `${this.currentYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    // Check if already added
                    if (!results.find(r => r.date === dateStr)) {
                        results.push({
                            date: dateStr,
                            type: isCutiBersama ? 'collective_leave' : 'holiday'
                        });
                    }
                }
            }
        }

        return results;
    },

    // Render monthly calendar grid
    renderCalendar() {
        const container = document.getElementById('calendar-grid');
        if (!container) return;

        const year = this.currentYear;
        const month = this.currentMonth;
        const today = Utils.formatDate(new Date());

        // Update month label
        const monthLabel = document.getElementById('calendar-month-label');
        if (monthLabel) {
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            monthLabel.textContent = `${months[month]} ${year}`;
        }

        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let html = '<div class="cal-header">';
        ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].forEach(d => {
            html += `<div class="cal-day-name">${d}</div>`;
        });
        html += '</div><div class="cal-body">';

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="cal-cell empty"></div>';
        }

        // Day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOfWeek = new Date(year, month, d).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isToday = dateStr === today;
            const marked = this.markedDates[dateStr];

            let classes = 'cal-cell';
            if (isWeekend) classes += ' weekend';
            if (isToday) classes += ' today';
            if (marked === 'holiday') classes += ' holiday';
            if (marked === 'collective_leave') classes += ' collective-leave';

            html += `<div class="${classes}" data-date="${dateStr}" onclick="WorkCalendar.toggleDate('${dateStr}')">
                <span class="cal-day-num">${d}</span>
                ${marked === 'holiday' ? '<span class="cal-badge">🔴</span>' : ''}
                ${marked === 'collective_leave' ? '<span class="cal-badge">🟡</span>' : ''}
            </div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    // Navigate months
    prevMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.renderCalendar();
    },

    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.renderCalendar();
    },

    // Toggle date marking cycle: none → holiday → collective_leave → none
    toggleDate(dateStr) {
        const current = this.markedDates[dateStr];
        if (!current) {
            this.markedDates[dateStr] = 'holiday';
        } else if (current === 'holiday') {
            this.markedDates[dateStr] = 'collective_leave';
        } else {
            delete this.markedDates[dateStr];
        }
        this.renderCalendar();
    },

    // Set date type directly
    setDateType(dateStr, type) {
        if (type === 'none') {
            delete this.markedDates[dateStr];
        } else {
            this.markedDates[dateStr] = type;
        }
        this.renderCalendar();
    },

    // Apply marked dates to attendance data
    applyToAttendance() {
        const profile = DataStore.getProfile();
        if (!profile.setupComplete) {
            alert('Setup profil terlebih dahulu!');
            return;
        }

        let applied = 0;
        for (const [dateStr, type] of Object.entries(this.markedDates)) {
            const existing = DataStore.getAttendance(dateStr);

            if (type === 'holiday') {
                // Mark as holiday (libur nasional) - user not working
                DataStore.saveAttendance(dateStr, {
                    type: 'holiday',
                    present: false,
                    holidayStart: '08:00',
                    holidayEnd: '17:00'
                });
                applied++;
            } else if (type === 'collective_leave') {
                // Cuti bersama - also treated as holiday
                DataStore.saveAttendance(dateStr, {
                    type: 'holiday',
                    present: false,
                    holidayStart: '08:00',
                    holidayEnd: '17:00',
                    isCutiBersama: true
                });
                applied++;
            }
        }

        // Save marked dates for future reference
        localStorage.setItem('work_calendar_dates', JSON.stringify(this.markedDates));

        const resultEl = document.getElementById('calendar-apply-result');
        resultEl.className = 'result-box success';
        resultEl.innerHTML = `✅ Berhasil menerapkan ${applied} tanggal ke data absensi!<br>
            <small>Tanggal merah & cuti bersama sudah ditandai. Kamu bisa edit manual di menu Absensi.</small>`;
        resultEl.classList.remove('hidden');
        setTimeout(() => resultEl.classList.add('hidden'), 5000);
    },

    // Save marked dates to storage
    saveMarkedDates() {
        localStorage.setItem('work_calendar_dates', JSON.stringify(this.markedDates));
    },

    // Load marked dates from storage
    loadMarkedDates() {
        try {
            const saved = localStorage.getItem('work_calendar_dates');
            if (saved) {
                this.markedDates = JSON.parse(saved);
                this.renderCalendar();
            }
        } catch (e) {
            console.error('Load calendar dates error:', e);
        }
    },

    // Bulk mark: mark all dates of specific type in current month
    bulkMark(type) {
        const year = this.currentYear;
        const month = this.currentMonth;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
            const dayOfWeek = new Date(year, month, d).getDay();
            if (type === 'weekend' && (dayOfWeek === 0 || dayOfWeek === 6)) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                this.markedDates[dateStr] = 'holiday';
            }
        }
        this.renderCalendar();
    },

    // Clear all marks for current month
    clearMonth() {
        const year = this.currentYear;
        const month = this.currentMonth;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            delete this.markedDates[dateStr];
        }
        this.renderCalendar();
    },

    // Get summary of marked dates
    getSummary() {
        let holidays = 0;
        let collectiveLeave = 0;
        for (const type of Object.values(this.markedDates)) {
            if (type === 'holiday') holidays++;
            if (type === 'collective_leave') collectiveLeave++;
        }
        return { holidays, collectiveLeave, total: holidays + collectiveLeave };
    }
};
