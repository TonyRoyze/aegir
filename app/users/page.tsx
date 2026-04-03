"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Loader2, AlertCircle, Plus, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DraftUser = {
  tempId: string;
  name: string;
  username: string;
  password: "";
  role: "admin" | "super_admin";
  loading?: boolean;
}

export default function UsersPage() {
  const { user, token } = useAuth();
  const [draftUsers, setDraftUsers] = useState<DraftUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const closingSelectRef = useRef<boolean>(false);

  const users = useQuery(api.auth.listUsers, token ? { token } : "skip");
  const createUserMutation = useMutation(api.auth.createUser);

  if (user?.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Only Super Admins can access this page.</p>
      </div>
    );
  }

  const addDraftRow = () => {
    setDraftUsers([...draftUsers, {
      tempId: Math.random().toString(36).substring(7),
      name: "",
      username: "",
      password: "",
      role: "admin"
    }]);
  };

  const updateDraftRow = (tempId: string, field: keyof DraftUser, value: string | boolean) => {
    setDraftUsers(draftUsers.map(u => u.tempId === tempId ? { ...u, [field]: value } : u));
  };

  const removeDraftRow = (tempId: string) => {
    setDraftUsers(draftUsers.filter(u => u.tempId !== tempId));
  };

  const handleSaveDraft = async (draft: DraftUser) => {
    if (!token) return;
    updateDraftRow(draft.tempId, "loading", true);
    setOpenSelectId(null);
    setError(null);

    try {
      await createUserMutation({
        adminToken: token,
        userData: {
          username: draft.username,
          password: draft.password,
          name: draft.name,
          role: draft.role,
        },
      });
      removeDraftRow(draft.tempId);
    } catch (err: any) {
      setError(err?.message || "Failed to create user");
      updateDraftRow(draft.tempId, "loading", false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">System Administrators</h1>
        <p className="text-muted-foreground">Manage user accounts and permissions.</p>
      </div>

      <div className="space-y-4 border rounded-lg p-4">
        <div className="flex items-center justify-between pb-6 border-b-2 border-dashed">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shadow-inner">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground/90">System Accounts</h2>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Active Administrators</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-full border border-muted-foreground/10 shadow-sm transition-all hover:bg-muted duration-300">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-tight text-muted-foreground/80">
              {users?.length || 0} COORDINATORS
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-transparent">
              <TableRow className="*:border-border hover:bg-transparent [&>:not(:last-child)]:border-r">
                <TableHead className="border-r w-80 print:text-black">Full Name</TableHead>
                <TableHead className="border-r w-36">Username</TableHead>
                <TableHead className="border-r w-52 print:text-black">Password</TableHead>
                <TableHead className="border-r w-52 print:text-black">Role</TableHead>
                <TableHead className="w-52 print:text-black">ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Existing Users */}
              {users === undefined ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground font-medium italic">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u._id} className="group hover:bg-muted/20 transition-all">
                    <TableCell className="border-r border-muted-foreground/10">
                      <div className="py-1 px-0 text-medium text-foreground">{u.name}</div>
                    </TableCell>
                    <TableCell className="border-r border-muted-foreground/10">
                      <code className="text-[11px] font-mono bg-muted/80 px-1.5 py-0.5 rounded border">@{u.username}</code>
                    </TableCell>
                    <TableCell className="border-r border-muted-foreground/10 text-muted-foreground/30 text-xs tracking-[0.3em]">
                      ••••••••
                    </TableCell>
                    <TableCell className="border-r border-muted-foreground/10">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border",
                        u.role === "super_admin"
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          : "bg-muted text-muted-foreground border-muted-foreground/10"
                      )}>
                        {u.role.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell 
                      className="pr-6 text-right font-mono text-[9px] text-muted-foreground/40 font-semibold tracking-tighter cursor-pointer hover:text-primary transition-colors relative group/id"
                      onClick={() => {
                        navigator.clipboard.writeText(u._id);
                        setCopiedId(u._id);
                        setTimeout(() => setCopiedId(null), 1500);
                      }}
                    >
                      {copiedId === u._id ? (
                        <span className="text-primary font-bold animate-in fade-in zoom-in duration-200">COPIED!</span>
                      ) : (
                        <>ID: {u._id.substring(0, 8)}</>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}

              {/* Draft Rows */}
              {draftUsers.map((draft, idx) => (
                <TableRow key={draft.tempId} className="hover:bg-transparent break-inside-avoid">
                  <TableCell className="p-0 border-r">
                    <Input
                      value={draft.name}
                      onChange={(e) => updateDraftRow(draft.tempId, "name", e.target.value)}
                      autoFocus
                      className="h-10 border-0 bg-transparent shadow-none rounded-none px-4 focus-visible:ring-0 focus-visible:ring-inset focus-visible:ring-primary print:text-xs font-medium"
                      placeholder="Full Name"
                    />
                  </TableCell>
                  <TableCell className="p-0 border-r">
                    <Input
                      value={draft.username}
                      onChange={(e) => updateDraftRow(draft.tempId, "username", e.target.value.toLowerCase())}
                      className="h-10 border-0 bg-transparent shadow-none rounded-none px-4 focus-visible:ring-0 focus-visible:ring-inset focus-visible:ring-primary font-mono text-xs"
                      placeholder="username"
                    />
                  </TableCell>
                  <TableCell className="p-0 border-r">
                    <Input
                      type="password"
                      value={draft.password}
                      onChange={(e) => updateDraftRow(draft.tempId, "password", e.target.value)}
                      className="h-10 border-0 bg-transparent shadow-none rounded-none px-4 focus-visible:ring-0 focus-visible:ring-inset focus-visible:ring-primary"
                      placeholder="••••••••"
                    />
                  </TableCell>
                  <TableCell className="p-0 border-r">
                    <Select 
                      open={openSelectId === draft.tempId} 
                      onOpenChange={(open) => {
                        if (!open) {
                          setOpenSelectId(null);
                          closingSelectRef.current = true;
                          setTimeout(() => { closingSelectRef.current = false; }, 200);
                        } else {
                          setOpenSelectId(draft.tempId);
                        }
                      }}
                      value={draft.role} 
                      onValueChange={(val: any) => updateDraftRow(draft.tempId, "role", val)}
                    >
                      <SelectTrigger 
                        onFocus={() => {
                          if (!closingSelectRef.current) {
                            setOpenSelectId(draft.tempId);
                          }
                        }}
                        className="h-10 w-full border-0 bg-transparent shadow-none rounded-none px-4 ring-0 focus:ring-0 focus-visible:ring-0 text-[10px] font-bold uppercase tracking-wider"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="print:hidden px-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSaveDraft(draft)}
                        disabled={draft.loading || !draft.username || !draft.password || !draft.name}
                        className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                      >
                        {draft.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDraftRow(draft.tempId)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {/* Add Row Button */}
              <TableRow
                className="*:border-border hover:bg-muted/50 cursor-pointer [&>:not(:last-child)]:border-r"
                onClick={addDraftRow}
              >
                <TableHead className="border-r print:text-black">
                  <div className="flex items-center text-muted-foreground hover:text-foreground">
                    <Plus className="mr-2 h-4 w-4" />
                    Add New User
                  </div>
                </TableHead>
                <TableHead className="border-r" />
                <TableHead className="border-r" />
                <TableHead className="border-r" />
                <TableHead />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-6 right-6 animate-in slide-in-from-bottom-5">
          <div className="bg-destructive text-destructive-foreground px-6 py-4 rounded-xl shadow-[0_20px_50px_rgba(220,38,38,0.3)] flex items-center gap-4 border border-white/20 backdrop-blur-md">
            <AlertCircle className="h-6 w-6 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Security Warning</span>
              <div className="text-sm font-bold">{error}</div>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-4 h-6 w-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors font-mono"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
