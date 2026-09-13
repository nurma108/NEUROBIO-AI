import os
import json
import re
import random
import time
import uuid
import threading
import concurrent.futures
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai

# ---------- Setup ----------
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = genai.GenerativeModel("gemini-3.6-flash")

HARI_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

MURID_FILE = Path(__file__).parent / "daftar_murid.json"
murid_lock = threading.Lock()


def load_murid():
    if MURID_FILE.exists():
        try:
            data = json.loads(MURID_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception:
            return {}
    return {}


def save_murid(data):
    MURID_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def buat_kode_unik(nama_panggilan: str, existing: dict) -> str:
    base = re.sub(r"[^a-z0-9]", "", nama_panggilan.strip().lower())
    if not base:
        base = "murid"
    if base not in existing:
        return base
    i = 2
    while f"{base}{i}" in existing:
        i += 1
    return f"{base}{i}"


class TambahMuridRequest(BaseModel):
    nama_asli: str
    nama_panggilan: str


class EditMuridRequest(BaseModel):
    nama_asli: str
    nama_panggilan: str


class CekKodeRequest(BaseModel):
    kode: str


@app.post("/api/murid")
def tambah_murid(req: TambahMuridRequest):
    nama_asli = req.nama_asli.strip()
    nama_panggilan = req.nama_panggilan.strip()
    if not nama_asli or not nama_panggilan:
        return {"error": "Nama asli dan nama panggilan wajib diisi."}

    with murid_lock:
        data = load_murid()
        kode = buat_kode_unik(nama_panggilan, data)
        data[kode] = {"nama_asli": nama_asli, "nama_panggilan": nama_panggilan}
        save_murid(data)

    return {"status": "ok", "kode": kode}


@app.put("/api/murid/{kode}")
def edit_murid(kode: str, req: EditMuridRequest):
    with murid_lock:
        data = load_murid()
        if kode not in data:
            return {"error": "Murid dengan kode ini tidak ditemukan."}
        data[kode]["nama_asli"] = req.nama_asli.strip()
        data[kode]["nama_panggilan"] = req.nama_panggilan.strip()
        save_murid(data)
    return {"status": "ok"}


@app.delete("/api/murid/{kode}")
def hapus_murid(kode: str):
    with murid_lock:
        data = load_murid()
        if kode in data:
            del data[kode]
            save_murid(data)

    with log_lock:
        logs = load_logs()
        if kode in logs:
            del logs[kode]
            save_logs(logs)

    return {"status": "ok"}


@app.post("/api/cek-kode")
def cek_kode(req: CekKodeRequest):
    kode = req.kode.strip().lower()
    with murid_lock:
        data = load_murid()
    return {"valid": kode in data}


LOG_FILE = Path(__file__).parent / "logs_baca.json"
log_lock = threading.Lock()


def load_logs():
    if LOG_FILE.exists():
        try:
            return json.loads(LOG_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_logs(data):
    LOG_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


class LogBacaRequest(BaseModel):
    nama: str
    tanggal: str
    sesi_id: str
    jam: str
    lama_baca_menit: int = 0
    hesitation_count: int = 0
    hesitation_words: List[str] = []
    nilai: Optional[int] = None
    status_evaluasi: Optional[str] = None
    materi: Optional[str] = None


@app.post("/api/log-baca")
def log_baca(req: LogBacaRequest):
    kode = req.nama.strip().lower()
    if not kode:
        return {"error": "Kode murid tidak boleh kosong."}

    payload = {
        "jam": req.jam,
        "lama_baca_menit": req.lama_baca_menit,
        "hesitation_count": req.hesitation_count,
        "hesitation_words": req.hesitation_words,
        "nilai": req.nilai,
        "status_evaluasi": req.status_evaluasi,
        "materi": req.materi,
    }

    with log_lock:
        data = load_logs()
        data.setdefault(kode, {})
        data[kode].setdefault(req.tanggal, {})
        data[kode][req.tanggal][req.sesi_id] = payload
        save_logs(data)

    return {"status": "ok"}


@app.get("/api/dashboard-guru")
def dashboard_guru():
    with murid_lock:
        murid_data = load_murid()
    with log_lock:
        logs = load_logs()

    hasil = {}
    for kode, info in murid_data.items():
        hasil[kode] = {
            "nama_asli": info.get("nama_asli", ""),
            "nama_panggilan": info.get("nama_panggilan", ""),
            "riwayat": logs.get(kode, {}),
        }

    return {"murid": hasil}


MATERI_FILE = Path(__file__).parent / "daftar_materi.json"
MATERI_AKTIF_FILE = Path(__file__).parent / "materi_aktif.json"
materi_lock = threading.Lock()


def load_materi():
    if MATERI_FILE.exists():
        try:
            data = json.loads(MATERI_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception:
            return {}
    return {}


def save_materi(data):
    MATERI_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_materi_aktif_id():
    if MATERI_AKTIF_FILE.exists():
        try:
            return json.loads(MATERI_AKTIF_FILE.read_text(encoding="utf-8")).get("id")
        except Exception:
            return None
    return None


def save_materi_aktif_id(materi_id):
    MATERI_AKTIF_FILE.write_text(json.dumps({"id": materi_id}, ensure_ascii=False), encoding="utf-8")


@app.get("/api/daftar-materi")
def daftar_materi():
    with materi_lock:
        data = load_materi()
    aktif_id = load_materi_aktif_id()

    ringkasan = {}
    for materi_id, m in data.items():
        ringkasan[materi_id] = {
            "judul": m.get("judul", "Materi"),
            "tanggal_upload": m.get("tanggal_upload", ""),
            "jumlah_kartu": len(m.get("kartu", [])),
            "jumlah_kuis": len(m.get("kuis", [])),
            "sumber": m.get("sumber", "guru"),
            "aktif": materi_id == aktif_id,
        }
    return {"materi": ringkasan}


@app.post("/api/materi-aktif/{materi_id}")
def set_materi_aktif(materi_id: str):
    with materi_lock:
        data = load_materi()
        if materi_id not in data:
            return {"error": "Materi tidak ditemukan."}
    save_materi_aktif_id(materi_id)
    return {"status": "ok"}


@app.get("/api/materi-aktif")
def get_materi_aktif():
    aktif_id = load_materi_aktif_id()
    if not aktif_id:
        return {"error": "Materi belum tersedia, tunggu guru upload."}
    with materi_lock:
        data = load_materi()
    materi = data.get(aktif_id)
    if not materi:
        return {"error": "Materi belum tersedia, tunggu guru upload."}
    return {"materi": materi}


# =====================================================================
# GENERATE ULANG KUIS SAJA untuk materi yang sudah ada (kartu tidak
# disentuh) — dipakai kalau kuis gagal ke-generate waktu upload pertama
# (misal karena rate limit) supaya guru tidak perlu upload PDF ulang.
# =====================================================================
@app.post("/api/materi/{materi_id}/generate-ulang-kuis")
def generate_ulang_kuis(materi_id: str):
    with materi_lock:
        data = load_materi()
        materi = data.get(materi_id)
    if not materi:
        return {"error": "Materi tidak ditemukan."}

    kartu = materi.get("kartu", [])
    materi_teks_gabungan = "\n".join(
        " ".join(k.get("teks", [])) for k in kartu[:-1]  # kecuali kartu "Ringkasan" penutup
    )
    if not materi_teks_gabungan:
        return {"error": "Materi ini tidak punya teks kartu untuk dijadikan bahan kuis."}

    kuis_list = call_gemini_for_kuis(materi_teks_gabungan, materi.get("judul", "Materi"))
    if not kuis_list:
        return {"error": "AI masih gagal membuat kuis untuk materi ini. Coba lagi sebentar lagi (kemungkinan rate limit API)."}

    with materi_lock:
        data = load_materi()
        if materi_id in data:
            data[materi_id]["kuis"] = kuis_list
            save_materi(data)

    return {"status": "ok", "jumlah_kuis": len(kuis_list)}


@app.delete("/api/materi/{materi_id}")
def hapus_materi(materi_id: str):
    with materi_lock:
        data = load_materi()
        if materi_id in data:
            del data[materi_id]
            save_materi(data)

    if load_materi_aktif_id() == materi_id:
        save_materi_aktif_id(None)

    return {"status": "ok"}


class SimplifyRequest(BaseModel):
    text: str
    judul: str = "Materi Baru"
    sumber: str = "siswa"


@app.get("/")
def home():
    return {"status": "Server NEUROBIO-AI jalan!"}


CHUNK_SIZE = 18000


def split_into_chunks(text, chunk_size=CHUNK_SIZE):
    text = text.strip()
    chunks = []
    start = 0
    total = len(text)

    while start < total:
        end = min(start + chunk_size, total)

        if end < total:
            cut = text.rfind("\n\n", start, end)
            if cut == -1 or cut <= start:
                cut = text.rfind(". ", start, end)
            if cut == -1 or cut <= start:
                cut = text.rfind(" ", start, end)
            if cut == -1 or cut <= start:
                cut = end
            else:
                cut += 1
        else:
            cut = end

        chunk = text[start:cut].strip()
        if chunk:
            chunks.append(chunk)
        start = cut

    return chunks


PROMPT_TEMPLATE = """Kamu adalah AI pengolah materi Biologi untuk siswa disleksia bernama NEUROBIO-AI.

KONTEKS: Teks materi ini sangat panjang, sehingga sudah dipecah menjadi beberapa BAGIAN.
Kamu sedang memproses BAGIAN {bagian_ke} dari total {total_bagian} bagian.
Perlakukan bagian ini sebagai potongan materi yang berdiri sendiri — proses SEMUA isinya
menjadi kartu. Jangan menunggu atau mengacu ke bagian lain yang belum kamu lihat.

TUGAS:
Ubah teks materi Biologi berikut menjadi kartu-kartu pembelajaran mikro (1 kartu = 1 konsep utama),
dengan format khusus untuk siswa disleksia.

BATASAN TOPIK (SANGAT PENTING, WAJIB DIPATUHI):
Fokus proyek ini HANYA pada topik METABOLISME, BUKAN Enzim. Teks sumber yang diberikan
mungkin berasal dari bab buku yang berjudul "Enzim dan Metabolisme" (bab gabungan), tapi kamu
HANYA boleh membuat kartu untuk bagian yang membahas Metabolisme, yaitu: anabolisme dan
katabolisme, respirasi seluler (respirasi aerob: glikolisis, dekarboksilasi oksidatif, siklus
Krebs, transpor elektron; respirasi anaerob/fermentasi alkohol dan asam laktat), fotosintesis
(reaksi terang, reaksi gelap), fotorespirasi, tumbuhan C3/C4/CAM, dan kemosintesis.
JANGAN membuat kartu tersendiri untuk bagian yang murni membahas ENZIM sebagai topik utama.
Kalau istilah "enzim" disebut sekilas di dalam penjelasan proses metabolisme, itu BOLEH tetap
disebut sebagai bagian dari kalimat penjelasan metabolisme — tapi jangan dijadikan kartu
terpisah yang topik utamanya tentang enzim itu sendiri.

ATURAN CAKUPAN MATERI (WAJIB):
- JANGAN meringkas atau melewatkan bagian manapun dari teks PENJELASAN/NARASI di bawah.
- ABAIKAN sepenuhnya bagian "AKTIVITAS", "UJI KOMPETENSI", "REFLEKSI", "PENGAYAAN", daftar
  "Tujuan Pembelajaran", "Kata Kunci", dan "Peta Materi" di awal bab.
- Setiap sub-topik/konsep utama WAJIB punya minimal 1 kartu tersendiri.
- PATOKAN JUMLAH KARTU: minimal {estimasi_min} kartu dari teks penjelasan/narasi bagian ini.
- JANGAN membuat kartu rekap/ringkasan di bagian ini.
- Setiap istilah ilmiah Biologi yang muncul harus ditandai bintang secara konsisten.

ATURAN FORMAT TEKS (WAJIB DIIKUTI PERSIS):
1. Setiap kalimat HARUS dipecah jadi kalimat aktif yang pendek dan sederhana.
2. SETIAP KATA harus dipisah suku katanya dengan tanda hubung (-).
   Contoh: "Proses ini disebut respirasi aerob" menjadi
   "Pro-ses i-ni di-se-but res-pi-ra-si a-e-rob"
3. HANYA istilah ilmiah/teknis Biologi yang boleh diapit tanda bintang (*).
   JANGAN menandai kata-kata umum sehari-hari meskipun terlihat panjang.
4. Satu kartu berisi maksimal 2-3 kalimat pendek dalam array "teks".
5. Field "diagram" berisi 3-5 langkah alur konsep kartu itu (boleh dikosongkan jadi []).
   Tiap step diagram: {{"label": "...", "emoji": "🔷"}} (opsional "aksen": true / "energi": true).

FORMAT OUTPUT (WAJIB JSON VALID, TANPA TEKS LAIN, TANPA MARKDOWN CODE FENCE):
{{
  "kartu": [
    {{
      "judulKartu": "Nama Konsep",
      "teks": ["kalimat 1 dengan suku kata terpisah", "kalimat 2"],
      "diagram": [
        {{"label": "La-bel", "emoji": "🔷"}},
        {{"label": "La-bel-nya", "emoji": "⚙️", "aksen": true}}
      ]
    }}
  ]
}}

Jumlah kartu MENGIKUTI banyaknya konsep utama yang benar-benar ada di teks bagian ini.

JUDUL MATERI: {judul}

TEKS BAGIAN {bagian_ke} DARI {total_bagian}:
{teks}
"""


def call_gemini_for_chunk(chunk_text, judul, idx, total):
    estimasi_min = max(3, len(chunk_text) // 800)

    prompt = PROMPT_TEMPLATE.format(
        judul=judul,
        teks=chunk_text,
        bagian_ke=idx,
        total_bagian=total,
        estimasi_min=estimasi_min,
    )
    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()
    except Exception as e:
        print(f"[KARTU] Gagal memanggil Gemini untuk bagian {idx}/{total} materi '{judul}': {e}")
        return []

    raw = re.sub(r"^```(json)?", "", raw).strip()
    raw = re.sub(r"```$", "", raw).strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[KARTU] Gagal parse JSON bagian {idx}/{total} materi '{judul}': {e}")
        return []

    kartu_list = data.get("kartu", [])
    for kartu in kartu_list:
        kartu.setdefault("diagram", [])
    return kartu_list


KUIS_PROMPT_TEMPLATE = """Kamu adalah AI pembuat soal evaluasi Biologi untuk siswa disleksia bernama NEUROBIO-AI.

Di bawah ini adalah RINGKASAN KARTU BACAAN (sudah dalam format suku kata dengan tanda hubung
dan istilah ilmiah diapit bintang) yang sudah dipelajari murid untuk materi "{judul}".

TUGAS:
Buat TEPAT 5 soal evaluasi pilihan ganda (4 opsi jawaban tiap soal) berdasarkan isi kartu
bacaan tersebut. Soal harus menguji pemahaman konsep utama yang ada di kartu, bukan detail
sepele.

ATURAN FORMAT (WAJIB DIIKUTI PERSIS, sama seperti gaya kartu bacaan):
1. Setiap kata pada teks soal dan opsi jawaban HARUS dipisah suku katanya dengan tanda
   hubung (-), contoh: "Proses ini disebut" menjadi "Pro-ses i-ni di-se-but".
2. HANYA istilah ilmiah/teknis Biologi yang boleh diapit tanda bintang (*), sama seperti
   penandaan istilah di kartu bacaan.
3. Tepat 4 opsi jawaban per soal, dan HANYA SATU yang benar.
4. "jawaban" adalah angka index (0, 1, 2, atau 3) dari opsi yang benar — WAJIB berupa
   angka JSON asli (0, bukan "0" dengan tanda kutip).
5. Variasikan posisi jawaban benar antar soal (jangan selalu index 0).

FORMAT OUTPUT (WAJIB JSON VALID, TANPA TEKS LAIN DI LUAR JSON, TANPA MARKDOWN CODE FENCE):
{{
  "kuis": [
    {{
      "soal": "Per-ta-nya-an de-ngan *is-ti-lah* di-so-rot....",
      "opsi": ["*Ja-wa-ban A*", "Ja-wa-ban B", "Ja-wa-ban C", "Ja-wa-ban D"],
      "jawaban": 0
    }}
  ]
}}

RINGKASAN KARTU BACAAN MATERI "{judul}":
{teks}
"""


def call_gemini_for_kuis(materi_teks: str, judul: str):
    """Buat 5 soal evaluasi dari gabungan teks kartu SATU materi ini saja.
    Kembalikan [] kalau gagal, dan print alasan kegagalan ke terminal."""
    prompt = KUIS_PROMPT_TEMPLATE.format(judul=judul, teks=materi_teks[:14000])
    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()
    except Exception as e:
        print(f"[KUIS] Gagal memanggil Gemini untuk materi '{judul}': {e}")
        return []

    raw = re.sub(r"^```(json)?", "", raw).strip()
    raw = re.sub(r"```$", "", raw).strip()

    if not raw.startswith("{"):
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            raw = raw[start:end + 1]

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[KUIS] Gagal parse JSON untuk materi '{judul}': {e}\nRaw response:\n{raw[:2000]}")
        return []

    kuis_list = data.get("kuis", [])
    hasil = []
    for i, q in enumerate(kuis_list):
        soal = q.get("soal")
        opsi = q.get("opsi")
        jawaban = q.get("jawaban")

        if isinstance(jawaban, str) and jawaban.strip().isdigit():
            jawaban = int(jawaban.strip())

        if not (isinstance(soal, str) and soal.strip()):
            print(f"[KUIS] Materi '{judul}' — soal ke-{i} dilewati: field 'soal' tidak valid -> {q}")
            continue
        if not (isinstance(opsi, list) and len(opsi) == 4 and all(isinstance(o, str) for o in opsi)):
            print(f"[KUIS] Materi '{judul}' — soal ke-{i} dilewati: field 'opsi' tidak valid -> {q}")
            continue
        if not (isinstance(jawaban, int) and 0 <= jawaban <= 3):
            print(f"[KUIS] Materi '{judul}' — soal ke-{i} dilewati: field 'jawaban' tidak valid -> {q}")
            continue

        hasil.append({"soal": soal, "opsi": opsi, "jawaban": jawaban})

    if not hasil:
        print(f"[KUIS] Materi '{judul}': 0 soal lolos validasi dari {len(kuis_list)} soal mentah yang dikembalikan AI.")

    return hasil


@app.post("/api/simplify")
def simplify(req: SimplifyRequest):
    chunks = split_into_chunks(req.text)
    total_chunks = len(chunks)

    MAX_WORKERS = 3
    results_by_index = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_index = {
            executor.submit(call_gemini_for_chunk, chunk, req.judul, i + 1, total_chunks): i
            for i, chunk in enumerate(chunks)
        }
        for future in concurrent.futures.as_completed(future_to_index):
            idx = future_to_index[future]
            try:
                results_by_index[idx] = future.result()
            except Exception:
                results_by_index[idx] = []

    all_kartu = []
    for i in range(total_chunks):
        all_kartu.extend(results_by_index.get(i, []))

    if not all_kartu:
        return {"error": "AI tidak berhasil menghasilkan kartu dari materi ini. Coba lagi."}

    for idx, kartu in enumerate(all_kartu, start=1):
        kartu["id"] = idx

    all_kartu.append({
        "id": len(all_kartu) + 1,
        "judulKartu": "Ringkasan",
        "teks": [
            "Se-la-mat! Ka-mu te-lah me-nye-le-sai-kan se-lu-ruh ma-te-ri i-ni.",
            "Si-lah-kan lan-jut ke se-si e-va-lu-a-si un-tuk meng-u-ji pe-ma-ha-man-mu."
        ],
        "diagram": []
    })

    materi_teks_gabungan = "\n".join(
        " ".join(kartu.get("teks", [])) for kartu in all_kartu[:-1]
    )

    kuis_list = call_gemini_for_kuis(materi_teks_gabungan, req.judul) if materi_teks_gabungan else []

    # RETRY dengan jeda: kalau percobaan pertama gagal (sering karena rate limit
    # API kalau materi kedua/ketiga di-upload cepat setelah yang sebelumnya),
    # tunggu beberapa detik dulu supaya kuota API sempat "reset" sebelum coba lagi.
    if not kuis_list and materi_teks_gabungan:
        print(f"[KUIS] Percobaan pertama gagal untuk materi '{req.judul}'. Menunggu 8 detik sebelum retry (kemungkinan rate limit)…")
        time.sleep(8)
        kuis_list = call_gemini_for_kuis(materi_teks_gabungan, req.judul)
        if not kuis_list:
            print(f"[KUIS] Percobaan kedua juga gagal untuk materi '{req.judul}'. Menunggu 15 detik sebelum retry terakhir…")
            time.sleep(15)
            kuis_list = call_gemini_for_kuis(materi_teks_gabungan, req.judul)

    sumber = req.sumber if req.sumber in ("guru", "siswa") else "siswa"
    materi_id = uuid.uuid4().hex[:12]
    materi_entry = {
        "id": materi_id,
        "judul": req.judul,
        "tanggal_upload": datetime.now().isoformat(),
        "kartu": all_kartu,
        "kuis": kuis_list,
        "sumber": sumber,
    }
    with materi_lock:
        data = load_materi()
        data[materi_id] = materi_entry
        save_materi(data)

    if sumber == "guru":
        save_materi_aktif_id(materi_id)

    return {
        "id": materi_id,
        "judul": req.judul,
        "kartu": all_kartu,
        "kuis": kuis_list,
        "sumber": sumber,
        "auto_aktif": sumber == "guru",
    }