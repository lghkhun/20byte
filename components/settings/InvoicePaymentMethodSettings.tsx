"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { GripVertical, Trash2, Check, ChevronsUpDown, Landmark, CreditCard, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSettingsHeaderAction } from "@/components/settings/settings-header-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchJsonCached, invalidateFetchCache } from "@/lib/client/fetchCache";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

const INDONESIAN_BANKS = [
  { value: "bni", label: "Bank Negara Indonesia (BNI)" },
  { value: "bri", label: "Bank Rakyat Indonesia (BRI)" },
  { value: "mandiri", label: "Bank Mandiri" },
  { value: "bca", label: "Bank Central Asia (BCA)" },
  { value: "cimb", label: "CIMB Niaga" },
  { value: "bsi", label: "Bank Syariah Indonesia (BSI)" },
  { value: "permata", label: "PermataBank" },
  { value: "danamon", label: "Bank Danamon" },
  { value: "maybank", label: "Maybank Indonesia" },
  { value: "btn", label: "Bank Tabungan Negara (BTN)" },
  { value: "mega", label: "Bank Mega" },
  { value: "bjb", label: "Bank BJB" },
  { value: "dki", label: "Bank DKI" },
  { value: "jago", label: "Bank Jago" },
  { value: "seabank", label: "SeaBank" },
  { value: "blu", label: "blu by BCA Digital" },
  { value: "sampoerna", label: "Bank Sahabat Sampoerna" },
  { value: "aladin", label: "Bank Aladin Syariah" },
  { value: "nobu", label: "Bank Nobu" },
  { value: "sinarmas", label: "Bank Sinarmas" }
];

type FeePolicy = "MERCHANT" | "CUSTOMER";

type BankAccountItem = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  createdAt: string;
};

type SettingsPayload = {
  data?: {
    settings?: {
      enableBankTransfer: boolean;
      enableQris: boolean;
      enabledVaMethods: string[];
      feePolicy: FeePolicy;
      autoConfirmLabelEnabled: boolean;
      paymentMethodsOrder?: string[];
    };
  };
  error?: { message?: string };
};

const VA_METHODS: Array<{ value: string; label: string; feeLabel: string; logoUrl?: string }> = [
  { value: "cimb_niaga_va", label: "Virtual Account CIMB", feeLabel: "Rp4.000", logoUrl: "/logos/cimb.svg" },
  { value: "bni_va", label: "Virtual Account BNI", feeLabel: "Rp4.000", logoUrl: "/logos/bni.svg" },
  { value: "sampoerna_va", label: "Virtual Account Sampoerna", feeLabel: "Rp3.000", logoUrl: "/logos/sampoerna.svg" },
  { value: "bnc_va", label: "Virtual Account BNC", feeLabel: "Rp4.000", logoUrl: "/logos/bnc.svg" },
  { value: "maybank_va", label: "Virtual Account Maybank", feeLabel: "Rp4.000", logoUrl: "/logos/maybank.svg" },
  { value: "permata_va", label: "Virtual Account Permata", feeLabel: "Rp4.000", logoUrl: "/logos/permata.svg" },
  { value: "atm_bersama_va", label: "Virtual Account ATM Bersama", feeLabel: "Rp4.000", logoUrl: "/logos/atm_bersama.svg" },
  { value: "artha_graha_va", label: "Virtual Account Artha Graha", feeLabel: "Rp3.000", logoUrl: "/logos/artha.svg" },
  { value: "bri_va", label: "Virtual Account BRI", feeLabel: "Rp4.000", logoUrl: "/logos/bri.svg" }
];

export function InvoicePaymentMethodSettings() {
  const [enableBankTransfer, setEnableBankTransfer] = useState(true);
  const [enableQris, setEnableQris] = useState(false);
  const [enabledVaMethods, setEnabledVaMethods] = useState<string[]>([]);
  const [feePolicy, setFeePolicy] = useState<FeePolicy>("CUSTOMER");
  const [autoConfirmLabelEnabled, setAutoConfirmLabelEnabled] = useState(true);
  const [paymentMethodsOrder, setPaymentMethodsOrder] = useState<string[]>([]);

  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);
  const [isCreateBankDialogOpen, setIsCreateBankDialogOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [openBankSelect, setOpenBankSelect] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Expose the save button via Context Header
  const headerAction = useMemo(() => (
    <Button 
      type="button" 
      onClick={() => void handleSaveSettings()} 
      disabled={isSaving || isLoading} 
      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
    >
      {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
    </Button>
  ), [isSaving, isLoading]); // handleSaveSettings is not stable but it's okay

  useSettingsHeaderAction("25-payment-save", headerAction);

  const applySettings = useCallback((settings: NonNullable<SettingsPayload["data"]>["settings"]) => {
    if (!settings) return;
    setEnableBankTransfer(settings.enableBankTransfer);
    setEnableQris(settings.enableQris);
    setEnabledVaMethods(settings.enabledVaMethods ?? []);
    setFeePolicy(settings.feePolicy);
    setAutoConfirmLabelEnabled(settings.autoConfirmLabelEnabled);
    if (settings.paymentMethodsOrder) {
      setPaymentMethodsOrder(settings.paymentMethodsOrder);
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [settingsRes, bankAccountsRes] = await Promise.all([
        fetchJsonCached<SettingsPayload>("/api/orgs/business/payment-methods", { ttlMs: 15_000, init: { cache: "no-store" } }),
        fetchJsonCached<{ data?: { accounts?: BankAccountItem[] } }>("/api/orgs/bank-accounts", { ttlMs: 15_000, init: { cache: "no-store" } })
      ]);

      if (settingsRes?.data?.settings) applySettings(settingsRes.data.settings);
      setBankAccounts(bankAccountsRes?.data?.accounts ?? []);
    } catch (loadError) {
      notifyError(loadError instanceof Error ? loadError.message : "Gagal memuat data.");
    } finally {
      setIsLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSaveSettings() {
    setIsSaving(true);

    try {
      const response = await fetch("/api/orgs/business/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableBankTransfer, enableQris, enabledVaMethods, feePolicy, autoConfirmLabelEnabled, paymentMethodsOrder })
      });
      const payload = (await response.json().catch(() => null)) as SettingsPayload | null;
      if (!response.ok || !payload?.data?.settings) throw new Error(payload?.error?.message ?? "Gagal menyimpan pengaturan.");
      
      applySettings(payload.data.settings);
      invalidateFetchCache("GET:/api/orgs/business/payment-methods");

      notifySuccess("Pengaturan metode pembayaran berhasil disimpan.");
    } catch (saveError) {
       const message = saveError instanceof Error ? saveError.message : "Gagal menyimpan pengaturan.";

       notifyError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateBank(event: React.FormEvent) {
    event.preventDefault();
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) return;
    try {
      setIsSaving(true);
      const response = await fetch("/api/orgs/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, accountNumber, accountHolder })
      });
      if (!response.ok) throw new Error("Gagal menambah rekening.");
      setBankName(""); setAccountNumber(""); setAccountHolder("");
      setIsCreateBankDialogOpen(false);
      invalidateFetchCache("GET:/api/orgs/bank-accounts");
      await loadData();
      notifySuccess("Rekening bank berhasil ditambahkan.");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Error.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteBank(id: string) {
    try {
      const response = await fetch("/api/orgs/bank-accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId: id })
      });
      if (!response.ok) throw new Error("Gagal menghapus rekening.");
      invalidateFetchCache("GET:/api/orgs/bank-accounts");
      await loadData();
      notifySuccess("Rekening bank berhasil dihapus.");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Error.");
    }
  }

  const livePreviewItems = useMemo(() => {
    const rows: Array<{ id: string; label: string; logoUrl?: string; autoConfirm?: boolean }> = [];
    
    for (const bank of bankAccounts) {
      rows.push({
        id: `bank_${bank.id}`,
        label: `Bank Transfer ${bank.bankName.toUpperCase()}`,
        logoUrl: `/logos/${bank.bankName.toLowerCase()}.svg`,
        autoConfirm: false
      });
    }

    if (enableQris) {
      rows.push({ id: "qris", label: "QRIS", logoUrl: "/logos/qris.svg", autoConfirm: true });
    }

    for (const method of VA_METHODS) {
      if (enabledVaMethods.includes(method.value)) {
        rows.push({ id: method.value, label: method.label, logoUrl: method.logoUrl, autoConfirm: true });
      }
    }

    if (paymentMethodsOrder.length > 0) {
      const orderMap = new Map(paymentMethodsOrder.map((id, index) => [id, index]));
      rows.sort((a, b) => {
        const aIndex = orderMap.get(a.id);
        const bIndex = orderMap.get(b.id);
        if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
        if (aIndex !== undefined) return -1;
        if (bIndex !== undefined) return 1;
        return 0;
      });
    }

    return rows;
  }, [bankAccounts, enableQris, enabledVaMethods, paymentMethodsOrder]);

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.setData("draggedIndex", index.toString());
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    const dragIndex = Number(e.dataTransfer.getData("draggedIndex"));
    if (dragIndex === dropIndex) return;

    const newOrder = [...livePreviewItems.map(m => m.id)];
    const item = newOrder.splice(dragIndex, 1)[0];
    newOrder.splice(dropIndex, 0, item);
    
    setPaymentMethodsOrder(newOrder);
  };

  return (
    <section className="space-y-4">
      {isLoading ? <div className="p-4 text-center text-sm text-muted-foreground">Memuat pengaturan...</div> : null}

      {!isLoading ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_400px] p-2">
          <div className="space-y-6">
            <article className="overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-sm">
              <div className="px-5 py-4 flex items-center justify-between border-b border-border/40">
                <h4 className="text-lg font-bold text-foreground">Bank Transfer</h4>
                <Button type="button" variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700 h-8 text-xs px-3" onClick={() => setIsCreateBankDialogOpen(true)}>
                  + Tambah Rekening
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-20 pl-5">Logo</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Biaya</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankAccounts.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">Tidak ada bank accounts.</TableCell></TableRow>
                  )}
                  {bankAccounts.map((account) => (
                    <TableRow key={account.id} className="group">
                      <TableCell className="pl-5">
                         <div className="h-8 w-14 rounded border border-border/60 bg-white flex items-center justify-center p-1 font-bold text-[10px] text-muted-foreground uppercase overflow-hidden">
                           {account.bankName}
                         </div>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground text-sm">Bank Transfer {account.bankName.toUpperCase()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">Bank Transfer</TableCell>
                      <TableCell className="text-xs text-slate-400">bank_transfer_{account.bankName.toLowerCase()}</TableCell>
                      <TableCell className="text-sm font-medium">Rp 0</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteBank(account.id)} className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </article>

            <article className="overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-sm">
              <div className="px-5 py-4 border-b border-border/40">
                <h4 className="text-lg font-bold text-foreground">Payment Methods</h4>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-20 pl-5">Logo</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Biaya</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                     <TableCell className="pl-5">
                       <div className="h-8 w-14 rounded border border-border/60 bg-white flex items-center justify-center p-1 font-bold text-xs text-blue-600">
                         <Image src="/logos/qris.svg?v=2" alt="QRIS" width={40} height={20} unoptimized className="w-full h-full object-contain" />
                       </div>
                     </TableCell>
                     <TableCell className="font-semibold text-sm">QRIS</TableCell>
                     <TableCell className="text-sm text-muted-foreground">QRIS</TableCell>
                     <TableCell className="text-xs text-slate-400">qris</TableCell>
                     <TableCell className="text-sm font-medium">2%</TableCell>
                     <TableCell>
                       <Switch checked={enableQris} onCheckedChange={(c) => setEnableQris(Boolean(c))} />
                     </TableCell>
                  </TableRow>
                  {VA_METHODS.map((method) => (
                    <TableRow key={method.value}>
                      <TableCell className="pl-5">
                         <div className="h-8 w-14 rounded border border-border/60 bg-white flex items-center justify-center p-1.5 font-bold text-[10px] text-muted-foreground uppercase overflow-hidden">
                           {method.logoUrl ? (
                              <Image src={`${method.logoUrl}?v=2`} alt={method.label} width={40} height={20} unoptimized className="w-full h-full object-contain" />
                           ) : (
                              method.value.replace("_va", "")
                           )}
                         </div>
                      </TableCell>
                      <TableCell className="font-semibold text-sm">{method.label}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">Virtual Account</TableCell>
                      <TableCell className="text-xs text-slate-400">{method.value}</TableCell>
                      <TableCell className="text-sm font-medium">{method.feeLabel}</TableCell>
                      <TableCell>
                        <Switch
                          checked={enabledVaMethods.includes(method.value)}
                          onCheckedChange={(c) => {
                            if (c) setEnabledVaMethods([...enabledVaMethods, method.value]);
                            else setEnabledVaMethods(enabledVaMethods.filter(v => v !== method.value));
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </article>

          </div>

          <aside className="rounded-[24px] border border-border/70 bg-card shadow-sm h-fit">
            <div className="px-5 py-5 border-b border-border/40">
               <h4 className="text-xl font-bold tracking-tight text-foreground">Urutan Metode Pembayaran</h4>
               <p className="mt-1.5 text-[13px] text-muted-foreground font-medium">Metode yang tampil ke customer di invoice publik.<br/>Drag untuk ubah urutan.</p>
            </div>

            <div className="p-5">
               <div className="rounded-xl border border-border/50 bg-slate-50/50 p-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-2 pt-1">Metode Pembayaran:</p>
                  <div className="space-y-2">
                    {livePreviewItems.map((item, index) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, index)}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, index)}
                        className="flex items-center gap-3 rounded-xl border border-border/80 bg-white p-3 pr-4 shadow-sm transition hover:border-emerald-500/40 hover:shadow-md cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="h-4 w-4 text-slate-300" />
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-orange-500">
                           <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                        </div>
                        <div className="h-6 w-10 flex-shrink-0 rounded border border-border/40 bg-white flex items-center justify-center p-1 font-bold text-[8px] text-muted-foreground uppercase">
                           {item.logoUrl ? (
                              <Image src={`${item.logoUrl}?v=2`} alt={item.label} width={40} height={20} unoptimized className="w-full h-full object-contain" />
                           ) : (
                              item.id.replace("bank_", "").replace("_va", "")
                           )}
                        </div>
                        <span className="font-semibold text-sm text-foreground">{item.label}</span>
                      </div>
                    ))}
                    {livePreviewItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                        Belum ada metode aktif.
                      </div>
                    ) : null}
                  </div>
               </div>
            </div>

            <div className="p-5 border-t border-border/40 bg-slate-50/50 rounded-b-[24px]">
               <label className="flex items-start gap-3 cursor-pointer group">
                 <Checkbox 
                   checked={feePolicy === "CUSTOMER"} 
                   onCheckedChange={(c) => setFeePolicy(c ? "CUSTOMER" : "MERCHANT")} 
                   className="mt-1"
                 />
                 <div className="group-hover:opacity-80 transition-opacity">
                   <p className="text-sm font-semibold text-foreground">Bebankan biaya ke opsi pembayaran</p>
                   <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                     Biaya tambahan gateway akan ditanggung oleh customer. Jika tak dicentang, akan dipotong dari saldo wallet bisnis.
                   </p>
                 </div>
               </label>
            </div>
          </aside>
        </div>
      ) : null}

      <Dialog open={isCreateBankDialogOpen} onOpenChange={setIsCreateBankDialogOpen}>
        <DialogContent className="max-w-md rounded-[24px] p-6">
          <DialogHeader className="mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-2">
              <Landmark className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-bold">Tambah Rekening Bank</DialogTitle>
            <DialogDescription className="text-[15px]">Isi informasi rekening secara akurat untuk memfasilitasi pembayaran customer.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateBank} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="bank" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Nama Bank <span className="text-red-500">*</span></Label>
              <Popover open={openBankSelect} onOpenChange={setOpenBankSelect}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={openBankSelect} className={cn("w-full justify-between h-12 rounded-xl px-4 font-normal text-base shadow-sm border-border/70 hover:bg-slate-50", !bankName && "text-muted-foreground")}>
                    {bankName ? INDONESIAN_BANKS.find(b => b.value === bankName)?.label || bankName.toUpperCase() : "Pilih Bank..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[398px] p-0 rounded-xl" align="start">
                  <Command>
                    <CommandInput placeholder="Cari bank..." className="h-11" />
                    <CommandList className="max-h-[220px]">
                      <CommandEmpty>Bank tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        {INDONESIAN_BANKS.map((bank) => (
                          <CommandItem key={bank.value} value={bank.label} onSelect={() => { setBankName(bank.value); setOpenBankSelect(false); }} className="py-2.5 px-3">
                            <Check className={cn("mr-2 h-4 w-4", bankName === bank.value ? "opacity-100 text-emerald-600" : "opacity-0")} />
                            {bank.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="norek" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Nomor Rekening <span className="text-red-500">*</span></Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <Input id="norek" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Misal: 1234567890" className="h-12 rounded-xl pl-11 shadow-sm border-border/70 text-base" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nama" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Nama Pemilik <span className="text-red-500">*</span></Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <User className="h-5 w-5" />
                </div>
                <Input id="nama" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Atas nama sesuai buku tabungan" className="h-12 rounded-xl pl-11 shadow-sm border-border/70 text-base" />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateBankDialogOpen(false)} className="rounded-xl h-11 px-6 font-semibold">Batal</Button>
              <Button type="submit" disabled={isSaving || !bankName || !accountNumber || !accountHolder} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6 shadow-md shadow-emerald-500/20 font-semibold">
                Simpan Rekening
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
