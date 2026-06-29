/* ===== CLOUD.JS - Auto Cloud Sync (Zero Config) ===== */

const Cloud = {
    // ========================================
    // KONFIGURASI FIREBASE
    // User TIDAK perlu ganti ini
    // Cukup buka app, data langsung tersimpan
    // ========================================
    firebaseConfig: {
        apiKey: "AIzaSyAGQ9HIMQ1anidONGVtnlct6-Vy4RgKwwQ",
        authDomain: "lemburku-app-58ab9.firebaseapp.com",
        projectId: "lemburku-app-58ab9",
        storageBucket: "lemburku-app-58ab9.firebasestorage.app",
        messagingSenderId: "554408869078",
        appId: "1:554408869078:web:0a7a15f7a2411499c29d77"
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
                    this.updateAccountUI();
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
            await this.init();
            await new Promise(r => setTimeout(r, 3000));
        }
        if (!this.user) {
            try {
                await firebase.auth().signInAnonymously();
            } catch(e) {
                Utils.showResult('settings-result', '❌ Gagal koneksi ke cloud: ' + e.message, 'error');
                return;
            }
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

    // === USERNAME/PASSWORD LOGIN ===
    _emailFromUsername(username) {
        return username.toLowerCase().trim() + '@overtime-app.local';
    },

    async registerUser() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username) return Utils.showResult('account-result', '❌ Username harus diisi!', 'error');
        if (username.length < 3) return Utils.showResult('account-result', '❌ Username minimal 3 karakter!', 'error');
        if (!password || password.length < 6) return Utils.showResult('account-result', '❌ Password minimal 6 karakter!', 'error');

        if (!this.ready) await this.init();

        const email = this._emailFromUsername(username);
        try {
            // Save current anonymous data before switching
            const currentData = DataStore.load();

            // Create new account
            const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);

            // Save the username mapping
            await this.db.collection('usernames').doc(username.toLowerCase()).set({
                uid: cred.user.uid,
                created: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Migrate data from anonymous to new account
            await this._migrateData(currentData);

            Utils.showResult('account-result', '✅ Akun berhasil dibuat! Data sudah dipindahkan.', 'success');
        } catch (e) {
            if (e.code === 'auth/email-already-in-use') {
                Utils.showResult('account-result', '❌ Username sudah dipakai! Coba yang lain.', 'error');
            } else {
                Utils.showResult('account-result', '❌ Gagal daftar: ' + e.message, 'error');
            }
        }
    },

    async loginUser() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username) return Utils.showResult('account-result', '❌ Username harus diisi!', 'error');
        if (!password) return Utils.showResult('account-result', '❌ Password harus diisi!', 'error');

        if (!this.ready) await this.init();

        const email = this._emailFromUsername(username);
        try {
            // Save current anonymous data before switching
            const currentData = DataStore.load();

            await firebase.auth().signInWithEmailAndPassword(email, password);

            // Merge local data with cloud data
            await this._migrateData(currentData);

            Utils.showResult('account-result', '✅ Login berhasil! Data sudah disinkronkan.', 'success');
        } catch (e) {
            if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
                Utils.showResult('account-result', '❌ Username atau password salah!', 'error');
            } else {
                Utils.showResult('account-result', '❌ Login gagal: ' + e.message, 'error');
            }
        }
    },

    async logoutUser() {
        try {
            await firebase.auth().signOut();
            // Auto sign in as anonymous after logout
            await firebase.auth().signInAnonymously();
            this.updateAccountUI();
            Utils.showResult('account-result', '✅ Logout berhasil. Data lokal tetap tersimpan.', 'success');
        } catch (e) {
            Utils.showResult('account-result', '❌ Logout gagal: ' + e.message, 'error');
        }
    },

    async _migrateData(localData) {
        // Wait for auth to settle
        await new Promise(r => setTimeout(r, 1000));

        if (!this.user) return;

        // Try to load existing cloud data
        try {
            const doc = await this.db.collection('users').doc(this.user.uid).get();
            if (doc.exists) {
                const cloudData = doc.data();
                delete cloudData._synced;
                // Merge: cloud wins on conflict
                const merged = this.mergeData(localData, cloudData);
                DataStore.save(merged);
                await this.saveToCloud(merged);
            } else {
                // No cloud data yet, upload local
                DataStore.save(localData);
                await this.saveToCloud(localData);
            }
        } catch (e) {
            console.error('Migration error:', e);
            // Fallback: just save local data
            DataStore.save(localData);
            await this.saveToCloud(localData);
        }

        // Refresh UI
        if (typeof Dashboard !== 'undefined') Dashboard.refresh();
        if (typeof Settings !== 'undefined') Settings.loadProfile();
    },

    updateAccountUI() {
        const statusEl = document.getElementById('account-status');
        const loginForm = document.getElementById('account-login-form');
        const loggedIn = document.getElementById('account-logged-in');
        const usernameEl = document.getElementById('account-username');

        if (!statusEl) return;

        if (this.user && !this.user.isAnonymous) {
            // Logged in with username/password
            const email = this.user.email || '';
            const username = email.replace('@overtime-app.local', '');
            loginForm.style.display = 'none';
            loggedIn.style.display = 'block';
            if (usernameEl) usernameEl.textContent = username;
        } else {
            // Anonymous or not logged in
            loginForm.style.display = 'block';
            loggedIn.style.display = 'none';
        }
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
