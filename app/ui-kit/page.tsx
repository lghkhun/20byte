"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, Info, MoreHorizontal } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const demoRows = [
  { id: "INV-2026-001", customer: "Dina Catering", status: "Paid", amount: "Rp 3.500.000" },
  { id: "INV-2026-002", customer: "Rama Wedding", status: "Draft", amount: "Rp 1.850.000" },
  { id: "INV-2026-003", customer: "Salsa Agency", status: "Sent", amount: "Rp 2.450.000" }
];

export default function UiKitPage() {
  const [progress, setProgress] = React.useState(38);
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setProgress((value) => (value >= 100 ? 22 : value + 4)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <TooltipProvider>
      <section className="inbox-scroll h-full overflow-auto p-4 md:p-6">
        <header className="mb-4 rounded-2xl border border-border/80 bg-card/90 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">Shadcn UI Kit</h1>
              <p className="text-xs text-muted-foreground md:text-sm">Showcase komponen shadcn dengan ukuran font kecil proporsional, ringan, dan siap pakai.</p>
            </div>
            <Button size="sm" onClick={() => toast.success("UI kit ready.", { description: "Komponen shadcn aktif dan konsisten." })}>
              Trigger Toast
            </Button>
          </div>
          <div className="mt-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>UI Kit</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
              <CardDescription>Button, Badge, Toggle, Tooltip, Dropdown.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm">Primary</Button>
                <Button size="sm" variant="secondary">Secondary</Button>
                <Button size="sm" variant="outline">Outline</Button>
                <Button size="sm" variant="destructive">Delete</Button>
                <Badge variant="secondary">New</Badge>
                <Toggle size="sm" aria-label="Toggle">Bold</Toggle>
              </div>
              <ToggleGroup type="single" size="sm">
                <ToggleGroupItem value="week">Week</ToggleGroupItem>
                <ToggleGroupItem value="month">Month</ToggleGroupItem>
                <ToggleGroupItem value="year">Year</ToggleGroupItem>
              </ToggleGroup>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline"><Info className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent>Tooltip demo</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline"><MoreHorizontal className="mr-1 h-4 w-4" /> Actions</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem>Archive</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Inputs</CardTitle>
              <CardDescription>Input, Textarea, Select, Switch, Radio, Checkbox.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1">
                <Label htmlFor="company-name">Company Name</Label>
                <Input id="company-name" placeholder="20byte Studio" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={3} placeholder="Input catatan..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select defaultValue="growth">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-between rounded-md border px-3">
                  <Label htmlFor="notif">Realtime</Label>
                  <Switch id="notif" defaultChecked />
                </div>
              </div>
              <RadioGroup defaultValue="owner" className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem id="role-owner" value="owner" /><Label htmlFor="role-owner">Owner</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem id="role-admin" value="admin" /><Label htmlFor="role-admin">Admin</Label></div>
              </RadioGroup>
              <div className="flex items-center gap-2">
                <Checkbox id="terms" defaultChecked />
                <Label htmlFor="terms">Saya menyetujui kebijakan.</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Layout & Data</CardTitle>
              <CardDescription>Tabs, Table, Pagination, Progress, Skeleton.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Tabs defaultValue="table">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="table">Table</TabsTrigger>
                  <TabsTrigger value="loading">Loading</TabsTrigger>
                </TabsList>
                <TabsContent value="table" className="space-y-3">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {demoRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.id}</TableCell>
                            <TableCell>{row.customer}</TableCell>
                            <TableCell>{row.status}</TableCell>
                            <TableCell className="text-right">{row.amount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
                      <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
                      <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
                      <PaginationItem><PaginationEllipsis /></PaginationItem>
                      <PaginationItem><PaginationNext href="#" /></PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </TabsContent>
                <TabsContent value="loading" className="space-y-3">
                  <Progress value={progress} />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overlay & Advanced</CardTitle>
              <CardDescription>Dialog, Sheet, Popover, AlertDialog, Accordion, Menubar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Dialog>
                  <DialogTrigger asChild><Button size="sm" variant="outline">Open Dialog</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Dialog</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">Dialog shadcn standar.</p>
                  </DialogContent>
                </Dialog>
                <Sheet>
                  <SheetTrigger asChild><Button size="sm" variant="outline">Open Sheet</Button></SheetTrigger>
                  <SheetContent>
                    <SheetHeader><SheetTitle>Sheet Panel</SheetTitle></SheetHeader>
                  </SheetContent>
                </Sheet>
                <Popover>
                  <PopoverTrigger asChild><Button size="sm" variant="outline">Pick Date <ChevronDown className="ml-1 h-4 w-4" /></Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={date} onSelect={setDate} />
                  </PopoverContent>
                </Popover>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button size="sm" variant="outline">Confirm</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Konfirmasi</AlertDialogTitle>
                      <AlertDialogDescription>Lanjutkan aksi ini?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction>Lanjut</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <Menubar>
                <MenubarMenu>
                  <MenubarTrigger>File</MenubarTrigger>
                  <MenubarContent><MenubarItem>New</MenubarItem><MenubarItem>Save</MenubarItem></MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                  <MenubarTrigger>Edit</MenubarTrigger>
                  <MenubarContent><MenubarItem>Undo</MenubarItem><MenubarItem>Redo</MenubarItem></MenubarContent>
                </MenubarMenu>
              </Menubar>
              <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                  <AccordionTrigger>Kenapa pakai shadcn?</AccordionTrigger>
                  <AccordionContent>Karena headless, konsisten, dan mudah di-scale.</AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Media & Surface</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-md border">
                <div className="flex h-full items-center justify-center bg-muted text-xs text-muted-foreground">16:9 Aspect Ratio</div>
              </AspectRatio>
              <Carousel opts={{ loop: true }}>
                <CarouselContent>
                  {[1, 2, 3].map((item) => (
                    <CarouselItem key={item}>
                      <div className="rounded-md border bg-muted p-6 text-center text-sm">Slide {item}</div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
              <div className="flex items-center gap-2">
                <Avatar><AvatarFallback>SO</AvatarFallback></Avatar>
                <HoverCard>
                  <HoverCardTrigger asChild><Button variant="link" className="h-auto p-0 text-sm">Seed Owner</Button></HoverCardTrigger>
                  <HoverCardContent className="text-sm">owner@seed.20byte.local</HoverCardContent>
                </HoverCard>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Navigation Samples</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuLink asChild>
                      <Link href="/dashboard" className="rounded-md border px-3 py-2 text-sm">Dashboard</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuLink asChild>
                      <Link href="/inbox" className="rounded-md border px-3 py-2 text-sm">Inbox</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
              <ContextMenu>
                <ContextMenuTrigger className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Right click / long press area
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem>Open</ContextMenuItem>
                  <ContextMenuItem>Rename</ContextMenuItem>
                  <ContextMenuItem>Delete</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">Show details</Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 text-sm text-muted-foreground">
                  Konten collapsible tampil di sini.
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Resizable & Scroll</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="h-36 overflow-hidden rounded-md border">
                <ResizablePanelGroup orientation="horizontal">
                  <ResizablePanel defaultSize={50}>
                    <div className="flex h-full items-center justify-center text-xs">Panel A</div>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={50}>
                    <div className="flex h-full items-center justify-center text-xs">Panel B</div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
              <ScrollArea className="h-24 rounded-md border p-2 text-sm">
                <p>Scroll area demo.</p>
                <Separator className="my-2" />
                <p>Line 1</p>
                <p>Line 2</p>
                <p>Line 3</p>
                <p>Line 4</p>
                <p>Line 5</p>
              </ScrollArea>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Slider defaultValue={[45]} max={100} step={1} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Alert className="mt-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Design direction</AlertTitle>
          <AlertDescription>
            Baseline halaman ini menggunakan ukuran font kecil proporsional dan density modern agar nyaman dibaca di desktop maupun mobile.
          </AlertDescription>
        </Alert>
      </section>
    </TooltipProvider>
  );
}
