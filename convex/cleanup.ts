import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

/** Destructive maintenance utility. Never called by the UI or automatically on deploy. */
export const clearAll = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const registrations = await ctx.db.query("registrations").take(100);
    for (const registration of registrations)
      await ctx.db.delete(registration._id);
    if (registrations.length === 100)
      await ctx.scheduler.runAfter(0, internal.cleanup.clearAll, {});
  },
});
