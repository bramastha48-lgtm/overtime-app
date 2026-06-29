# Kalkulator Lembur & Benefit

Aplikasi penghitungan lembur, cuti tahunan, medical check up, dan rawat inap sesuai peraturan Disnaker Indonesia.

## Fitur

### 📊 Dashboard
- Ringkasan total lembur, uang makan, dan klaim MC bulan ini
- Saldo cuti tahunan, medical check up, dan rawat inap
- Jadwal pencairan berikutnya (otomatis)

### 📝 Absensi Harian
- **Weekday (Senin-Jumat):** Pilih lembur sampai jam 6/7/7:30/8 malam
  - Istirahat lembur: 18:00-18:30 (30 menit)
- **Weekend (Sabtu-Minggu):** Input manual jam masuk & pulang
  - Istirahat: 12:00-13:00 (1 jam)
- **Tanggal Merah/Libur Nasional:** Pilihan khusus, masuk dihitung sebagai lembur

### 💰 Perhitungan Lembur (Sesuai Disnaker)
- Tarif per jam = Gaji ÷ 173
- **Weekday:** Jam ke-1 = 1.5x, jam ke-2 dst = 2x
- **Weekend/Libur:** 8 jam pertama = 2x, jam ke-9 = 3x, jam ke-10-11 = 4x
- Uang makan Rp 30.000/hari masuk

### 🏖️ Cuti Tahunan
- Input jatah cuti (bisa diubah tiap tahun)
- Catat penggunaan cuti
- Visual sisa cuti

### 🏥 Medical Check Up
- Saldo otomatis berdasarkan status keluarga:
  - Belum berkeluarga: 1x gaji
  - Berkeluarga tanpa anak: 1.2x gaji
  - Anak 1: 1.3x, Anak 2: 1.4x, Anak 3: 1.5x gaji
- Klaim langsung potong saldo
- Riwayat klaim dengan tanggal pencairan

### 🛏️ Rawat Inap
- Saldo otomatis berdasarkan status keluarga:
  - Belum berkeluarga: 4x gaji
  - Berkeluarga tanpa anak: 6x gaji
  - Anak 1-3: 8x gaji
- Klaim potong saldo
- Riwayat klaim

### 📅 Siklus Pencairan
- Periode: Kamis → Rabu
- Pencairan: Jumat minggu ke-2 setelah periode
- Contoh: Klaim 25 Jun - 1 Jul → Cair 10 Jul 2026

## Cara Build APK

### Opsi 1: Menggunakan Bubblewrap (TWA - Trusted Web Activity)

1. Install Node.js (v16+)
2. Install Bubblewrap CLI:
   ```bash
   npm install -g @aspect-build/aspect-cli @aspect-build/bazel-lib
   npm install -g @nicolo-ribaudo/chokidar-2
   npm install -g @nicolo-ribaudo/chokidar-3
   npm install -g bubblewrap
   ```
   Atau lebih simpel:
   ```bash
   npm install -g @nicolo-ribaudo/bubblewrap
   ```

3. Deploy web app ke hosting (GitHub Pages, Netlify, Vercel, atau Firebase)
4. Jalankan:
   ```bash
   bubblewrap init --manifest https://your-domain.com/manifest.json
   bubblewrap build
   ```
5. File APK akan dihasilkan di folder project

### Opsi 2: Menggunakan PWABuilder

1. Deploy web app ke hosting
2. Buka https://www.pwabuilder.com/
3. Masukkan URL aplikasi
4. Klik "Package for stores" → Pilih Android
5. Download APK

### Opsi 3: Menggunakan Android Studio + WebView

1. Buat project Android baru di Android Studio
2. Tambahkan WebView di MainActivity:
   ```java
   WebView webView = findViewById(R.id.webview);
   webView.getSettings().setJavaScriptEnabled(true);
   webView.getSettings().setDomStorageEnabled(true);
   webView.loadUrl("file:///android_asset/index.html");
   ```
3. Copy file web ke folder `app/src/main/assets/`
4. Build APK

### Opsi 4: Local Web App (Tanpa APK)

Buka `index.html` langsung di browser HP. Data tersimpan di LocalStorage browser.

## Struktur File

```
overtime-app/
├── index.html      # Halaman utama
├── style.css       # Styling
├── utils.js        # Fungsi utilitas
├── data.js         # Layer penyimpanan (LocalStorage)
├── calc.js         # Mesin perhitungan
├── app.js          # Logika aplikasi
├── manifest.json   # PWA manifest
└── README.md       # Dokumentasi
```

## Peraturan Referensi

- PP 35/2021 tentang Pengupahan
- Permenaker tentang Waktu Kerja Lembur
- Tarif lembur = Gaji ÷ 173 jam/bulan
