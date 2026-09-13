/* =========================================================
   NEUROBIO-AI — Contoh data materi "Metabolisme"
   Kata yang diapit *tanda bintang* = istilah ilmiah sulit
   (disorot kuning, bisa disentuh untuk TTS instan).
   Tanda hubung (-) menandai pemisahan suku kata.
   Ganti isi array ini kapan pun untuk materi lain.
   ========================================================= */

const MATERI = {
  judul: "Metabolisme",
  subjudul: "Respirasi Aerob",
  totalKartu: 5,
  kartu: [
    {
      id: 1,
      judulKartu: "Glikolisis",
      teks: [
        "Ta-hap per-ta-ma da-lam res-pi-ra-si *a-e-rob* a-da-lah *Gli-ko-li-sis*.",
        "Pro-ses i-ni me-ngu-bah *glu-ko-sa* men-ja-di *A-sam Pi-ru-vat*."
      ],
      diagram: [
        { label: "Glu-ko-sa", emoji: "🔷" },
        { label: "Gli-ko-li-sis", emoji: "⚙️", aksen: true },
        { label: "A-sam Pi-ru-vat", emoji: "💧" },
        { label: "2 ATP", emoji: "⚡", energi: true }
      ]
    },
    {
      id: 2,
      judulKartu: "Dekarboksilasi Oksidatif",
      teks: [
        "Ta-hap se-lan-jut-nya a-da-lah *De-kar-bok-si-la-si Ok-si-da-tif*.",
        "*A-sam Pi-ru-vat* di-u-bah men-ja-di *A-se-til Ko-A* di da-lam *mi-to-kon-dri-a*."
      ],
      diagram: [
        { label: "A-sam Pi-ru-vat", emoji: "💧" },
        { label: "De-kar-bok-si-la-si", emoji: "⚙️", aksen: true },
        { label: "A-se-til Ko-A", emoji: "🔶" },
        { label: "CO2", emoji: "💨", energi: true }
      ]
    },
    {
      id: 3,
      judulKartu: "Siklus Krebs",
      teks: [
        "Se-lan-jut-nya, *A-se-til Ko-A* ma-suk ke da-lam *Sik-lus Krebs*.",
        "Sik-lus i-ni meng-ha-sil-kan e-ner-gi da-lam ben-tuk *NA-DH* dan *FA-DH2*."
      ],
      diagram: [
        { label: "A-se-til Ko-A", emoji: "🔶" },
        { label: "Sik-lus Krebs", emoji: "🔄", aksen: true },
        { label: "NA-DH / FA-DH2", emoji: "🔋" },
        { label: "CO2", emoji: "💨", energi: true }
      ]
    },
    {
      id: 4,
      judulKartu: "Transpor Elektron",
      teks: [
        "Ta-hap ter-a-khir a-da-lah *Trans-por E-lek-tron*.",
        "*NA-DH* dan *FA-DH2* di-gu-na-kan un-tuk meng-ha-sil-kan e-ner-gi da-lam jum-lah be-sar."
      ],
      diagram: [
        { label: "NA-DH / FA-DH2", emoji: "🔋" },
        { label: "Trans-por E-lek-tron", emoji: "⚡", aksen: true },
        { label: "*34 ATP*", emoji: "🔆" },
        { label: "H2O", emoji: "💦", energi: true }
      ]
    },
    {
      id: 5,
      judulKartu: "Ringkasan",
      teks: [
        "Se-ca-ra ke-se-lu-ru-han, res-pi-ra-si *a-e-rob* meng-ha-sil-kan se-ki-tar *36 sam-pai 38 ATP*.",
        "Se-la-mat! Ka-mu te-lah me-nye-le-sai-kan ma-te-ri Me-ta-bo-lis-me."
      ],
      diagram: [
        { label: "Glu-ko-sa", emoji: "🔷" },
        { label: "Res-pi-ra-si Ae-rob", emoji: "🧬", aksen: true },
        { label: "36-38 ATP", emoji: "⚡", energi: true }
      ]
    }
  ]
};

const KUIS = [
  {
    soal: "Pro-ses pem-ben-tuk-an *A-sam Pi-ru-vat* ter-ja-di pa-da....",
    opsi: ["*Gli-ko-li-sis*", "*Sik-lus Krebs*", "*Trans-por E-lek-tron*", "*Fer-men-ta-si*"],
    jawaban: 0
  },
  {
    soal: "*De-kar-bok-si-la-si Ok-si-da-tif* meng-u-bah a-sam pi-ru-vat men-ja-di....",
    opsi: ["*A-se-til Ko-A*", "*Glu-ko-sa*", "*A-de-no-sin Tri-fos-fat*", "*Kar-bon di-ok-si-da*"],
    jawaban: 0
  },
  {
    soal: "*Sik-lus Krebs* ter-ja-di di da-lam....",
    opsi: ["*Mi-to-kon-dri-a*", "*Si-to-plas-ma*", "*Nu-kle-us*", "*Ri-bo-som*"],
    jawaban: 0
  },
  {
    soal: "Ha-sil u-ta-ma da-ri ta-hap *Trans-por E-lek-tron* a-da-lah....",
    opsi: ["*A-de-no-sin Tri-fos-fat* da-lam jum-lah be-sar", "*Glu-ko-sa*", "*A-sam Pi-ru-vat*", "*Kar-bon di-ok-si-da*"],
    jawaban: 0
  },
  {
    soal: "To-tal e-ner-gi *A-de-no-sin Tri-fos-fat* da-ri sa-tu mo-le-kul glu-ko-sa se-ki-tar....",
    opsi: ["*36 sam-pai 38 ATP*", "*2 ATP*", "*100 ATP*", "*10 ATP*"],
    jawaban: 0
  }
];