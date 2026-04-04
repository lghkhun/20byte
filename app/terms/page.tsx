export default function TermsConditionsPage() {
  return (
    <div className="relative min-h-screen pt-24 pb-16 px-4 md:px-6">
      {/* Background ambient */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
        <div className="absolute left-[20%] top-[-10%] h-[50vw] w-[50vw] max-w-[600px] rounded-full bg-violet-500/10 blur-[130px] mix-blend-screen" />
      </div>

      <div className="mx-auto max-w-3xl rounded-3xl border border-border/30 bg-card/40 p-8 shadow-sm backdrop-blur-md md:p-14">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-5xl">
          Syarat & Ketentuan (T&C)
        </h1>
        <p className="mb-10 text-sm text-muted-foreground">
          Berlaku sejak: {new Date().toLocaleDateString("id-ID")}
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/80 md:text-base">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">1. Persetujuan Layanan</h2>
            <p>
              Dengan mengakses dan membuat akun Tenant di 20byte, Anda menyetujui secara sadar seluruh syarat 
              dan ketentuan yang ditetapkan di halaman ini. Jika Anda tidak menyetujuinya, mohon hindari pemakaian layanan kami.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">2. Pengaturan Tanggung Jawab</h2>
            <p>
              20byte menyediakan wadah (Platform as a Service) untuk memfasilitasi integrasi WhatsApp Business dan 
              Meta CAPI. Namun kami tidak memikul beban tanggung jawab terhadap isi konten dari pesan yang ditransmisikan, 
              maupun jika nomor WhatsApp Anda terblokir akibat melanggar ketentuan resmi WhatsApp/Meta Commerce Policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">3. Kewajiban Etika Pengguna</h2>
            <p className="mb-2">Sebagai bisnis pengguna platform, Anda dilarang mutlak untuk:</p>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>Melakukan injeksi spam kepada individu tanpa consent atau perkenan penerima pesan.</li>
              <li>Menyimpan dan mengedarkan materi terlarang secara hukum/SARA lewat API platform kami.</li>
              <li>Berusaha melumpuhkan layanan atau membongkar kelemahan penetrasi server tanpa mandat resmi.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">4. Berlangganan & Tagihan</h2>
            <p>
              Skema langganan 20byte berbasis kuota. Anda menyetujui deduksi prabayar atau langganan berdasarkan 
              siklus waktu dan jika faktur (invoice) gagal dibayarkan otomatis Anda akan mengalami Limitasi Layanan secara serta merta. 
              Refund (Pengembalian dana) tidak dilayani setelah periode Trial.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
