/* ===== CLOUD.JS - GitHub Gist Cloud Sync ===== */

const Cloud = {
    // ========================================
    // GITHUB GIST STORAGE
    // Simpan data di GitHub Gist (private)
    // Cukup 1 token, bisa dipakai di semua device
    // ========================================

    gistId: null,
    token: null,
    user: null,
    syncing: false,

    // Load saved credentials
    loadCreds() {
        this.token = localStorage.getItem('gh_token');
        this.gistId = localStorage.getItem('gh_gist_id');
        this.user = localStorage.getItem('gh_user');
    },

    // Save credentials
    saveCreds(token, gistId, user) {
        this.token = token;
        this.gistId = gistId;
        this.user = user;
        localStorage.setItem('gh_token', token);
        localStorage.setItem('gh_gist_id', gistId || '');
        localStorage.setItem('gh_user', user || '');
    },

    // Is logged in?
    isLoggedIn() {
        return !!this.token;
    },

    // Connect with GitHub token
    async connect(token) {
        try {
            // Verify token and get user info
            const userRes = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${token}` }
            });
            if (!userRes.ok) throw new Error('Token tidak valid');
            const userData = await userRes.json();

            // Check if gist already exists
            const gistsRes = await fetch('https://api.github.com/gists?per_page=100', {
                headers: { 'Authorization': `token ${token}` }
            });
            const gists = await gistsRes.json();

            // Find existing app gist
            let gist = gists.find(g =>
                g.description === 'LemburKu-Data' && g.files && g.files['lembur-data.json']
            );

            // Create gist if not exists
            if (!gist) {
                const createRes = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        description: 'LemburKu-Data',
                        public: false,
                        files: {
                            'lembur-data.json': {
                                content: JSON.stringify(DataStore.load(), null, 2)
                            }
                        }
                    })
                });
                gist = await createRes.json();
            }

            this.saveCreds(token, gist.id, userData.login);
            this.updateUI();

            // Try to load data from cloud
            await this.loadFromCloud();

            return { success: true, user: userData.login };
        } catch (e) {
            console.error('Connect error:', e);
            return { success: false, error: e.message };
        }
    },

    // Save data to cloud
    async saveToCloud(data) {
        if (!this.token || !this.gistId || this.syncing) return false;
        this.syncing = true;
        try {
            const res = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        'lembur-data.json': {
                            content: JSON.stringify(data, null, 2)
                        }
                    }
                })
            });
            if (!res.ok) throw new Error('Gagal sync');
            localStorage.setItem('gh_last_sync', new Date().toISOString());
            this.updateUI();
            return true;
        } catch (e) {
            console.error('Save to cloud error:', e);
            return false;
        } finally {
            this.syncing = false;
        }
    },

    // Load data from cloud
    async loadFromCloud() {
        if (!this.token || !this.gistId) return null;
        try {
            const res = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                headers: { 'Authorization': `token ${this.token}` }
            });
            if (!res.ok) throw new Error('Gagal load');
            const gist = await res.json();
            const content = gist.files['lembur-data.json'].content;
            const cloudData = JSON.parse(content);

            // Merge with local
            const localData = DataStore.load();
            const merged = this.mergeData(localData, cloudData);
            DataStore.save(merged);

            localStorage.setItem('gh_last_sync', new Date().toISOString());
            this.updateUI();

            // Refresh UI
            if (typeof Dashboard !== 'undefined') Dashboard.refresh();
            if (typeof Settings !== 'undefined') Settings.loadProfile();

            return merged;
        } catch (e) {
            console.error('Load from cloud error:', e);
            return null;
        }
    },

    // Merge local and cloud data (cloud wins on conflict)
    mergeData(local, cloud) {
        const merged = { ...local };
        if (cloud.profile && cloud.profile.setupComplete) {
            merged.profile = cloud.profile;
        }
        merged.attendance = { ...local.attendance, ...cloud.attendance };

        const leaveMap = {};
        [...(local.leaves || []), ...(cloud.leaves || [])].forEach(l => {
            leaveMap[l.date + '_' + l.days] = l;
        });
        merged.leaves = Object.values(leaveMap);

        const mcMap = {};
        [...(local.mcClaims || []), ...(cloud.mcClaims || [])].forEach(c => {
            mcMap[c.id || c.date] = c;
        });
        merged.mcClaims = Object.values(mcMap);

        const hospMap = {};
        [...(local.hospitalClaims || []), ...(cloud.hospitalClaims || [])].forEach(c => {
            hospMap[c.id || c.date] = c;
        });
        merged.hospitalClaims = Object.values(hospMap);

        return merged;
    },

    // Auto sync (debounced)
    autoSync(data) {
        if (!this.token || !this.gistId) return;
        if (this._syncTimeout) clearTimeout(this._syncTimeout);
        this._syncTimeout = setTimeout(() => {
            this.saveToCloud(data);
        }, 3000);
    },

    // Disconnect
    disconnect() {
        this.saveCreds('', '', '');
        this.updateUI();
    },

    // Update UI
    updateUI() {
        const statusEl = document.getElementById('cloud-status');
        const loginSection = document.getElementById('cloud-login-section');
        const userSection = document.getElementById('cloud-user-section');
        if (!statusEl) return;

        if (this.isLoggedIn()) {
            const lastSync = localStorage.getItem('gh_last_sync');
            const lastSyncText = lastSync
                ? 'Terakhir sync: ' + new Date(lastSync).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Belum pernah sync';

            statusEl.innerHTML = `
                <div class="cloud-connected">
                    <span class="cloud-icon">☁️</span>
                    <div>
                        <div class="cloud-name">GitHub: ${this.user}</div>
                        <div class="cloud-email">${lastSyncText}</div>
                    </div>
                    <span class="cloud-badge">Tersinkron</span>
                </div>`;
            if (loginSection) loginSection.style.display = 'none';
            if (userSection) userSection.style.display = 'block';
        } else {
            statusEl.innerHTML = `
                <div class="cloud-disconnected">
                    <span class="cloud-icon">📱</span>
                    <div>
                        <div class="cloud-name">Mode Offline</div>
                        <div class="cloud-email">Data hanya tersimpan di HP ini</div>
                    </div>
                </div>`;
            if (loginSection) loginSection.style.display = 'block';
            if (userSection) userSection.style.display = 'none';
        }
    }
};
