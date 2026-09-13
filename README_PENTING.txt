CARA PAKAI:
1. Folder ini berisi: index.html, style.css, assets/ (5 gambar baru + reuse brain.png, robot.png, dna.png, swirl.png lama)
2. script.js dan data.js TIDAK diubah — copy punya kamu yang lama ke folder ini apa adanya.
3. Tambahkan juga file assets lama kamu (brain.png, robot.png, dna.png, swirl.png) ke folder assets/ ini,
   karena masih dipakai di splash screen.

Struktur akhir:

neurobio-upload/
├── index.html
├── style.css
├── script.js         <- punya kamu (tidak berubah)
├── data.js           <- punya kamu (tidak berubah)
└── assets/
    ├── brain.png          <- lama (splash)
    ├── robot.png          <- lama (splash)
    ├── dna.png            <- lama (splash)
    ├── swirl.png          <- lama (splash)
    ├── brain-glow.png     <- BARU: otak untuk header Unggah & Processing
    ├── robot-unggah.png   <- BARU: robot untuk header Unggah & Processing
    ├── folder-upload.png  <- BARU: ganti icon folder emoji di Unggah
    ├── brain-baru.png     <- BARU: karakter pixel bulat, dipakai di Processing
    └── cursor-pixel.png   <- BARU: dekorasi cursor di Processing

YANG DIUBAH (hanya di HTML/CSS, JS tidak disentuh):
1. Header (topbar) di screen #screen-upload dan #screen-processing:
   emoji 🧠 dan 🤖 diganti gambar brain-glow.png dan robot-unggah.png
2. Icon folder 📁 di halaman Unggah diganti folder-upload.png (ukuran 84px, ada animasi
   mengambang pelan + drop shadow ungu)
3. Icon 🟣 di halaman Processing diganti brain-baru.png (128px, animasi bob naik-turun)
   dengan cursor-pixel.png sebagai aksen kecil di pojok kanan bawahnya (ada animasi wiggle)
4. Semua ID, class lain, dan logic JS TIDAK diubah sama sekali — dropzone, progress bar,
   speech bubble tetap pakai HTML/CSS asli (dinamis, bukan gambar statis), sesuai
   permintaan kamu.

Kalau ukuran gambar masih kurang pas (kegedean/kekecilan), tinggal ubah angka width
di style.css:
- .folder-upload-img { width: 84px; ... }
- .brain-baru-img { width: 128px; ... }
- .cursor-pixel-deco { width: 48px; ... }
- .brain-mini-img / .mascot-mini-img { width: 30px; height: 30px; ... }
