# 🔥 Setup Firebase (Cloud Sync)

Supaya data tidak hilang walau hapus cache, kita pakai **Firebase** — gratis dari Google.

## Langkah-langkah (5 menit)

### 1. Buat Project Firebase

1. Buka https://console.firebase.google.com
2. Klik **"Create a project"** (atau "Buat proyek")
3. Kasih nama: `overtime-app` (atau apa saja)
4. Google Analytics: **matikan** (tidak perlu)
5. Klik **Create project**

### 2. Aktifkan Authentication

1. Di menu kiri, klik **Authentication**
2. Klik **Get started**
3. Di tab **Sign-in provider**, aktifkan:
   - ✅ **Email/Password**
   - ✅ **Google**
   - ✅ **Anonymous**
4. Klik **Save** untuk masing-masing

### 3. Aktifkan Firestore Database

1. Di menu kiri, klik **Firestore Database**
2. Klik **Create database**
3. Pilih **Start in test mode** (untuk development)
4. Pilih lokasi server: **asia-southeast2** (Jakarta) atau terdekat
5. Klik **Enable**

### 4. Ambil Konfigurasi

1. Di menu kiri atas, klik ⚙️ → **Project settings**
2. Scroll ke bawah, klik icon **Web** (`</>`)
3. Kasih nama app: `overtime-web`
4. Klik **Register app**
5. Akan muncul kode seperti ini:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "overtime-app-xxxxx.firebaseapp.com",
    projectId: "overtime-app-xxxxx",
    storageBucket: "overtime-app-xxxxx.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:xxxxxxxxxxxx"
};
```

### 5. Masukkan Konfigurasi ke App

1. Buka file `cloud.js` di project
2. Ganti bagian `firebaseConfig` dengan konfigurasi dari langkah 4:

```javascript
firebaseConfig: {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXX",      // ← ganti
    authDomain: "overtime-app-xxxxx.firebaseapp.com",  // ← ganti
    projectId: "overtime-app-xxxxx",             // ← ganti
    storageBucket: "overtime-app-xxxxx.appspot.com",  // ← ganti
    messagingSenderId: "123456789012",           // ← ganti
    appId: "1:123456789012:web:xxxxxxxxxxxx"     // ← ganti
},
```

3. Push ke GitHub (atau upload manual)

### 6. Selesai! 🎉

Sekarang di menu **Settings** app akan muncul pilihan login:
- **Email/Password** — daftar pakai email
- **Google** — login pakai akun Google (paling mudah)
- **Anonim** — tanpa registrasi (data tetap tersimpan)

Setelah login, data otomatis tersimpan di cloud. Ganti HP? Login pakai akun yang sama → data langsung muncul.

## Keamanan (Opsional tapi Disarankan)

Setelah semua jalan, atur Firestore Rules supaya data lebih aman:

1. Buka **Firestore Database** → tab **Rules**
2. Ganti rules dengan:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Klik **Publish**

Ini memastikan setiap user hanya bisa baca/tulis data miliknya sendiri.

## Gratis atau Bayar?

**Gratis (Spark Plan):**
- 1 GB penyimpanan
- 50.000 baca/hari
- 20.000 tulis/hari

Untuk aplikasi personal seperti ini, **sangat lebih dari cukup**. Tidak perlu bayar.
