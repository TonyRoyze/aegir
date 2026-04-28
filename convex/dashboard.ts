import { query } from "./_generated/server";
import { v } from "convex/values";

export const getPublicLeaderboard = query({
  args: {
    meetId: v.id("meets"),
  },
  handler: async (ctx, args) => {
    const meet = await ctx.db.get(args.meetId);
    if (!meet) {
      return {
        meetName: "",
        meetDate: "",
        facultyLeaderboard: [],
        studentLeaderboard: []
      };
    }

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_meetId", (q) => q.eq("meetId", args.meetId))
      .collect();

    const results = await ctx.db
      .query("results")
      .withIndex("by_meet_event", (q) => q.eq("meetId", args.meetId))
      .collect();

    const convexStudentIds = [...new Set(registrations.map(r => r.studentId))];
    const initialStudents = await Promise.all(convexStudentIds.map(id => ctx.db.get(id)));
    
    const studentMap = new Map();
    const studentsByExternalId = new Map();

    initialStudents.forEach(s => {
      if (s) {
        studentMap.set(s._id, s);
        studentsByExternalId.set(s.externalId, s);
      }
    });

    const externalIdsInResults = [...new Set(results.map(r => r.studentId))];
    const missingExternalIds = externalIdsInResults.filter(id => !studentsByExternalId.has(id));

    if (missingExternalIds.length > 0) {
      const additionalStudents = await Promise.all(
        missingExternalIds.map(async (extId) =>
          ctx.db
            .query("students")
            .withIndex("by_externalId", (q) => q.eq("externalId", extId))
            .unique()
        )
      );

      additionalStudents.forEach(s => {
        if (s) {
          studentMap.set(s._id, s);
          studentsByExternalId.set(s.externalId, s);
        }
      });
    }

    const facultyStats = new Map<string, number>();
    const studentStats = new Map<string, { id: string, name: string, faculty: string, score: number }>();

    results.forEach(res => {
      if (!res.points || res.points <= 0) return;

      const isRelay = res.event.toLowerCase().includes("relay");
      const student = studentsByExternalId.get(res.studentId);
      
      let faculty = "Unknown";
      if (student) {
        faculty = student.faculty || "Unknown";
      } else if (isRelay) {
        faculty = res.studentId;
      } else {
        return;
      }

      facultyStats.set(faculty, (facultyStats.get(faculty) || 0) + res.points);

      if (student && !isRelay) {
        if (!studentStats.has(student._id)) {
          studentStats.set(student._id, {
            id: student._id,
            name: student.name,
            faculty: faculty,
            score: 0
          });
        }
        studentStats.get(student._id)!.score += res.points;
      }
    });

    const facultyLeaderboard = Array.from(facultyStats.entries())
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score);

    const studentLeaderboard = Array.from(studentStats.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return {
      meetName: meet.name,
      meetDate: meet.date,
      facultyLeaderboard,
      studentLeaderboard
    };
  },
});

export const getStats = query({
  args: {
    meetId: v.id("meets"),
  },
  handler: async (ctx, args) => {
    // 1. Get the Active Meet
    let meets;
    if (args.meetId) {
      meets = await ctx.db
        .query("meets")
        .withIndex("by_id", (q) => q.eq("_id", args.meetId))
        .collect();
    } else {
      meets = await ctx.db.query("meets").collect();
    }

    if (!meets) {
      return {
        totalParticipants: 0,
        totalEntries: 0,
        facultyLeaderboard: [],
        studentLeaderboard: []
      };
    }

    // 2. Get Registrations (for counts)
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_meetId", (q) => q.eq("meetId", meets[0]._id))
      .collect();

    // 3. Get Results (for points)
    // We can't query by meetId directly as it's part of a composite key "by_meet_event" or "by_meet_student"
    // Wait, by_meet_event starts with meetId, so we can use it!
    // But we need a range query or just filter in memory if we can't do broad range.
    // Actually, simple .collect() on the index with just the first part of key works effectively as "starts with".
    // convex query syntax: .withIndex("by_meet_event", q => q.eq("meetId", id))
    const results = await ctx.db
      .query("results")
      .withIndex("by_meet_event", (q) => q.eq("meetId", meets[0]._id))
      .collect();

    // 4. Get Student details
    // registrations stores studentId as a Convex ID
    const convexStudentIds = [...new Set(registrations.map(r => r.studentId))];
    const initialStudents = await Promise.all(convexStudentIds.map(id => ctx.db.get(id)));
    
    const studentMap = new Map();
    const studentsByExternalId = new Map(); // map externalId -> student record

    initialStudents.forEach(s => {
      if (s) {
        studentMap.set(s._id, s);
        studentsByExternalId.set(s.externalId, s);
      }
    });

    // results stores studentId as an External ID (string)
    // Check if any results have students not in our map
    const externalIdsInResults = [...new Set(results.map(r => r.studentId))];
    const missingExternalIds = externalIdsInResults.filter(id => !studentsByExternalId.has(id));

    if (missingExternalIds.length > 0) {
      const additionalStudents = await Promise.all(
        missingExternalIds.map(async (extId) =>
          ctx.db
            .query("students")
            .withIndex("by_externalId", (q) => q.eq("externalId", extId))
            .unique()
        )
      );

      additionalStudents.forEach(s => {
        if (s) {
          studentMap.set(s._id, s);
          studentsByExternalId.set(s.externalId, s);
        }
      });
    }

    // 5. Aggregate Stats
    const facultyStats = new Map<string, number>();
    const studentStats = new Map<string, { id: string, name: string, faculty: string, score: number }>();

    let totalEntries = 0;

    // Calc total entries from registrations
    registrations.forEach(r => totalEntries += r.events.length);

    // Calc Points from Results
    results.forEach(res => {
      if (!res.points || res.points <= 0) return;

      const isRelay = res.event.toLowerCase().includes("relay");
      const student = studentsByExternalId.get(res.studentId);
      
      let faculty = "Unknown";
      if (student) {
        faculty = student.faculty || "Unknown";
      } else if (isRelay) {
        // For relays, studentId stores the faculty name
        faculty = res.studentId;
      } else {
        // Skip results that can't be attributed to a student or faculty
        return;
      }

      // Faculty Score
      facultyStats.set(faculty, (facultyStats.get(faculty) || 0) + res.points);

      // Student Score (Only for individual events)
      if (student && !isRelay) {
        if (!studentStats.has(student._id)) {
          studentStats.set(student._id, {
            id: student._id,
            name: student.name,
            faculty: faculty,
            score: 0
          });
        }
        studentStats.get(student._id)!.score += res.points;
      }
    });

    // Sort Leaders
    const facultyLeaderboard = Array.from(facultyStats.entries())
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score);

    const studentLeaderboard = Array.from(studentStats.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10

    return {
      totalParticipants: studentMap.size,
      totalEntries,
      facultyLeaderboard,
      studentLeaderboard
    };
  },
});
