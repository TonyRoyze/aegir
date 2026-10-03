import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import * as bcrypt from "bcryptjs";
import type { Doc } from "./_generated/dataModel";
import { requireSuperAdmin } from "./sessionAuth";

function publicUser(user: Doc<"users">) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    username: user.username,
    name: user.name,
    role: user.role,
  };
}

// --- Queries ---

export const me = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.token) return null;

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token!))
      .unique();

    if (!session || session.expiresAt < Date.now()) {
      return null;
    }

    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    // Return user without password
    return publicUser(user);
  },
});

// --- Mutations ---

export const login = mutation({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.eq("username", args.username.toLowerCase()),
      )
      .unique();

    if (!user) {
      throw new Error("Invalid username or password");
    }

    const isMatch = bcrypt.compareSync(args.password, user.password);
    if (!isMatch) {
      throw new Error("Invalid username or password");
    }

    const sessionId = await ctx.db.insert("sessions", {
      userId: user._id,
      token: "", // Will update in a sec
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    // Use the document ID as part of the token to ensure uniqueness
    const finalToken = `sess_${sessionId}_${Math.random().toString(36).substring(2)}`;
    await ctx.db.patch(sessionId, { token: finalToken });

    return {
      token: finalToken,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
      },
    };
  },
});

export const logout = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

// Administrative queries and mutations follow...

export const listUsers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.token);

    const users = await ctx.db.query("users").collect();
    // Return users without passwords
    return users.map(publicUser);
  },
});

// Manage Users (only by super admin)
export const createUser = mutation({
  args: {
    adminToken: v.string(),
    userData: v.object({
      username: v.string(),
      password: v.string(),
      name: v.string(),
      role: v.union(v.literal("super_admin"), v.literal("admin")),
    }),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.adminToken);

    // 2. check if username exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.eq("username", args.userData.username.toLowerCase()),
      )
      .unique();

    if (existing) {
      throw new Error("Username already taken");
    }

    // 3. Create user
    const hashedPassword = bcrypt.hashSync(args.userData.password, 10);
    return await ctx.db.insert("users", {
      ...args.userData,
      username: args.userData.username.toLowerCase(),
      password: hashedPassword,
    });
  },
});
