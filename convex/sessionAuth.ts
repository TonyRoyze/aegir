import type { QueryCtx, MutationCtx } from "./_generated/server";

export async function requireSession(
  ctx: QueryCtx | MutationCtx,
  token: string,
) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt < Date.now())
    throw new Error("Not authenticated");
  const user = await ctx.db.get(session.userId);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx,
  token: string,
) {
  const user = await requireSession(ctx, token);
  if (user.role !== "super_admin")
    throw new Error("Only super admins can manage users");
  return user;
}
