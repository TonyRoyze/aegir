import { mutation } from "./_generated/server";
import { v } from "convex/values";
import * as bcrypt from "bcryptjs";

export const fixUser = mutation({
  args: { username: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.toLowerCase()))
      .unique();

    if (!user) throw new Error("User not found");

    const hashedPassword = bcrypt.hashSync(args.newPassword, 10);
    await ctx.db.patch(user._id, { password: hashedPassword });
    return `User ${args.username} updated with hashed password.`;
  },
});
