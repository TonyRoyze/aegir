import { internalMutation } from "./_generated/server";

export const clearAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const registrations = await ctx.db.query("registrations").collect();
    for (const r of registrations) {
      await ctx.db.delete(r._id);
    }
    // internalMutation doesn't need to return anything
  },
});
