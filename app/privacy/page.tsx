export default function PrivacyPolicyPage() {
  return (
    <div className="relative min-h-screen pt-24 pb-16 px-4 md:px-6">
      {/* Background ambient */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
        <div className="absolute left-[20%] top-[-10%] h-[50vw] w-[50vw] max-w-[600px] rounded-full bg-primary/10 blur-[130px] mix-blend-screen" />
      </div>

      <div className="mx-auto max-w-3xl rounded-3xl border border-border/30 bg-card/40 p-8 shadow-sm backdrop-blur-md md:p-14">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-5xl">
          Kebijakan Privasi
        </h1>
        <p className="mb-10 text-sm text-muted-foreground">
          Terakhir Diperbarui: {new Date().toLocaleDateString("id-ID")}
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/80 md:text-base">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">1. Pendahuluan</h2>
            <p>
              Kami di 20byte (&quot;Kami&quot;, &quot;Platform&quot;) menghargai privasi informasi pengguna kami (&quot;Anda&quot;, &quot;Pengguna&quot;).
              Kebijakan privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, 
              melindungi, dan mengungkapkan setiap data yang kami kembangkan atau kami kelola ketika Anda menggunakan platform 20byte.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">2. Data yang Kami Kumpulkan</h2>
            <p className="mb-2">Saat Anda mendaftarkan akun atau menggunakan layanan kami, kami mengumpulkan ragam data berikut:</p>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>Identitas nama lengkap dan email resmi perusahaan Anda.</li>
              <li>Token otentikasi Meta Business dan WhatsApp Business API.</li>
              <li>Log percakapan (chat) yang diproses terenkripsi via platform kami untuk keperluan CRM.</li>
              <li>Informasi analitik mengenai performa klik untuk integrasi Meta Conversions.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">3. Perlindungan & Keamanan Data</h2>
            <p>
              Seluruh aset data dan pesan diamankan menggunakan sistem enkripsi terpusat di server cloud 
              mutakhir. Kami tidak akan menjual atau menyewakan informasi pribadi Anda atau data pelanggan Anda ke pihak ketiga 
              kecuali memang diwajibkan secara hukum.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">4. Perubahan pada Layanan Privasi</h2>
            <p>
              Kami memiliki hak mutlak untuk memodifikasi atau memperbaiki Kebijakan Privasi ini seiring evolusi produk 
              kapan pun secara berkala. Perubahan signifikan akan diinformasikan lewat email.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">5. Menghubungi Kami</h2>
            <p>
              Apabila terdapat keraguan, pertanyaan teknis perlindungan data atau ingin menghapus seluruh log akun Anda, 
              Anda bisa menyampaikan permintaan resmi ke surel: support@20byte.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
