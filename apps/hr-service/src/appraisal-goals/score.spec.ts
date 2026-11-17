import { overallScore, weightedOverallScore } from './score';

const goal = (id: string) => ({
  id,
  selfAssessmentWeight: 50,
  managerAssessmentWeight: 50,
});
const entry = (id: string) => ({
  goal: goal(id),
  objectives: [{ id: `o${id}` }],
});
const rated = (scores: Record<string, number>) =>
  Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, { score: v }]));

describe('weightedOverallScore', () => {
  const group = { A: 35, B: 35, C: 20, D: 10 };

  it('weights each goal by the group when the person is on all of them', () => {
    const ratings = rated({ oA: 5, oB: 5, oC: 5, oD: 0 });
    const entries = ['A', 'B', 'C', 'D'].map(entry);
    expect(weightedOverallScore(entries, ratings, ratings, group)).toBe(90);
  });

  it('rescales to 100 when the person lacks a goal', () => {
    const ratings = rated({ oA: 5, oB: 5, oC: 5 });
    const entries = ['A', 'B', 'C'].map(entry);
    expect(weightedOverallScore(entries, ratings, ratings, group)).toBe(100);
  });

  it('rescales across the goals that remain, not an even split', () => {
    // A 35 and C 20 remain: A scores 100, C scores 40 => (35*100 + 20*40) / 55
    const ratings = rated({ oA: 5, oC: 2 });
    const entries = ['A', 'C'].map(entry);
    expect(weightedOverallScore(entries, ratings, ratings, group)).toBe(78);
  });

  it('leaves out a goal that has no objectives', () => {
    const ratings = rated({ oA: 5, oB: 5 });
    const entries = [
      entry('A'),
      entry('B'),
      { goal: goal('C'), objectives: [] },
    ];
    expect(weightedOverallScore(entries, ratings, ratings, group)).toBe(100);
  });

  it('ignores goals the group gives no weight', () => {
    const ratings = rated({ oA: 5, oX: 0 });
    const entries = ['A', 'X'].map(entry);
    expect(weightedOverallScore(entries, ratings, ratings, group)).toBe(100);
  });

  it('is null when nothing has a weight', () => {
    const ratings = rated({ oX: 5 });
    expect(
      weightedOverallScore([entry('X')], ratings, ratings, group),
    ).toBeNull();
  });

  it('matches the plain average when every goal has one objective and equal weights', () => {
    const ratings = rated({ oA: 5, oB: 3 });
    const entries = ['A', 'B'].map(entry);
    expect(
      weightedOverallScore(entries, ratings, ratings, { A: 50, B: 50 }),
    ).toBe(overallScore(entries, ratings, ratings));
  });
});
