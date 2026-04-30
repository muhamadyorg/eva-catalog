import { useState } from "react";
import {
  useListUsers, useCreateUser, useUpdateUser, useDeleteUser,
  useBlockUser, useForceLogoutUser,
  getListUsersQueryKey, UserPublic,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Plus, Shield, User, Trash2, Edit, Ban, LogOut, CheckCircle, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/components/auth-provider";

type RoleType = "admin" | "manager" | "user";

export default function AdminUsers() {
  const { user: me } = useAuth();
  const { data: users, isLoading } = useListUsers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<RoleType>("user");

  const [editingUser, setEditingUser] = useState<UserPublic | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<RoleType>("user");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
  }

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        invalidate();
        setIsCreateOpen(false);
        setCreateUsername(""); setCreatePassword(""); setCreateRole("user");
        toast({ title: "Foydalanuvchi yaratildi ✅" });
      },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => { invalidate(); setEditingUser(null); toast({ title: "Yangilandi ✅" }); },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "O'chirildi" }); },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const blockMutation = useBlockUser({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Holat yangilandi" }); },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const forceLogoutMutation = useForceLogoutUser({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Foydalanuvchi tizimdan chiqarildi" }); },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  function roleIcon(role: string) {
    if (role === "admin") return <Shield className="h-4 w-4 text-yellow-500" />;
    if (role === "manager") return <Briefcase className="h-4 w-4 text-blue-500" />;
    return <User className="h-4 w-4 text-muted-foreground" />;
  }

  function roleBadge(role: string) {
    if (role === "admin") return <Badge className="bg-yellow-500 text-white border-0">Admin</Badge>;
    if (role === "manager") return <Badge className="bg-blue-500 text-white border-0">Menejer</Badge>;
    return <Badge variant="secondary">Foydalanuvchi</Badge>;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Foydalanuvchilar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tizim foydalanuvchilari va rollarini boshqarish
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Yangi foydalanuvchi</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ data: { username: createUsername, password: createPassword, role: createRole } });
            }}>
              <DialogHeader>
                <DialogTitle>Yangi foydalanuvchi</DialogTitle>
                <DialogDescription>Tizimga yangi foydalanuvchi qo'shing.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Login</Label>
                  <Input value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Parol</Label>
                  <Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={createRole} onValueChange={(v) => setCreateRole(v as RoleType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Foydalanuvchi</SelectItem>
                      <SelectItem value="manager">Menejer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Menejer: mahsulot qo'shish/tahrirlash. Admin: barcha huquqlar.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>Yaratish</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Foydalanuvchi</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="hidden sm:table-cell">Holat</TableHead>
              <TableHead className="hidden md:table-cell">Sana</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
            ) : !users?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Foydalanuvchilar yo'q</TableCell></TableRow>
            ) : (users as UserPublic[]).map((user) => (
              <TableRow key={user.id} className={user.isBlocked ? "opacity-50" : ""}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      {roleIcon(user.role)}
                    </div>
                    <div>
                      <p className="font-medium">{user.username}</p>
                      {user.isBlocked && <p className="text-xs text-red-500">Bloklangan</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{roleBadge(user.role)}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {user.hasActiveSession ? (
                    <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Onlayn
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Oflayn</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {format(new Date(user.createdAt), "dd.MM.yyyy")}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={user.id === me?.id}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditingUser(user);
                        setEditRole(user.role as RoleType);
                        setEditPassword("");
                      }}>
                        <Edit className="mr-2 h-4 w-4" /> Tahrirlash
                      </DropdownMenuItem>
                      {user.hasActiveSession && (
                        <DropdownMenuItem onClick={() => forceLogoutMutation.mutate({ id: user.id })}>
                          <LogOut className="mr-2 h-4 w-4" /> Chiqarib yuborish
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => blockMutation.mutate({ id: user.id, data: { isBlocked: !user.isBlocked } })}>
                        {user.isBlocked ? (
                          <><CheckCircle className="mr-2 h-4 w-4" /> Blokdan chiqarish</>
                        ) : (
                          <><Ban className="mr-2 h-4 w-4 text-orange-500" /> Bloklash</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onClick={() => {
                          if (window.confirm(`"${user.username}" ni o'chirasizmi?`)) {
                            deleteMutation.mutate({ id: user.id });
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> O'chirish
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editingUser) return;
            updateMutation.mutate({
              id: editingUser.id,
              data: { role: editRole, ...(editPassword ? { password: editPassword } : {}) },
            });
          }}>
            <DialogHeader>
              <DialogTitle>Tahrirlash: {editingUser?.username}</DialogTitle>
              <DialogDescription>Rolni yoki parolni o'zgartirish</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Yangi parol (bo'sh qoldirsangiz o'zgarmaydi)</Label>
                <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as RoleType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Foydalanuvchi</SelectItem>
                    <SelectItem value="manager">Menejer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending}>Saqlash</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
