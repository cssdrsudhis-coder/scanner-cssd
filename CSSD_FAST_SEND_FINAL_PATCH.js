/* =========================================================
   CSSD DIGITAL SYSTEM — FAST SEND FINAL PATCH
   =========================================================
   Tujuan:
   - Notifikasi sukses muncul segera setelah response server diterima.
   - Tidak menunggu perbaruiStatusAntrian().
   - Tidak mengubah sistem offline/IndexedDB.
   - Tetap mengirim clientId untuk Anti-Duplikasi V2.
   - Mengambil alih listener tombol KIRIM lama dengan capture phase.
   ========================================================= */

(function () {
  "use strict";

  const btn = document.getElementById("btnKirim");
  if (!btn) {
    console.error("FAST PATCH: btnKirim tidak ditemukan.");
    return;
  }

  const $ = id => document.getElementById(id);

  function buatClientId() {
    if (window.crypto && crypto.randomUUID) {
      return "CSSD-" + crypto.randomUUID();
    }

    return "CSSD-" +
      Date.now() + "-" +
      Math.random().toString(36).slice(2) +
      "-" +
      Math.random().toString(36).slice(2);
  }

  async function kirimCepat(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (window.sedangMengirim === true) return;

    const petugas = $("petugas")?.value || "";
    const transaksi = $("transaksi")?.value || "BARANG MASUK";
    const jumlah = Number($("jumlah")?.value || 0);
    const ruangan = $("ruangan")?.value || "";
    const lengkap = $("lengkap")?.value || "";
    const keterangan = ($("keterangan")?.value || "").trim();

    /*
      Sistem terbaru menggunakan qrHasil.
      Jika versi HTML memiliki namaBarang manual, gunakan itu.
    */
    const namaBarang =
      ($("namaBarang")?.value || "").trim() ||
      (window.qrHasil || "").trim();

    if (!namaBarang) {
      if (typeof window.tampilNotifikasi === "function") {
        window.tampilNotifikasi(
          "❌ NAMA BARANG / QR BELUM ADA.",
          "gagal"
        );
      } else {
        alert("Nama barang / QR belum ada.");
      }
      return;
    }

    if (!petugas) {
      window.tampilNotifikasi?.("❌ SILAKAN PILIH PETUGAS.", "gagal");
      return;
    }

    if (!ruangan) {
      window.tampilNotifikasi?.("❌ SILAKAN PILIH RUANGAN.", "gagal");
      return;
    }

    if (!jumlah || jumlah < 1) {
      window.tampilNotifikasi?.("❌ JUMLAH MINIMAL 1.", "gagal");
      return;
    }

    if (lengkap !== "YA" && lengkap !== "TIDAK") {
      window.tampilNotifikasi?.(
        "❌ SILAKAN PILIH LENGKAP / TIDAK LENGKAP.",
        "gagal"
      );
      return;
    }

    window.sedangMengirim = true;
    btn.disabled = true;

    window.tampilNotifikasi?.(
      "⏳ SEDANG MENGIRIM DATA...",
      "info"
    );

    const payload = {
      action: "simpanTransaksi",
      transaksi,
      petugas,
      namaBarang,
      jumlah: String(jumlah),
      ruangan,
      lengkap,
      keterangan,

      /*
        Sangat penting untuk Anti-Duplikasi V2.
        ID dibuat sekali untuk transaksi ini.
      */
      clientId: buatClientId()
    };

    try {
      /*
        Jika offline, simpan ke IndexedDB dan LANGSUNG beri
        notifikasi. Jangan menunggu perbaruiStatusAntrian().
      */
      if (!navigator.onLine) {
        if (typeof window.simpanAntrianOffline !== "function") {
          throw new Error(
            "Fungsi penyimpanan offline tidak tersedia."
          );
        }

        const offlineId =
          await window.simpanAntrianOffline(payload);

        window.tampilNotifikasi?.(
          "🟠 DATA TERSIMPAN DI HP\n\n" +
          "Internet tidak tersedia.\n" +
          "Data akan dikirim otomatis saat koneksi kembali.\n\n" +
          "ID Offline: " + offlineId,
          "info"
        );

        $("status") &&
          ($("status").innerText =
            "🟠 OFFLINE — DATA TERSIMPAN DI HP");

        if (typeof window.resetFormSetelahKirim === "function") {
          window.resetFormSetelahKirim();
        }

        window.sedangMengirim = false;
        btn.disabled = true;

        setTimeout(async function () {
          window.hapusNotifikasi?.();

          if ($("status")) {
            $("status").innerText =
              "📷 Menyiapkan scan berikutnya...";
          }

          await window.mulaiScanner?.();
        }, 1000);

        return;
      }

      /*
        ONLINE:
        Tunggu HANYA response penyimpanan server.
        Setelah response diterima, notifikasi langsung tampil.
        Tidak ada await IndexedDB/dashboard/status antrean di sini.
      */
      const result =
        await window.kirimPayloadKeServer(payload);

      if (!result || !result.berhasil) {
        throw new Error(
          result?.pesan || "Data gagal disimpan."
        );
      }

      const nomor = result.nomor || "-";
      const sheet = result.sheet || transaksi;

      window.tampilNotifikasi?.(
        "🎉 BARANG TERKIRIM!\n\n" +
        "Data berhasil masuk ke Google Sheet.\n\n" +
        "Nomor: " + nomor +
        "\nJenis: " + transaksi +
        "\nPetugas: " + petugas +
        "\nRuangan: " + ruangan +
        "\nJumlah: " + jumlah +
        "\nKondisi: " +
          (lengkap === "YA"
            ? "LENGKAP"
            : "TIDAK LENGKAP") +
        "\nSheet: " + sheet,
        "sukses"
      );

      if ($("status")) {
        $("status").innerText =
          "✅ BARANG TERKIRIM — DATA BERHASIL DISIMPAN";
      }

      if ($("pesanDetail")) {
        $("pesanDetail").innerText =
          "Data berhasil disimpan. Silakan lanjut scan berikutnya.";
      }

      /*
        Reset form setelah notifikasi tampil.
        TIDAK menunggu status antrean.
      */
      if (typeof window.resetFormSetelahKirim === "function") {
        window.resetFormSetelahKirim();
      }

      window.sedangMengirim = false;

      /*
        Pembersihan notifikasi dan scanner dilakukan belakangan.
        Ini tidak menghambat munculnya notifikasi.
      */
      setTimeout(async function () {
        window.hapusNotifikasi?.();

        if ($("status")) {
          $("status").innerText =
            "📷 Menyiapkan scan berikutnya...";
        }

        await window.mulaiScanner?.();

        /*
          Update indikator antrean di background.
          Sengaja TANPA await di jalur utama.
        */
        if (
          navigator.onLine &&
          typeof window.perbaruiStatusAntrian === "function"
        ) {
          window.perbaruiStatusAntrian()
            .catch(err =>
              console.warn(
                "Update antrean background:",
                err
              )
            );
        }
      }, 1000);

    } catch (error) {
      console.error("FAST SEND:", error);

      window.sedangMengirim = false;
      btn.disabled = false;

      window.tampilNotifikasi?.(
        "❌ GAGAL MENGIRIM DATA\n\n" +
        error.message +
        "\n\nData belum tersimpan.",
        "gagal"
      );

      if ($("status")) {
        $("status").innerText =
          "❌ GAGAL MENGIRIM DATA";
      }
    }
  }

  /*
    Capture phase memastikan handler ini mengambil alih
    sebelum listener lama pada tombol menjalankan prosesnya.
  */
  btn.addEventListener("click", kirimCepat, true);

  console.log(
    "CSSD FAST SEND PATCH AKTIF — notifikasi tidak menunggu antrean."
  );
})();
