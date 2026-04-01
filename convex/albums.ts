import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("albums").order("desc").collect();
  },
});

export const internalCreate = internalMutation({
  args: {
    title: v.string(),
    date: v.string(),
    description: v.string(),
    link: v.string(),
    coverImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("albums", args);
  },
});

export const create = action({
  args: {
    title: v.string(),
    date: v.string(),
    description: v.string(),
    link: v.string(),
  },
  handler: async (ctx, args) => {
    let coverImage: string | undefined;
    try {
      const response = await fetch(args.link, {
        headers: {
          'User-Agent': 'bot' // Some sites require a user agent
        }
      });
      const html = await response.text();

      // Simple regex to find og:image.
      // Matches both property="og:image" content="..." and content="..." property="og:image"
      const match = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);

      if (match && match[1]) {
        coverImage = match[1];
        // Basic HTML entity decoding
        coverImage = coverImage.replace(/&amp;/g, '&');
      }
    } catch (error) {
      console.error("Failed to fetch OG image", error);
    }

    await ctx.runMutation(internal.albums.internalCreate, {
      ...args,
      coverImage,
    });
  },

});


export const internalUpdate = internalMutation({
  args: {
    id: v.id("albums"),
    title: v.string(),
    date: v.string(),
    description: v.string(),
    link: v.string(),
    coverImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const update = action({
  args: {
    id: v.id("albums"),
    title: v.string(),
    date: v.string(),
    description: v.string(),
    link: v.string(),
    coverImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let coverImage: string | undefined;
    // try {
    //   const response = await fetch(args.link, {
    //     headers: {
    //       'User-Agent': 'bot'
    //     }
    //   });
    //   const html = await response.text();

    //   const match = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
    //     html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);

    //   if (match && match[1]) {
    //     coverImage = match[1];
    //     coverImage = coverImage.replace(/&amp;/g, '&');
    //   }
    // } catch (error) {
    //   console.error("Failed to fetch OG image", error);
    // }

    await ctx.runMutation(internal.albums.internalUpdate, {
      ...args
    });
  },
});

export const deleteAlbum = mutation({
  args: {
    id: v.id("albums"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete("albums", args.id);
  },
});

