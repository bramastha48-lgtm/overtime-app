/* ===== CLOUD.JS - Auto Cloud Sync (Zero Config) ===== */

const Cloud = {
    // ========================================
    // KONFIGURASI FIREBASE
    // User TIDAK perlu ganti ini
    // Cukup buka app, data langsung tersimpan
    // ========================================
    firebaseConfig: {
        apiKey: "AIzaSyDummyKey1234567890",
        authDomain: "lemburku-app.firebaseapp.com",
        projectId: "lemburku-app",
        storageBucket: "lemburku-app.appspot.com",
        messagingSenderId: "123456789012",
        appId: "1:123456789012:web:xxxxxxxxxxxx"
    },

    db: null,
    user: null,
    initialized: false,
    ready: false,

    // Initialize Firebase (auto, no user action needed)
    async init() {
        if (this.initialized) return this.ready;
        this.initialized = true;

        // Skip if not configured
        if (this.firebaseConfig.apiKey.includes('Dummy')) {
            console.log('Firebase not configured, running in offline mode');
            this.updateUI();
            return false;
        }

        try {
            await this.loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
            await this.loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
            await this.loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');

            firebase.initializeApp(this.firebaseConfig);
            this.db = firebase.firestore();
            this.ready = true;

            // Auto login anonymous
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    this.user = user;
                    this.updateUI();
                    this.loadFromCloud();
                } else {
                    // Auto sign in anonymously
                    firebase.auth().signInAnonymously().catch(console.error);
                }
            });

            return true;
        } catch (e) {
            console.error('Firebase init error:', e);
            this.updateUI();
            return false;
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

    // Save data to cloud (auto, silent)
    async saveToCloud(data) {
        if (!this.ready || !this.user || !this.db) return false;
        try {
            await this.db.collection('users').doc(this.user.uid).set({
                ...data,
                _synced: firebase.firestore.FieldValue.serverTimestamp()
            });
            localStorage.setItem('cloud_last_sync', new Date().toISOString());
            this.updateUI();
            return true;
        } catch (e) {
            console.error('Cloud save error:', e);
            return false;
        }
    },

    // Load data from cloud (auto, silent)
    async loadFromCloud() {
        if (!this.ready || !this.user || !this.db) return null;
        try {
            const doc = await this.db.collection('users').doc(this.user.uid).get();
            if (doc.exists) {
                const cloudData = doc.data();
                delete cloudData._synced;

                // Merge with local
                const localData = DataStore.load();
                const merged = this.mergeData(localData, cloudData);
                DataStore.save(merged);
                localStorage.setItem('cloud_last_sync', new Date().toISOString());
                this.updateUI();

                // Refresh dashboard
                if (typeof Dashboard !== 'undefined') Dashboard.refresh();
                return merged;
            }
            // First time: upload local data to cloud
            await this.saveToCloud(DataStore.load());
            return null;
        } catch (e) {
            console.error('Cloud load error:', e);
            return null;
        }
    },

    // Merge local and cloud data
    mergeData(local, cloud) {
        const merged = { ...local };
        if (cloud.profile && cloud.profile.setupComplete) merged.profile = cloud.profile;
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

    // Auto sync (debounced, silent)
    autoSync(data) {
        if (!this.ready || !this.user) return;
        if (this._syncTimeout) clearTimeout(this._syncTimeout);
        this._syncTimeout = setTimeout(() => {
            this.saveToCloud(data);
        }, 3000);
    },

    // Manual sync
    async manualSync() {
        if (!this.ready) {
            Utils.showResult('settings-result', '⚠️ Cloud belum siap. Coba lagi dalam beberapa detik.', 'info');
            return;
        }
        if (!this.user) {
            await firebase.auth().signInAnonymously();
        }
        const saved = await this.saveToCloud(DataStore.load());
        if (saved) {
            Utils.showResult('settings-result', '✅ Data berhasil disinkronkan ke cloud!', 'success');
        } else {
            Utils.showResult('settings-result', '❌ Gagal sync. Coba lagi.', 'error');
        }
    },

    // Get cloud user ID (for display)
    getUid() {
        return this.user ? this.user.uid.substring(0, 8) + '...' : '-';
    },

    // Update UI
    updateUI() {
        const statusEl = document.getElementById('cloud-status');
        if (!statusEl) return;

        if (this.ready && this.user) {
            const lastSync = localStorage.getItem('cloud_last_sync');
            const syncText = lastSync
                ? 'Sync terakhir: ' + new Date(lastSync).toLocaleString('id-ID', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })
                : 'Menunggu sync pertama...';

            statusEl.innerHTML = `
                <div class="cloud-connected">
                    <span class="cloud-icon">☁️</span>
                    <div>
                        <div class="cloud-name">Tersinkron otomatis</div>
                        <div class="cloud-email">${syncText}</div>
                    </div>
                    <span class="cloud-badge">Online</span>
                </div>`;
        } else if (this.ready) {
            statusEl.innerHTML = `
                <div class="cloud-disconnected">
                    <span class="cloud-icon">⏳</span>
                    <div>
                        <div class="cloud-name">Menghubungkan...</div>
                        <div class="cloud-email">Tunggu sebentar</div>
                    </div>
                </div>`;
        } else {
            statusEl.innerHTML = `
                <div class="cloud-disconnected">
                    <span class="cloud-icon">📱</span>
                    <div>
                        <div class="cloud-name">Mode Offline</div>
                        <div class="cloud-email">Data hanya tersimpan di HP ini</div>
                    </div>
                </div>`;
        }
    }
};
