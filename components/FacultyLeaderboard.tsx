"use client"

import { useMemo } from "react"

interface LeaderboardEntry {
  name: string;
  points: number;
}

export function FacultyLeaderboard({ allResults }: { allResults: any[] }) {
  const leaderBoard = useMemo(() => {
    if (!allResults) return [];

    const scores: Record<string, number> = {};

    allResults.forEach(res => {
      const isRelay = res.event.toLowerCase().includes("relay");
      let faculty = "No Faculty";
      
      if (res.student?.faculty) {
        faculty = res.student.faculty;
      } else if (isRelay) {
        // For relays, studentId stores the faculty name
        faculty = res.studentId;
      }
      
      const points = res.points || 0;
      scores[faculty] = (scores[faculty] || 0) + points;
    });

    return Object.entries(scores)
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points);
  }, [allResults]);

  if (!allResults || allResults.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white overflow-hidden">
        {leaderBoard.map((entry, index) => (
          <div 
            key={entry.name} 
            className="flex items-center justify-between p-3 border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl font-black text-amber-500 italic leading-none">{index + 1}</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-tight truncate max-w-[140px]">{entry.name}</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-black tabular-nums">{entry.points}</span>
            </div>
          </div>
        ))}
        {leaderBoard.length === 0 && (
          <div className="p-8 text-center text-xs italic text-slate-400 uppercase tracking-widest">
            Gathering results...
          </div>
        )}
      </div>
    </div>
  );
}
