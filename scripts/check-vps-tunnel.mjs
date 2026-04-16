import net from "node:net";

function checkPort(port, host = "127.0.0.1", timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function main() {
  const [mysqlOpen, redisOpen] = await Promise.all([checkPort(3307), checkPort(6379)]);

  if (!mysqlOpen) {
    console.error("[tunnel-check] Port 3307 tidak terbuka. Jalankan: npm run tunnel:vps");
    process.exit(1);
  }

  if (!redisOpen) {
    console.warn("[tunnel-check] Port 6379 belum terbuka. Worker/queue mungkin tidak bisa akses Redis.");
  }

  console.log("[tunnel-check] OK: MySQL tunnel aktif di 127.0.0.1:3307");
}

main().catch((error) => {
  console.error("[tunnel-check] Gagal cek tunnel:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
