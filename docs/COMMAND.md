# Shortcut Command Local Development

## Mulai Development (urutan wajib)
1. Buka tunnel ke VPS (terminal A):
```bash
npm run tunnel:vps
```

2. Jalankan app local (terminal B):
```bash
npm run dev
```

3. Cek health local (opsional):
```bash
curl http://127.0.0.1:3001/api/health
```

## Command Harian Saat Development
```bash
npm run db:migrate
npm run db:push
npm run db:studio
```

## Selesai Development Local
1. Stop `npm run dev` (terminal B): `Ctrl + C`
2. Stop tunnel VPS (terminal A): `Ctrl + C`

## Command Docker Local (hanya jika memang perlu jalankan stack lokal)
```bash
npm run up
npm run down
npm run restart
npm run rebuild
npm run logs
npm run ps
```

## Deploy ke VPS
```bash
npm run vps:deploy
```
