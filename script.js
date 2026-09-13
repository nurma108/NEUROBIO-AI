/* =========================================================
   NEUROBIO-AI — script.js
   Semua state hidup HANYA di memori (variabel JS biasa).
   Tidak ada localStorage / login — refresh = mulai dari nol.
   Kecuali: ringkasan progres (lama baca, jumlah jeda, nilai)
   dikirim ke backend supaya guru bisa memantau lewat Dashboard Guru.

   MATERI & KUIS sekarang diambil dari server (materi yang diaktifkan
   guru di Dashboard Guru), bukan lagi selalu dari data.js. data.js
   tetap dipakai sebagai fallback demo kalau server tidak bisa dihubungi.

   UPLOAD MATERI — dua jalur:
   - Dari Home (siswa): tersimpan, TIDAK otomatis aktif, perlu approval
     guru (tekan "Jadikan Aktif" di Dashboard Guru).
   - Dari Dashboard Guru (guru): begitu selesai diproses, LANGSUNG
     jadi materi aktif tanpa approval tambahan.
   ========================================================= */

const state = {
  hesitationEnabled: true,
  fontScale: 1,
  ttsRate: 0.9,
  cardIndex: 0,
  quizIndex: 0,
  quizAnswers: [],
  hesitationCount: 0,
  hesitationWords: new Set(),
  readStartTime: null,
  readMsAccumulated: 0,
  quizLocked: true,
  materiSelesai: false,
  namaMurid: "",
  sesiId: null,
  sesiJam: null,
  backendUrl: "https://neurobio-ai-production.up.railway.app",
  materiAktif: null,
  kuisAktif: [],
  pdfFile: null,
  uploadSumber: "siswa",
  isProcessingAI: false,
};

const NAV_ITEMS = [
  { id: "screen-home", label: "Home", icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 11.5 12 4l8 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  { id: "screen-baca", label: "Baca", icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 6c-1.8-1.3-4.2-2-6.5-2A1 1 0 0 0 4.5 5v13A1 1 0 0 0 5.5 19c2.3 0 4.7.7 6.5 2 1.8-1.3 4.2-2 6.5-2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1c-2.3 0-4.7.7-6.5 2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 6v14" stroke="currentColor" stroke-width="1.4"/></svg>` },
  { id: "screen-evaluasi", label: "Evaluasi", icon: `<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6"/><path d="M9 13l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  { id: "screen-progres", label: "Progres", icon: `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="13" width="4" height="7" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="10" y="9" width="4" height="11" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="16" y="5" width="4" height="15" rx="1" stroke="currentColor" stroke-width="1.6"/></svg>` },
  { id: "screen-pengaturan", label: "Pengaturan", icon: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>` },
];

/* ---------------- Navigation ---------------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  buildBottomNav(id);
  if (id === "screen-baca") onEnterBaca();
  if (id === "screen-evaluasi") onEnterEvaluasi();
  if (id === "screen-progres") onEnterProgres();
  if (id === "screen-guru") { loadDashboardGuru(); loadDaftarMateri(); }
  if (id === "screen-upload") updateUploadScreenForSumber();
  window.speechSynthesis.cancel();
}

function buildBottomNav(activeId) {
  ["bottom-nav-home", "bottom-nav-baca", "bottom-nav-evaluasi", "bottom-nav-progres", "bottom-nav-pengaturan"]
    .forEach(navId => {
      const el = document.getElementById(navId);
      if (!el) return;
      el.innerHTML = "";
      NAV_ITEMS.forEach(item => {
        const btn = document.createElement("button");
        btn.className = "nav-item" + (item.id === activeId ? " active" : "");
        btn.innerHTML = `<span class="nav-ico-wrap">${item.icon}</span><span>${item.label}</span>`;
        btn.addEventListener("click", () => showScreen(item.id));
        el.appendChild(btn);
      });
    });
}

document.querySelectorAll("[data-nav]").forEach(el => {
  el.addEventListener("click", () => {
    if (state.isProcessingAI) {
      const yakin = confirm("Proses AI masih berjalan di belakang layar. Kalau kamu pindah sekarang, kamu tidak akan lihat notifikasi selesai/gagalnya. Tetap pindah?");
      if (!yakin) return;
    }
    if (el.dataset.nav === "screen-upload") {
      state.uploadSumber = "siswa";
    }
    showScreen(el.dataset.nav);
  });
});

/* ---------------- Materi aktif (diambil dari server) ---------------- */
async function muatMateriAktif() {
  try {
    const res = await fetch(`${state.backendUrl}/api/materi-aktif`);
    const data = await res.json();
    if (data.error || !data.materi) {
      state.materiAktif = null;
      state.kuisAktif = [];
    } else {
      state.materiAktif = data.materi;
      state.kuisAktif = data.materi.kuis || [];
    }
  } catch (err) {
    console.warn("Gagal memuat materi aktif dari server, pakai materi contoh:", err);
    state.materiAktif = MATERI;
    state.kuisAktif = KUIS;
  }
  updateHomeMateriInfo();
}

function updateHomeMateriInfo() {
  const judulEl = document.getElementById("home-materi-judul");
  const descEl = document.getElementById("home-materi-desc");
  const btnMulai = document.getElementById("btn-mulai-membaca");
  if (!judulEl) return;
  if (state.materiAktif && state.materiAktif.kartu && state.materiAktif.kartu.length > 0) {
    judulEl.textContent = state.materiAktif.judul;
    descEl.textContent = "Progres akan ditampilkan selama sesi membaca berlangsung.";
    if (btnMulai) btnMulai.disabled = false;
  } else {
    judulEl.textContent = "Belum Ada Materi";
    descEl.textContent = "Materi belum tersedia, tunggu guru mengunggah dan mengaktifkan materi.";
    if (btnMulai) btnMulai.disabled = true;
  }
}

/* ---------------- Splash ---------------- */
function runSplash() {
  const fill = document.getElementById("splash-progress");
  let pct = 0;
  const timer = setInterval(() => {
    pct += 2;
    fill.style.width = Math.min(pct, 100) + "%";
    if (pct >= 100) {
      clearInterval(timer);
      setTimeout(() => showScreen("screen-siapa"), 500);
    }
  }, 120);
}

/* ---------------- Siapa Kamu (Murid / Guru) ---------------- */
function getTanggalHariIni() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mulaiSesiBaru() {
  const now = new Date();
  state.sesiId = now.toISOString();
  state.sesiJam = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  state.cardIndex = 0;
  state.quizIndex = 0;
  state.quizAnswers = [];
  state.hesitationCount = 0;
  state.hesitationWords = new Set();
  state.readStartTime = null;
  state.readMsAccumulated = 0;
  state.quizLocked = true;
  state.materiSelesai = false;
}

document.getElementById("btn-masuk-murid").addEventListener("click", async () => {
  const val = document.getElementById("input-nama-murid").value.trim();
  const errEl = document.getElementById("nama-error");
  if (!val) {
    errEl.hidden = false;
    errEl.textContent = "Nama panggilan tidak boleh kosong.";
    return;
  }
  errEl.hidden = true;

  try {
    const res = await fetch(`${state.backendUrl}/api/cek-kode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kode: val }),
    });
    const data = await res.json();
    if (!data.valid) {
      errEl.hidden = false;
      errEl.textContent = "Nama panggilan tidak ditemukan. Tanya gurumu untuk nama panggilan yang benar ya.";
      return;
    }
  } catch (err) {
    console.warn("Gagal cek kode ke server, lanjut tanpa validasi:", err);
  }

  state.namaMurid = val;
  mulaiSesiBaru();
  await muatMateriAktif();
  showScreen("screen-onboarding");
});

/* ---------------- Akses Dashboard Guru ---------------- */
const PIN_GURU = "246";
let guruMasukDari = "screen-siapa";

function bukaModalPinGuru(asalScreen) {
  guruMasukDari = asalScreen;
  document.getElementById("input-pin-guru").value = "";
  document.getElementById("pin-guru-error").hidden = true;
  document.getElementById("guru-pin-overlay").hidden = false;
}
document.getElementById("btn-buka-guru-pin").addEventListener("click", () => bukaModalPinGuru("screen-siapa"));
document.getElementById("btn-buka-guru-pin-home").addEventListener("click", () => bukaModalPinGuru("screen-home"));

document.getElementById("btn-pin-guru-batal").addEventListener("click", () => {
  document.getElementById("guru-pin-overlay").hidden = true;
});
document.getElementById("btn-pin-guru-masuk").addEventListener("click", () => {
  const val = document.getElementById("input-pin-guru").value.trim();
  if (val === PIN_GURU) {
    document.getElementById("guru-pin-overlay").hidden = true;
    showScreen("screen-guru");
  } else {
    document.getElementById("pin-guru-error").hidden = false;
  }
});

document.getElementById("btn-guru-keluar").addEventListener("click", () => {
  showScreen(guruMasukDari);
});

document.getElementById("btn-guru-refresh").addEventListener("click", async () => {
  const icon = document.querySelector("#btn-guru-refresh .refresh-ico-svg");
  if (icon) icon.classList.add("spinning");
  try {
    await Promise.all([loadDashboardGuru(), loadDaftarMateri()]);
  } finally {
    if (icon) icon.classList.remove("spinning");
  }
});

document.getElementById("btn-guru-tambah-murid").addEventListener("click", async () => {
  const namaAsliEl = document.getElementById("input-guru-nama-asli");
  const namaPanggilanEl = document.getElementById("input-guru-nama-panggilan");
  const errEl = document.getElementById("guru-tambah-error");
  const hasilEl = document.getElementById("guru-kode-hasil");
  const namaAsli = namaAsliEl.value.trim();
  const namaPanggilan = namaPanggilanEl.value.trim();
  errEl.hidden = true;
  hasilEl.hidden = true;

  if (!namaAsli || !namaPanggilan) {
    errEl.hidden = false;
    errEl.textContent = "Nama asli dan nama panggilan wajib diisi.";
    return;
  }

  try {
    const res = await fetch(`${state.backendUrl}/api/murid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama_asli: namaAsli, nama_panggilan: namaPanggilan }),
    });
    const data = await res.json();
    if (data.error) {
      errEl.hidden = false;
      errEl.textContent = data.error;
      return;
    }
    namaAsliEl.value = "";
    namaPanggilanEl.value = "";
    hasilEl.hidden = false;
    hasilEl.textContent = `Kode untuk ${namaPanggilan}: ${data.kode}`;
    loadDashboardGuru();
  } catch (err) {
    errEl.hidden = false;
    errEl.textContent = "Gagal menambah murid: " + err.message;
  }
});

async function hapusMurid(kode, namaPanggilan) {
  if (!confirm(`Hapus murid "${namaPanggilan}" (${kode}) beserta seluruh riwayat bacanya?`)) return;
  try {
    await fetch(`${state.backendUrl}/api/murid/${encodeURIComponent(kode)}`, { method: "DELETE" });
    loadDashboardGuru();
  } catch (err) {
    alert("Gagal menghapus murid: " + err.message);
  }
}

async function simpanEditMurid(kode, namaAsliBaru, namaPanggilanBaru) {
  try {
    await fetch(`${state.backendUrl}/api/murid/${encodeURIComponent(kode)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama_asli: namaAsliBaru, nama_panggilan: namaPanggilanBaru }),
    });
    loadDashboardGuru();
  } catch (err) {
    alert("Gagal menyimpan perubahan: " + err.message);
  }
}

/* ---------------- Daftar Materi (Dashboard Guru) ---------------- */
async function loadDaftarMateri() {
  const listEl = document.getElementById("guru-materi-list");
  if (!listEl) return;
  listEl.innerHTML = `<p class="note-center">Memuat daftar materi…</p>`;

  try {
    const res = await fetch(`${state.backendUrl}/api/daftar-materi`);
    if (!res.ok) throw new Error(`Server merespons error (${res.status})`);
    const data = await res.json();
    const idList = Object.keys(data.materi || {});

    if (idList.length === 0) {
      listEl.innerHTML = `<p class="note-center">Belum ada materi yang diunggah. Unggah PDF lewat menu "Unggah Materi".</p>`;
      return;
    }

    idList.sort((a, b) => (data.materi[b].tanggal_upload || "").localeCompare(data.materi[a].tanggal_upload || ""));

    listEl.innerHTML = "";
    idList.forEach(id => {
      const m = data.materi[id];
      const sumberBadge = m.sumber === "siswa"
        ? '<span class="guru-kode-badge guru-kode-badge--siswa">Dari Siswa</span>'
        : '<span class="guru-kode-badge guru-kode-badge--guru">Dari Guru</span>';
      const perluApproval = m.sumber === "siswa" && !m.aktif;
      const kuisKosong = m.jumlah_kuis === 0;

      const row = document.createElement("div");
      row.className = "card guru-materi-card";
      row.innerHTML = `
        <div class="guru-murid-header">
          <div>
            <strong>${m.judul}</strong>${m.aktif ? '<span class="guru-kode-badge">AKTIF</span>' : ""}${sumberBadge}
            <p class="small guru-nama-asli">${m.jumlah_kartu} kartu · ${m.jumlah_kuis} soal evaluasi${kuisKosong ? " ⚠️" : ""}${perluApproval ? " · menunggu persetujuan guru" : ""}</p>
            ${kuisKosong ? '<p class="small note-error">Kuis gagal dibuat otomatis (kemungkinan rate limit API). Tekan "Buat Ulang Kuis" di bawah.</p>' : ""}
          </div>
          <div class="guru-murid-actions">
            ${m.aktif ? "" : `<button class="btn btn-primary" data-action="aktifkan">${perluApproval ? "Setujui & Aktifkan" : "Jadikan Aktif"}</button>`}
            ${kuisKosong ? '<button class="btn btn-ghost" data-action="buat-ulang-kuis">🔁 Buat Ulang Kuis</button>' : ""}
            <button class="chip-btn" data-action="hapus-materi">🗑️</button>
          </div>
        </div>
      `;
      listEl.appendChild(row);

      const btnAktif = row.querySelector('[data-action="aktifkan"]');
      if (btnAktif) {
        btnAktif.addEventListener("click", async () => {
          try {
            await fetch(`${state.backendUrl}/api/materi-aktif/${encodeURIComponent(id)}`, { method: "POST" });
            loadDaftarMateri();
          } catch (err) {
            alert("Gagal mengaktifkan materi: " + err.message);
          }
        });
      }

      const btnBuatUlangKuis = row.querySelector('[data-action="buat-ulang-kuis"]');
      if (btnBuatUlangKuis) {
        btnBuatUlangKuis.addEventListener("click", async () => {
          btnBuatUlangKuis.disabled = true;
          btnBuatUlangKuis.textContent = "⏳ Memproses…";
          try {
            const res2 = await fetch(`${state.backendUrl}/api/materi/${encodeURIComponent(id)}/generate-ulang-kuis`, { method: "POST" });
            const hasil = await res2.json();
            if (hasil.error) {
              alert("Gagal membuat kuis: " + hasil.error);
              btnBuatUlangKuis.disabled = false;
              btnBuatUlangKuis.textContent = "🔁 Buat Ulang Kuis";
            } else {
              alert(`Berhasil! ${hasil.jumlah_kuis} soal evaluasi dibuat.`);
              loadDaftarMateri();
              // Kalau materi ini yang sedang aktif dibaca murid, refresh juga di sisi murid
              muatMateriAktif();
            }
          } catch (err) {
            alert("Gagal membuat kuis: " + err.message);
            btnBuatUlangKuis.disabled = false;
            btnBuatUlangKuis.textContent = "🔁 Buat Ulang Kuis";
          }
        });
      }

      row.querySelector('[data-action="hapus-materi"]').addEventListener("click", async () => {
        if (!confirm(`Hapus materi "${m.judul}"?`)) return;
        try {
          await fetch(`${state.backendUrl}/api/materi/${encodeURIComponent(id)}`, { method: "DELETE" });
          loadDaftarMateri();
        } catch (err) {
          alert("Gagal menghapus materi: " + err.message);
        }
      });
    });
  } catch (err) {
    listEl.innerHTML = `<p class="note-center note-error">Gagal memuat daftar materi: ${err.message}</p>`;
  }
}

document.getElementById("btn-onboarding-done").addEventListener("click", () => showScreen("screen-home"));

/* ---------------- Tombol upload khusus Dashboard Guru ---------------- */
const btnGuruUpload = document.getElementById("btn-guru-upload");
if (btnGuruUpload) {
  btnGuruUpload.addEventListener("click", () => {
    state.uploadSumber = "guru";
    showScreen("screen-upload");
  });
}

function updateUploadScreenForSumber() {
  const titleEl = document.querySelector("#screen-upload h3");
  const noteEl = document.getElementById("upload-note");
  if (!titleEl || !noteEl) return;
  if (state.uploadSumber === "guru") {
    titleEl.textContent = "Unggah Materi Biologi (Guru)";
    noteEl.textContent = "Materi ini akan langsung menjadi materi aktif begitu selesai diproses, tanpa perlu persetujuan tambahan.";
  } else {
    titleEl.textContent = "Unggah Materi Biologi";
    noteEl.textContent = "Materi hasil unggahanmu akan tersimpan dulu dan menunggu persetujuan guru sebelum bisa dipakai untuk belajar.";
  }
}

/* ---------------- Upload: pilih file PDF asli ---------------- */
const fileInput = document.getElementById("pdf-file-input");
const btnProsesAI = document.getElementById("btn-proses-ai");
const uploadError = document.getElementById("upload-error");

document.getElementById("backend-url-input").addEventListener("input", e => {
  state.backendUrl = e.target.value.trim().replace(/\/$/, "");
});

fileInput.addEventListener("change", () => {
  uploadError.hidden = true;
  const file = fileInput.files[0];
  if (!file) return;
  if (file.type !== "application/pdf") {
    uploadError.hidden = false;
    uploadError.textContent = "File harus berformat PDF.";
    return;
  }
  state.pdfFile = file;
  document.getElementById("file-row-empty").innerHTML = `
    <span class="file-badge">PDF</span>
    <div>
      <strong>${file.name}</strong>
      <p class="small">${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
    </div>
    <span class="check-ico">✅</span>`;
  btnProsesAI.disabled = false;
});

async function extractPdfText(file) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(it => it.str).join(" ") + "\n";
  }
  return fullText.trim();
}

const USE_REAL_AI = true;

document.getElementById("btn-proses-ai").addEventListener("click", async () => {
  if (!state.pdfFile) return;
  showScreen("screen-processing");

  if (!USE_REAL_AI) {
    setProcessingUI(0, `Membaca "${state.pdfFile.name}"…`);
    let pct = 0;
    const timer = setInterval(() => {
      pct += 8;
      const msg = pct < 40 ? `Membaca "${state.pdfFile.name}"…`
        : pct < 80 ? "Menyederhanakan kalimat & memenggal suku kata…"
        : "Menyusun kartu pembelajaran…";
      setProcessingUI(Math.min(pct, 100), msg);
      if (pct >= 100) {
        clearInterval(timer);
        setTimeout(() => showScreen("screen-home"), 400);
      }
    }, 140);
    return;
  }

  state.isProcessingAI = true;
  setProcessingUI(10, "Membaca teks dari PDF…");
  try {
    const rawText = await extractPdfText(state.pdfFile);
    if (!rawText || rawText.length < 20) {
      throw new Error("Tidak bisa membaca teks dari PDF ini (mungkin hasil scan gambar, bukan teks asli).");
    }

    setProcessingUI(40, "Mengirim ke NEUROBIO-AI untuk disederhanakan… (bisa sampai 1-2 menit termasuk pembuatan kuis)");

    const res = await fetch(`${state.backendUrl}/api/simplify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: rawText,
        judul: state.pdfFile.name.replace(/\.pdf$/i, ""),
        sumber: state.uploadSumber || "siswa",
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Server backend merespons error (${res.status}).`);
    }

    setProcessingUI(85, "Menyusun kartu & soal evaluasi…");
    const data = await res.json();

    if (data.error || !data.kartu || !Array.isArray(data.kartu) || data.kartu.length === 0) {
      throw new Error(data.error || "AI tidak mengembalikan kartu yang valid. Coba lagi.");
    }

    setProcessingUI(100, "Selesai! Materi tersimpan di server.");
    const jumlahKuis = (data.kuis || []).length;
    const peringatanKuis = jumlahKuis === 0
      ? `<br><br>⚠️ Soal evaluasi gagal dibuat otomatis (kemungkinan server AI sedang sibuk). Buka Dashboard Guru → Daftar Materi, lalu tekan "Buat Ulang Kuis" pada materi ini.`
      : "";
    if (data.auto_aktif) {
      document.getElementById("processing-message").innerHTML =
        `✅ Materi "<strong>${data.judul}</strong>" (${data.kartu.length} kartu, ${jumlahKuis} soal evaluasi) berhasil dibuat dan langsung menjadi <strong>materi aktif</strong>.${peringatanKuis}`;
    } else {
      document.getElementById("processing-message").innerHTML =
        `✅ Materi "<strong>${data.judul}</strong>" (${data.kartu.length} kartu, ${jumlahKuis} soal evaluasi) berhasil dibuat dan tersimpan.` +
        `<br><br>Materi ini masih <strong>menunggu persetujuan guru</strong> sebelum bisa dipakai untuk belajar.${peringatanKuis}`;
    }
    state.uploadSumber = "siswa";
    state.isProcessingAI = false;
    await muatMateriAktif();
    setTimeout(() => showScreen("screen-home"), jumlahKuis === 0 ? 4000 : 2500);
  } catch (err) {
    console.error(err);
    state.isProcessingAI = false;
    document.getElementById("processing-message").innerHTML =
      "⚠️ " + (err.message || "Terjadi kesalahan saat memproses PDF.") +
      "<br><br>Pastikan backend server sudah berjalan (lihat folder /server) dan API key sudah benar.";
    document.getElementById("processing-fill").style.background = "#ef4444";
  }
});

function setProcessingUI(pct, message) {
  document.getElementById("processing-fill").style.width = pct + "%";
  document.getElementById("processing-pct").textContent = pct + "%";
  document.getElementById("processing-message").textContent = message;
}

document.getElementById("btn-mulai-membaca").addEventListener("click", () => showScreen("screen-baca"));

/* ---------------- Hesitation / TTS toggle ---------------- */
function syncHesitationToggles(source) {
  const a = document.getElementById("toggle-hesitation");
  const b = document.getElementById("toggle-hesitation-2");
  state.hesitationEnabled = source.checked;
  a.checked = state.hesitationEnabled;
  b.checked = state.hesitationEnabled;
}
document.getElementById("toggle-hesitation").addEventListener("change", e => syncHesitationToggles(e.target));
document.getElementById("toggle-hesitation-2").addEventListener("change", e => syncHesitationToggles(e.target));

/* ---------------- Font size controls ---------------- */
function applyFontScale() {
  document.documentElement.style.setProperty("--reading-scale", state.fontScale.toFixed(2));
  document.getElementById("font-size-label").textContent = Math.round(state.fontScale * 100) + "%";
}
function bumpFont(delta) {
  state.fontScale = Math.min(1.4, Math.max(0.8, state.fontScale + delta));
  applyFontScale();
}
document.getElementById("font-minus").addEventListener("click", () => bumpFont(-0.1));
document.getElementById("font-plus").addEventListener("click", () => bumpFont(0.1));
document.getElementById("font-minus-2").addEventListener("click", () => bumpFont(-0.1));
document.getElementById("font-plus-2").addEventListener("click", () => bumpFont(0.1));

document.getElementById("tts-rate").addEventListener("input", e => {
  state.ttsRate = parseFloat(e.target.value);
});

/* ---------------- Reset session ---------------- */
document.getElementById("btn-reset-sesi").addEventListener("click", () => resetSession());
document.getElementById("btn-ulangi").addEventListener("click", () => resetSession());

function resetSession() {
  mulaiSesiBaru();
  showScreen("screen-home");
  updateHomeProgress();
}

/* ---------------- TTS helper ---------------- */
let idVoice = null;
function pickIndonesianVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;
  idVoice =
    voices.find(v => v.lang === "id-ID" && /google/i.test(v.name)) ||
    voices.find(v => v.lang === "id-ID") ||
    voices.find(v => (v.lang || "").toLowerCase().startsWith("id")) ||
    null;
}
if ("speechSynthesis" in window) {
  pickIndonesianVoice();
  window.speechSynthesis.onvoiceschanged = pickIndonesianVoice;
}

function speak(hyphenatedText, onEnd) {
  if (!("speechSynthesis" in window)) { if (onEnd) onEnd(); return; }
  window.speechSynthesis.cancel();

  const syllables = hyphenatedText.split("-").map(s => s.trim()).filter(Boolean);
  const plainJoined = syllables.length ? syllables.join("") : hyphenatedText;
  const slowSpaced = syllables.length ? syllables.join(". ") : hyphenatedText;

  const nowPlaying = document.getElementById("tts-now-playing");
  const nowText = document.getElementById("tts-now-text");
  if (nowPlaying) {
    nowText.textContent = plainJoined;
    nowPlaying.hidden = false;
  }

  const makeUtterance = (text, rate) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "id-ID";
    if (idVoice) u.voice = idVoice;
    u.rate = rate;
    u.pitch = 1.0;
    return u;
  };

  const slowRate = Math.max(0.5, state.ttsRate - 0.35);
  const normalRate = Math.min(1.0, state.ttsRate);

  const slowUtter = makeUtterance(slowSpaced, slowRate);
  const normalUtter = makeUtterance(plainJoined, normalRate);

  const finish = () => { if (nowPlaying) nowPlaying.hidden = true; if (onEnd) onEnd(); };

  slowUtter.onend = () => window.speechSynthesis.speak(normalUtter);
  slowUtter.onerror = finish;
  normalUtter.onend = finish;
  normalUtter.onerror = finish;

  window.speechSynthesis.speak(slowUtter);
}

function hyphenForm(raw) {
  return raw.replace(/\*/g, "").replace(/[.,!?…]/g, "");
}

/* ---------------- Word/term tokenizer + render ---------------- */
function tokenizeLine(line) {
  return line.match(/\*[^*]+\*|\S+/g) || [];
}

function renderInlineTokens(text, parentEl) {
  tokenizeLine(text).forEach(tok => {
    const isTerm = tok.startsWith("*") && tok.endsWith("*");
    const hyph = hyphenForm(tok);
    const span = document.createElement("span");
    span.className = isTerm ? "term" : "word";
    span.textContent = hyph;
    span.tabIndex = 0;
    span.dataset.hyph = hyph;
    span.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); speak(hyph); }
    });
    parentEl.appendChild(span);
    parentEl.appendChild(document.createTextNode(" "));
  });
}

function renderReadingParagraphs(lines, container) {
  container.innerHTML = "";
  lines.forEach(line => {
    const p = document.createElement("p");
    renderInlineTokens(line, p);
    container.appendChild(p);
  });
}

/* ---------------- Finger-tracking hesitation ---------------- */
function setupFingerTracking(container, onHesitate, isActiveFn) {
  if (!container || container.dataset.trackingReady) return;
  container.dataset.trackingReady = "1";
  container.style.touchAction = "pan-y";
  container.style.overscrollBehavior = "contain";
  container.style.userSelect = "none";

  let currentEl = null;
  let timer = null;
  let leaveGraceTimer = null;
  let downActive = false;
  let downEl = null;
  let downTime = 0;

  function isActive() { return !isActiveFn || isActiveFn(); }

  function findWordAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    return el.closest(".word, .term");
  }

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
  }
  function cancelLeaveGrace() {
    if (leaveGraceTimer) { clearTimeout(leaveGraceTimer); leaveGraceTimer = null; }
  }

  function commitCurrent(el) {
    cancelLeaveGrace();
    if (el === currentEl) return;
    if (currentEl) currentEl.classList.remove("holding");
    clearTimer();
    currentEl = el;
    if (currentEl) {
      currentEl.classList.add("holding");
      timer = setTimeout(() => fireHesitation(currentEl), 3000);
    }
  }

  function setCurrent(el) {
    if (el) {
      commitCurrent(el);
    } else if (currentEl && !leaveGraceTimer) {
      leaveGraceTimer = setTimeout(() => {
        leaveGraceTimer = null;
        if (currentEl) currentEl.classList.remove("holding");
        clearTimer();
        currentEl = null;
      }, 180);
    }
  }

  function fireHesitation(el) {
    if (!el) return;
    el.classList.remove("holding");
    const hyph = el.dataset.hyph || el.textContent;
    const plain = hyph.replace(/-/g, "");
    currentEl = null;
    if (state.hesitationEnabled && onHesitate) {
      onHesitate(plain, () => {
        el.classList.add("speaking");
        speak(hyph, () => el.classList.remove("speaking"));
      });
    } else {
      speak(hyph, () => el.classList.remove("speaking"));
    }
  }

  container.addEventListener("pointerdown", e => {
    if (!isActive()) return;
    if (e.pointerType === "mouse") return;
    downActive = true;
    downTime = Date.now();
    downEl = findWordAt(e.clientX, e.clientY);
    if (downEl) e.preventDefault();
    setCurrent(downEl);
  });

  container.addEventListener("pointermove", e => {
    if (!isActive()) { cancelLeaveGrace(); setCurrent(null); return; }
    if (e.pointerType === "mouse") {
      setCurrent(findWordAt(e.clientX, e.clientY));
    } else if (downActive) {
      setCurrent(findWordAt(e.clientX, e.clientY));
    }
  });

  const endTouch = e => {
    cancelLeaveGrace();
    if (e && e.pointerType === "mouse") {
      setCurrent(null);
      return;
    }
    const heldMs = Date.now() - downTime;
    const wasQuickTapOnTerm = downEl && downEl.classList.contains("term") && heldMs < 3000 && downEl === currentEl;
    downActive = false;
    if (currentEl) currentEl.classList.remove("holding");
    clearTimer();
    currentEl = null;
    if (isActive() && wasQuickTapOnTerm) speak(downEl.dataset.hyph);
    downEl = null;
  };
  container.addEventListener("pointerup", endTouch);
  container.addEventListener("pointercancel", endTouch);
  container.addEventListener("pointerleave", endTouch);

  container.addEventListener("click", e => {
    if (!isActive()) return;
    const el = findWordAt(e.clientX, e.clientY);
    if (el && el.classList.contains("term")) speak(el.dataset.hyph);
  });
}

/* ---------------- Kirim log progres ---------------- */
async function kirimLogBaca() {
  if (!state.namaMurid || !state.sesiId) return;

  let readMs = state.readMsAccumulated;
  if (state.readStartTime) readMs += Date.now() - state.readStartTime;
  const lamaMenit = Math.round(readMs / 60000);

  const totalSoal = state.kuisAktif.length;
  const answered = state.quizAnswers.filter(a => a !== undefined).length;
  let nilai = null;
  let statusEvaluasi = "Belum dikerjakan";
  if (totalSoal > 0 && answered === totalSoal) {
    const correct = state.kuisAktif.reduce((acc, q, i) => acc + (state.quizAnswers[i] === q.jawaban ? 1 : 0), 0);
    nilai = Math.round((correct / totalSoal) * 100);
    statusEvaluasi = nilai >= 80 ? "Excellent" : nilai >= 60 ? "Baik" : "Perlu Latihan";
  }

  const tanggal = state.sesiId.slice(0, 10);

  try {
    await fetch(`${state.backendUrl}/api/log-baca`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama: state.namaMurid,
        tanggal,
        sesi_id: state.sesiId,
        jam: state.sesiJam,
        lama_baca_menit: lamaMenit,
        hesitation_count: state.hesitationCount,
        hesitation_words: [...state.hesitationWords],
        nilai,
        status_evaluasi: statusEvaluasi,
        materi: state.materiAktif ? state.materiAktif.judul : "-",
      }),
    });
  } catch (err) {
    console.error("Gagal kirim log ke server guru:", err);
  }
}

/* ---------------- Dashboard Guru ---------------- */
async function loadDashboardGuru() {
  const loadingEl = document.getElementById("guru-loading");
  const errorEl = document.getElementById("guru-error");
  const listEl = document.getElementById("guru-murid-list");
  loadingEl.hidden = false;
  errorEl.hidden = true;
  listEl.innerHTML = "";

  try {
    const res = await fetch(`${state.backendUrl}/api/dashboard-guru`);
    if (!res.ok) throw new Error(`Server merespons error (${res.status})`);
    const data = await res.json();
    loadingEl.hidden = true;

    const kodeList = Object.keys(data.murid || {});
    if (kodeList.length === 0) {
      listEl.innerHTML = `<p class="note-center">Belum ada murid yang terdaftar. Tambahkan murid pertama di atas.</p>`;
      return;
    }

    kodeList
      .sort((a, b) => {
        const na = data.murid[a].nama_panggilan || a;
        const nb = data.murid[b].nama_panggilan || b;
        return na.localeCompare(nb);
      })
      .forEach(kode => {
        const info = data.murid[kode];
        const riwayat = info.riwayat || {};
        const tanggalList = Object.keys(riwayat).sort().reverse();

        const card = document.createElement("div");
        card.className = "card guru-murid-card";

        const header = document.createElement("div");
        header.className = "guru-murid-header guru-murid-header--clickable";
        header.innerHTML = `
          <div class="guru-murid-header-info">
            <strong>${info.nama_panggilan}</strong><span class="guru-kode-badge">${kode}</span>
            <p class="small guru-nama-asli">${info.nama_asli}</p>
          </div>
          <div class="guru-murid-actions">
            <button class="chip-btn" data-action="edit">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M4 20h4l11-11-4-4L4 16v4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14.5 6.5 17.5 9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
            <button class="chip-btn" data-action="hapus">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7h12Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            </button>
            <span class="guru-expand-arrow" data-action="toggle">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </div>
        `;
        card.appendChild(header);

        const editForm = document.createElement("div");
        editForm.className = "guru-edit-form";
        editForm.hidden = true;
        editForm.innerHTML = `
          <input type="text" class="text-input guru-edit-nama-asli" value="${info.nama_asli}" placeholder="Nama Asli" />
          <input type="text" class="text-input guru-edit-nama-panggilan" value="${info.nama_panggilan}" placeholder="Nama Panggilan" />
          <div class="guru-edit-actions">
            <button class="btn btn-primary btn-block guru-edit-simpan">Simpan</button>
            <button class="btn btn-ghost btn-block guru-edit-batal">Batal</button>
          </div>
        `;
        card.appendChild(editForm);

        const riwayatWrap = document.createElement("div");
        riwayatWrap.className = "guru-riwayat-wrap";
        riwayatWrap.hidden = true;

        if (tanggalList.length === 0) {
          const kosong = document.createElement("p");
          kosong.className = "small guru-belum-baca";
          kosong.textContent = "Belum ada riwayat membaca.";
          riwayatWrap.appendChild(kosong);
        } else {
          tanggalList.forEach(tgl => {
            const sesiObj = riwayat[tgl];
            const sesiIds = Object.keys(sesiObj).sort();

            const tglGroup = document.createElement("div");
            tglGroup.className = "guru-tanggal-group";
            tglGroup.innerHTML = `<div class="guru-tanggal-title">📅 ${tgl}</div>`;

            sesiIds.forEach((sid, i) => {
              const d = sesiObj[sid];
              const row = document.createElement("div");
              row.className = "guru-tanggal-row";
              row.innerHTML = `
                <div class="guru-tanggal-head">
                  <span>Sesi ke-${i + 1} · pukul ${d.jam || "?"}</span>
                  ${d.nilai !== null && d.nilai !== undefined ? `<span class="status-badge"><img src="assets/evaluasi-nur.png" class="guru-stat-ico-img" alt="">${d.nilai}/100</span>` : ""}
                </div>
                <div class="guru-tanggal-stats">
                  <span><img src="assets/alarm.png" class="guru-stat-ico-img" alt="">${d.lama_baca_menit} menit</span>
                  <span><img src="assets/petir.png" class="guru-stat-ico-img" alt="">${d.hesitation_count}x jeda</span>
                </div>
                ${d.hesitation_words && d.hesitation_words.length ? `<p class="small guru-kata-jeda"><img src="assets/speaker-tts.png" class="guru-stat-ico-img" alt="">Kata jeda: ${d.hesitation_words.join(", ")}</p>` : ""}
              `;
              tglGroup.appendChild(row);
            });

            riwayatWrap.appendChild(tglGroup);
          });
        }
        card.appendChild(riwayatWrap);

        listEl.appendChild(card);

        function toggleRiwayat() {
          riwayatWrap.hidden = !riwayatWrap.hidden;
          header.classList.toggle("guru-murid-header--open", !riwayatWrap.hidden);
        }

        header.querySelector(".guru-murid-header-info").addEventListener("click", toggleRiwayat);
        header.querySelector('[data-action="toggle"]').addEventListener("click", toggleRiwayat);

        header.querySelector('[data-action="edit"]').addEventListener("click", e => {
          e.stopPropagation();
          editForm.hidden = !editForm.hidden;
        });
        header.querySelector('[data-action="hapus"]').addEventListener("click", e => {
          e.stopPropagation();
          hapusMurid(kode, info.nama_panggilan);
        });
        editForm.querySelector(".guru-edit-simpan").addEventListener("click", () => {
          const namaAsliBaru = editForm.querySelector(".guru-edit-nama-asli").value.trim();
          const namaPanggilanBaru = editForm.querySelector(".guru-edit-nama-panggilan").value.trim();
          if (!namaAsliBaru || !namaPanggilanBaru) return;
          simpanEditMurid(kode, namaAsliBaru, namaPanggilanBaru);
        });
        editForm.querySelector(".guru-edit-batal").addEventListener("click", () => {
          editForm.hidden = true;
        });
      });
  } catch (err) {
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = "Gagal memuat data: " + err.message + ". Pastikan backend server sudah jalan.";
  }
}

/* ---------------- BACA screen ---------------- */
function onEnterBaca() {
  const btnLanjut = document.getElementById("btn-lanjut-membaca");

  if (!state.materiAktif || !state.materiAktif.kartu || state.materiAktif.kartu.length === 0) {
    document.getElementById("baca-judul").textContent = "MATERI BELUM TERSEDIA";
    document.getElementById("baca-kartu-counter").textContent = "";
    document.getElementById("reading-text").innerHTML =
      `<p>Materi belum tersedia. Tunggu gurumu mengunggah dan mengaktifkan materi baru ya.</p>`;
    document.getElementById("reading-diagram").innerHTML = "";
    if (btnLanjut) btnLanjut.hidden = true;
    return;
  }
  if (btnLanjut) btnLanjut.hidden = false;

  if (!state.readStartTime) state.readStartTime = Date.now();
  renderCard();
}

function renderCard() {
  const card = state.materiAktif.kartu[state.cardIndex];
  document.getElementById("baca-judul").textContent = state.materiAktif.judul.toUpperCase();
  document.getElementById("baca-kartu-counter").textContent = `Kartu ${state.cardIndex + 1} dari ${state.materiAktif.kartu.length}`;
  document.getElementById("baca-progress-fill").style.width = `${((state.cardIndex) / state.materiAktif.kartu.length) * 100}%`;

  const textBox = document.getElementById("reading-text");
  renderReadingParagraphs(card.teks, textBox);
  setupFingerTracking(textBox, onWordHesitate);

  const diagramBox = document.getElementById("reading-diagram");
  diagramBox.innerHTML = "";
  (card.diagram || []).forEach((step, i) => {
    if (i > 0) {
      const arrow = document.createElement("span");
      arrow.className = "diagram-arrow";
      arrow.textContent = "→";
      diagramBox.appendChild(arrow);
    }
    const wrap = document.createElement("div");
    wrap.className = "diagram-step";
    const circle = document.createElement("div");
    circle.className = "diagram-emoji" + (step.aksen ? " aksen" : "") + (step.energi ? " energi" : "");
    circle.textContent = step.emoji;
    const label = document.createElement("div");
    label.className = "diagram-label";
    label.textContent = step.label.replace(/\*/g, "");
    wrap.appendChild(circle);
    wrap.appendChild(label);
    diagramBox.appendChild(wrap);
  });

  const isLast = state.cardIndex === state.materiAktif.kartu.length - 1;
  document.getElementById("btn-lanjut-membaca").textContent = isLast ? "Selesai — Ke Evaluasi →" : "Lanjut Membaca →";
  hideHesitationAlert();
  setAdaptiveStatus(true);
}

function setAdaptiveStatus(active) {
  const pill = document.getElementById("baca-status");
  if (active) {
    pill.className = "status-pill status-adaptive";
    pill.textContent = "🟢 Mode Adaptif Aktif";
  } else {
    pill.className = "status-pill status-warning";
    pill.textContent = "🕒 Hesitation Latency Detection";
  }
}

function onWordHesitate(plainText, onPopupDone) {
  state.hesitationCount += 1;
  state.hesitationWords.add(plainText);
  document.getElementById("hesitation-seconds").textContent = ">3";
  document.getElementById("hesitation-alert").hidden = false;
  setAdaptiveStatus(false);

  if (onPopupDone) onPopupDone();

  setTimeout(() => {
    hideHesitationAlert();
    setAdaptiveStatus(true);
    kirimLogBaca();
  }, 1200);
}
function hideHesitationAlert() {
  document.getElementById("hesitation-alert").hidden = true;
}

document.getElementById("btn-lanjut-membaca").addEventListener("click", () => {
  if (!state.materiAktif || !state.materiAktif.kartu) return;
  if (state.cardIndex < state.materiAktif.kartu.length - 1) {
    state.cardIndex += 1;
    renderCard();
  } else {
    state.readMsAccumulated += Date.now() - state.readStartTime;
    state.readStartTime = null;
    document.getElementById("baca-progress-fill").style.width = "100%";
    showScreen("screen-evaluasi");
  }
  updateHomeProgress();
  kirimLogBaca();
});

document.getElementById("btn-baca-progress-toggle").addEventListener("click", () => showScreen("screen-progres"));

function updateHomeProgress() {
  const totalKartu = state.materiAktif && state.materiAktif.kartu ? state.materiAktif.kartu.length : 0;
  const pct = totalKartu > 0 ? Math.round((state.cardIndex / totalKartu) * 100) : 0;
  document.getElementById("home-progress-fill").style.width = pct + "%";
  document.getElementById("home-progress-fill-2").style.width = pct + "%";
  document.getElementById("home-progress-note").textContent =
    pct === 0 ? "Mulai membaca untuk melihat progres pembelajaran." : `Kamu sudah membaca ${pct}% materi ${state.materiAktif.judul}.`;
}

/* ---------------- EVALUASI (Kuis) ---------------- */
function onEnterEvaluasi() {
  state.quizLocked = true;
  if (!state.kuisAktif || state.kuisAktif.length === 0) {
    document.getElementById("quiz-soal-tag").textContent = "BELUM ADA SOAL";
    document.getElementById("quiz-soal-text").innerHTML = `<p>Belum ada soal evaluasi untuk materi ini.</p>`;
    document.getElementById("quiz-options").innerHTML = "";
    document.getElementById("btn-pilih-jawaban-bar").hidden = true;
    document.getElementById("btn-jawab-lanjut").hidden = true;
    return;
  }
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const total = state.kuisAktif.length;
  const q = state.kuisAktif[state.quizIndex];
  document.getElementById("quiz-counter").textContent = `Soal ${state.quizIndex + 1} dari ${total}`;
  document.getElementById("quiz-pct").textContent = Math.round(((state.quizIndex) / total) * 100) + "%";
  document.getElementById("quiz-progress-fill").style.width = `${(state.quizIndex / total) * 100}%`;
  document.getElementById("quiz-soal-tag").textContent = `SOAL ${state.quizIndex + 1}`;

  const soalBox = document.getElementById("quiz-soal-text");
  renderReadingParagraphs([q.soal], soalBox);
  setupFingerTracking(soalBox, onWordHesitate);

  const optionsBox = document.getElementById("quiz-options");
  optionsBox.innerHTML = "";
  setupFingerTracking(optionsBox, onWordHesitate, () => state.quizLocked);
  const letters = ["A", "B", "C", "D"];
  q.opsi.forEach((opsiText, idx) => {
    const row = document.createElement("div");
    row.className = "quiz-option locked";
    row.dataset.idx = idx;

    const letter = document.createElement("span");
    letter.className = "opt-letter";
    letter.textContent = letters[idx];

    const textSpan = document.createElement("span");
    textSpan.className = "opt-text";
    renderInlineTokens(opsiText, textSpan);

    const speakerBtn = document.createElement("span");
    speakerBtn.className = "opt-speaker";
    speakerBtn.textContent = "🔊";
    speakerBtn.addEventListener("click", ev => {
      ev.stopPropagation();
      if (!state.quizLocked) return;
      speak(hyphenForm(opsiText));
    });

    row.appendChild(letter);
    row.appendChild(textSpan);
    row.appendChild(speakerBtn);

    row.addEventListener("click", () => {
      if (state.quizLocked) return;
      selectQuizOption(idx);
    });

    optionsBox.appendChild(row);
  });

  state.quizLocked = true;
  document.getElementById("lock-modal").classList.remove("open");
  document.getElementById("btn-pilih-jawaban-bar").hidden = false;
  document.getElementById("btn-pilih-jawaban-bar").disabled = false;
  document.getElementById("btn-jawab-lanjut").hidden = true;
  document.getElementById("btn-jawab-lanjut").disabled = true;
  state.selectedOption = null;
}

document.getElementById("btn-pilih-jawaban-bar").addEventListener("click", () => {
  const modal = document.getElementById("lock-modal");
  modal.classList.add("open");
  setTimeout(() => modal.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
});
document.getElementById("btn-batal-jawaban").addEventListener("click", () => {
  document.getElementById("lock-modal").classList.remove("open");
});
document.getElementById("btn-buka-jawaban").addEventListener("click", () => {
  state.quizLocked = false;
  document.getElementById("lock-modal").classList.remove("open");
  document.getElementById("btn-pilih-jawaban-bar").hidden = true;
  document.querySelectorAll(".quiz-option").forEach(el => el.classList.remove("locked"));
});

function selectQuizOption(idx) {
  document.querySelectorAll(".quiz-option").forEach(el => el.classList.remove("selected"));
  const el = document.querySelector(`.quiz-option[data-idx="${idx}"]`);
  el.classList.add("selected");
  state.selectedOption = idx;
  const btn = document.getElementById("btn-jawab-lanjut");
  btn.hidden = false;
  btn.disabled = false;
}

document.getElementById("btn-jawab-lanjut").addEventListener("click", () => {
  if (state.selectedOption === null || state.selectedOption === undefined) return;
  const q = state.kuisAktif[state.quizIndex];
  state.quizAnswers[state.quizIndex] = state.selectedOption;

  document.querySelectorAll(".quiz-option").forEach(el => {
    const idx = parseInt(el.dataset.idx, 10);
    if (idx === q.jawaban) el.classList.add("correct");
    else if (idx === state.selectedOption) el.classList.add("incorrect");
  });

  setTimeout(() => {
    if (state.quizIndex < state.kuisAktif.length - 1) {
      state.quizIndex += 1;
      renderQuizQuestion();
    } else {
      document.getElementById("quiz-progress-fill").style.width = "100%";
      document.getElementById("quiz-pct").textContent = "100%";
      state.materiSelesai = true;
      showScreen("screen-progres");
    }
  }, 700);
});

/* ---------------- PROGRES ---------------- */
function onEnterProgres() {
  const judul = state.materiAktif ? state.materiAktif.judul : "Belum Ada Materi";
  document.getElementById("progres-materi-judul").textContent = judul;
  document.getElementById("pencapaian-text").textContent = `Materi ${judul} Selesai`;

  const totalCards = state.materiAktif && state.materiAktif.kartu ? state.materiAktif.kartu.length : 0;
  const cardPct = totalCards > 0 ? Math.round((state.cardIndex / totalCards) * 100) : 0;
  const belajarPct = state.materiSelesai ? 100 : cardPct;
  document.getElementById("progres-belajar-fill").style.width = belajarPct + "%";
  document.getElementById("progres-belajar-pct").textContent = belajarPct + "%";

  let readMs = state.readMsAccumulated;
  if (state.readStartTime) readMs += Date.now() - state.readStartTime;
  document.getElementById("stat-lama-membaca").textContent = Math.max(1, Math.round(readMs / 60000)) || 0;
  document.getElementById("stat-hesitation").textContent = state.hesitationCount;

  const wordsBox = document.getElementById("stat-tts-words");
  wordsBox.innerHTML = "";
  if (state.hesitationWords.size === 0) {
    wordsBox.innerHTML = `<li class="small muted">Belum ada</li>`;
  } else {
    [...state.hesitationWords].slice(0, 5).forEach(w => {
      const li = document.createElement("li");
      li.textContent = w;
      wordsBox.appendChild(li);
    });
  }

  const totalSoal = state.kuisAktif.length;
  const answered = state.quizAnswers.filter(a => a !== undefined).length;
  const feedbackTitle = document.getElementById("ai-feedback-title");
  const feedbackText = document.getElementById("ai-feedback-text");
  const pencapaianCard = document.getElementById("pencapaian-card");

  if (totalSoal > 0 && answered === totalSoal) {
    const correct = state.kuisAktif.reduce((acc, q, i) => acc + (state.quizAnswers[i] === q.jawaban ? 1 : 0), 0);
    const nilai = Math.round((correct / totalSoal) * 100);
    document.getElementById("stat-nilai").textContent = nilai;
    const statusEl = document.getElementById("stat-status");
    let statusLabel = "Perlu Latihan";
    if (nilai >= 80) { statusLabel = "✅ Excellent"; }
    else if (nilai >= 60) { statusLabel = "👍 Baik"; }
    else { statusLabel = "💪 Perlu Latihan"; }
    statusEl.textContent = statusLabel;

    pencapaianCard.hidden = nilai < 60;
    feedbackTitle.textContent = "Hebat!";
    feedbackText.textContent = `Kamu berhasil menyelesaikan materi ${judul} dengan nilai ${nilai}/100. Tetap pertahankan ritme membacamu ya!`;
  } else {
    document.getElementById("stat-nilai").textContent = "-";
    document.getElementById("stat-status").textContent = "Belum dikerjakan";
    pencapaianCard.hidden = true;
    feedbackTitle.textContent = "Ayo mulai belajar!";
    feedbackText.textContent = `Buka menu Baca untuk mulai membaca materi ${judul}, lalu kerjakan Evaluasi.`;
  }

  kirimLogBaca();
}

/* ---------------- Init ---------------- */
applyFontScale();
buildBottomNav("screen-home");
muatMateriAktif();
runSplash();
