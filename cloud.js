/* ===== CLOUD.JS - Firebase Cloud Sync ===== */

const Cloud = {
    // ========================================
    // KONFIGURASI FIREBASE
    // Ganti dengan konfigurasi Firebase kamu
    // Cara dapat: https://console.firebase.google.com
    // ========================================
    firebaseConfig: {
        apiKey: "GANTI_DENGAN_API_KEY",
        authDomain: "project-id.firebaseapp.com",
        projectId: "project-id",
        storageBucket: "project-id.appspot.com",
        messagingSenderId: "000000000000",
        appId: "1:000000000000:web:xxxxxxxxxxxx"
    },

    db: null,
    user: null,
    initialized: false,

    // Initialize Firebase
    async init() {
        if (this.initialized) return;
        try {
            // Load Firebase from CDN
            await this.loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
            await this.loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
            await this.loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');

            firebase.initializeApp(this.firebaseConfig);
            this.db = firebase.firestore();
            this.initialized = true;

            // Listen for auth state changes
            firebase.auth().onAuthStateChanged((user) => {
                this.user = user;
                this.updateUI();
                if (user) {
                    this.loadDataFromCloud();
                }
            });

            return true;
        } catch (e) {
            console.error('Firebase init error:', e);
            return false;
        }
    },

    // Load external script
    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    // Check if Firebase is configured
    isConfigured() {
        return this.firebaseConfig.apiKey !== "GANTI_DENGAN_API_KEY";
    },

    // Login with Google
    async loginGoogle() {
        if (!this.initialized) await this.init();
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await firebase.auth().signInWithPopup(provider);
        } catch (e) {
            console.error('Google login error:', e);
            alert('Login Google gagal: ' + e.message);
        }
    },

    // Login with Email/Password
    async loginEmail(email, password) {
        if (!this.initialized) await this.init();
        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                // Auto register
                try {
                    await firebase.auth().createUserWithEmailAndPassword(email, password);
                } catch (regErr) {
                    alert('Gagal daftar: ' + regErr.message);
                }
            } else {
                alert('Login gagal: ' + e.message);
            }
        }
    },

    // Login anonymously (tanpa registrasi)
    async loginAnon() {
        if (!this.initialized) await this.init();
        try {
            await firebase.auth().signInAnonymously();
        } catch (e) {
            alert('Login anonim gagal: ' + e.message);
        }
    },

    // Logout
    async logout() {
        if (firebase.auth()) {
            await firebase.auth().signOut();
            this.user = null;
            this.updateUI();
        }
    },

    // Save data to cloud
    async saveToCloud(data) {
        if (!this.user || !this.db) return false;
        try {
            const docRef = this.db.collection('users').doc(this.user.uid);
            await docRef.set({
                ...data,
                _lastSync: firebase.firestore.FieldValue.serverTimestamp(),
                _email: this.user.email || 'anonymous'
            });
            return true;
        } catch (e) {
            console.error('Save to cloud error:', e);
            return false;
        }
    },

    // Load data from cloud
    async loadDataFromCloud() {
        if (!this.user || !this.db) return null;
        try {
            const docRef = this.db.collection('users').doc(this.user.uid);
            const doc = await docRef.get();
            if (doc.exists) {
                const cloudData = doc.data();
                delete cloudData._lastSync;
                delete cloudData._email;

                // Merge with local data (cloud wins on conflict)
                const localData = DataStore.load();
                const merged = this.mergeData(localData, cloudData);
                DataStore.save(merged);

                // Refresh UI
                if (typeof App !== 'undefined' && App.currentSection) {
                    Dashboard.refresh();
                    Settings.loadProfile();
                }
                return merged;
            }
            return null;
        } catch (e) {
            console.error('Load from cloud error:', e);
            return null;
        }
    },

    // Merge local and cloud data
    mergeData(local, cloud) {
        // Cloud profile wins
        const merged = { ...local };

        if (cloud.profile && cloud.profile.setupComplete) {
            merged.profile = cloud.profile;
        }

        // Merge attendance (union, cloud wins on conflict)
        merged.attendance = { ...local.attendance, ...cloud.attendance };

        // Merge leaves (union by id)
        const leaveMap = {};
        [...(local.leaves || []), ...(cloud.leaves || [])].forEach(l => {
            const key = l.date + '_' + l.days;
            leaveMap[key] = l;
        });
        merged.leaves = Object.values(leaveMap);

        // Merge MC claims
        const mcMap = {};
        [...(local.mcClaims || []), ...(cloud.mcClaims || [])].forEach(c => {
            mcMap[c.id || c.date] = c;
        });
        merged.mcClaims = Object.values(mcMap);

        // Merge hospital claims
        const hospMap = {};
        [...(local.hospitalClaims || []), ...(cloud.hospitalClaims || [])].forEach(c => {
            hospMap[c.id || c.date] = c;
        });
        merged.hospitalClaims = Object.values(hospMap);

        return merged;
    },

    // Auto sync (call after every data save)
    async autoSync(data) {
        if (!this.user) return;
        // Debounce: don't sync too frequently
        if (this._syncTimeout) clearTimeout(this._syncTimeout);
        this._syncTimeout = setTimeout(() => {
            this.saveToCloud(data);
        }, 2000);
    },

    // Update UI based on auth state
    updateUI() {
        const statusEl = document.getElementById('cloud-status');
        const loginSection = document.getElementById('cloud-login-section');
        const userSection = document.getElementById('cloud-user-section');

        if (!statusEl) return;

        if (this.user) {
            const name = this.user.displayName || this.user.email || 'Pengguna Anonim';
            const email = this.user.email || 'Login Anonim';
            statusEl.innerHTML = `
                <div class="cloud-connected">
                    <span class="cloud-icon">☁️</span>
                    <div>
                        <div class="cloud-name">${name}</div>
                        <div class="cloud-email">${email}</div>
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
