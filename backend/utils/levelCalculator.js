/**
 * Level Calculator
 * -----------------
 * Determines user level and progress based on accumulated reward points.
 * Levels are defined in config/constants.js.
 */

import { LEVELS } from "../config/constants.js";

/**
 * Get the user's current level based on their total points.
 *
 * @param {number} points - User's total reward points
 * @returns {{ level: number, name: string, min: number, max: number }}
 *
 * @example
 *   getLevel(0)    → { level: 1, name: "Rookie",       min: 0,    max: 200  }
 *   getLevel(600)  → { level: 3, name: "Adventurer",   min: 500,  max: 1000 }
 *   getLevel(2500) → { level: 5, name: "Legend",        min: 2000, max: Infinity }
 */
export function getLevel(points) {
  // Iterate from highest level downward so we find the correct bracket
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min) {
      return {
        level: i + 1,
        name: LEVELS[i].name,
        min: LEVELS[i].min,
        max: LEVELS[i].max,
      };
    }
  }

  // Fallback to Level 1 (should never reach here)
  return { level: 1, ...LEVELS[0] };
}

/**
 * Calculate percentage progress toward the next level.
 *
 * @param {number} points - User's total reward points
 * @returns {{ percentage: number, pointsToNext: number, nextLevelName: string }}
 */
export function calculateProgress(points) {
  const currentLevel = getLevel(points);
  const currentIndex = currentLevel.level - 1;

  // If user is at max level, return 100%
  if (currentIndex >= LEVELS.length - 1) {
    return {
      percentage: 100,
      pointsToNext: 0,
      nextLevelName: LEVELS[LEVELS.length - 1].name,
    };
  }

  const nextLevel = LEVELS[currentIndex + 1];
  const pointsInCurrentLevel = points - currentLevel.min;
  const levelRange = currentLevel.max - currentLevel.min;

  const percentage = Math.min(
    100,
    Math.round((pointsInCurrentLevel / levelRange) * 100)
  );

  return {
    percentage,
    pointsToNext: currentLevel.max - points,
    nextLevelName: nextLevel.name,
  };
}
