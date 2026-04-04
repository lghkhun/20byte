import { ChevronDown } from "lucide-react";

export default function FAQPage() {
  const faqs = [
    {
      q: "Apakah platform ini terhubung melalui WhatsApp Cloud API resmi?",
      a: "Saat ini, arsitektur 20byte ditenagai menggunakan engine berbasis Baileys (Unofficial API) yang berfungsi selayaknya WhatsApp Web. Hal ini memungkinkan setup instan tanpa kerumitan validasi Meta BSP. Meski demikian, Anda tetap memiliki tanggung jawab penuh; terdapat rasio risiko nomor terblokir (banned) jika Anda melakukan mass-spam atau tindakan yang menyalahi Terms of Service dari WhatsApp.",
    },
    {
      q: "Bagaimana integrasi dengan Meta Conversions API (CAPI) dimungkinkan?",
      a: "Kami menangkap perubahan stase invoice/CRM dan menyederhanakannya melalui webhook server-ke-server yang aman. Anda hanya butuh mengisi Pixel ID dan Conversions Access Token, maka saat pelanggan melunasi tagihan, purchase event berhasil didorong kembali ke Ads Manager Anda menghindari filter dari blokir pixel iOS-client.",
    },
    {
      q: "Bolehkah satu nomor WA dikelola bersamaan (Multiple Agent)?",
      a: "Sangat bisa. Fitur utama kami adalah Shared Team Inbox di mana satu nomor pusat perusahaan Anda bisa diawaki 5, 20 bahkan ratusan tim sales/CS (Customer Service) sekaligus di dasbor bersama dengan role akses yang terisolasi.",
    },
    {
      q: "Apakah integrasi pembayarannya sudah otomatis (Auto-cek mutasi)?",
      a: "Ya. Setiap Invoice memiliki kapabilitas penerjemahan auto-cek status jika Anda menautkan konfigurasi payment gateway ke rekening tujuan.",
    },
    {
      q: "Berapa lama waktu setup dan verifikasi platform?",
      a: "Sistem kami berkonfigurasi instan. Namun, pendaftaran WhatsApp Official Business mensyaratkan validasi OTP. Semua ini umumnya bisa diselesaikan kurang dari 15 menit saja selama Anda memegang hak administrasi domain perusahaan Anda.",
    },
  ];

  return (
    <div className="relative min-h-screen pt-24 pb-16 px-4 md:px-6">
      {/* Background ambient */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
        <div className="absolute right-[20%] top-[-10%] h-[50vw] w-[50vw] max-w-[600px] rounded-full bg-blue-500/10 blur-[130px] mix-blend-screen" />
      </div>

      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center md:mb-16">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-sm text-muted-foreground md:text-base">
            Jawaban lengkap untuk semua keingintahuan mengenai operasional WhatsApp sentris bersama platform 20byte.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group overflow-hidden rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md open:bg-card/60 transition-colors duration-300"
            >
              <summary className="flex cursor-pointer items-center justify-between px-6 py-5 text-base font-semibold text-foreground md:text-lg">
                {faq.q}
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-300 group-open:rotate-180">
                  <ChevronDown className="h-4 w-4" />
                </span>
              </summary>
              <div className="px-6 pb-6 text-sm leading-relaxed text-muted-foreground">
                <p className="border-t border-border/20 pt-4">{faq.a}</p>
              </div>
            </details>
          ))}
        </div>
        
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            Masih butuh penjelasan konkret tambahan?
          </p>
          <a href="mailto:support@20byte.com" className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90">
            Hubungi Support Engineer
          </a>
        </div>
      </div>
    </div>
  );
}
