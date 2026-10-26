import { computeMatchScore, computeOverallScore } from './candidate-match';
import { educationLevelCode } from './vacancy-requirements';

const subject = (highestEducationLevel: string | null) => ({
  skills: [],
  languages: [],
  certificates: [],
  yearsOfExperience: null,
  highestEducationLevel,
});

describe('educationLevelCode', () => {
  it.each([
    ["Bachelor's Degree", 'BACHELORS'],
    ['Bachelor Degree', 'BACHELORS'],
    ['BSc', 'BACHELORS'],
    ['BACHELORS', 'BACHELORS'],
    ["Master's Degree", 'MASTERS'],
    ['MBA', 'MASTERS'],
    ['Higher National Diploma (HND)', 'HND'],
    ['Postgraduate Diploma', 'POSTGRADUATE_DIPLOMA'],
    ['SHS / WASSCE', 'SHS'],
    ['PhD', 'DOCTORATE'],
  ])('reads %s as %s', (raw, code) => {
    expect(educationLevelCode(raw)).toBe(code);
  });

  it('returns null for wording it does not recognise', () => {
    expect(educationLevelCode('random')).toBeNull();
    expect(educationLevelCode('')).toBeNull();
    expect(educationLevelCode(null)).toBeNull();
  });
});

describe('computeMatchScore education', () => {
  it('gives full marks when the applicant meets the lowest accepted level', () => {
    const details = { education: { levels: ['BACHELORS', 'MASTERS'] } };
    expect(computeMatchScore(subject('Bachelor Degree'), details)).toBe(100);
  });

  it('gives partial credit one step below the only accepted level', () => {
    const details = { education: { levels: ['MASTERS'] } };
    expect(computeMatchScore(subject("Bachelor's Degree"), details)).toBe(80);
  });

  it('scores zero when the applicant has no recognisable level', () => {
    const details = { education: { levels: ['BACHELORS'] } };
    expect(computeMatchScore(subject(null), details)).toBe(0);
  });
});

describe('computeOverallScore', () => {
  const details = { skills: { items: ['Payroll'] } };
  const matching = { ...subject(null), skills: ['Payroll'] };
  const none = { total: 0, accepted: 0, decided: 0 };

  it('is the application score alone while nothing has been decided', () => {
    expect(
      computeOverallScore(matching, details, {
        total: 4,
        accepted: 0,
        decided: 0,
      }),
    ).toBe(100);
  });

  it('splits evenly with the screening once an answer is decided', () => {
    expect(
      computeOverallScore(matching, details, {
        total: 4,
        accepted: 1,
        decided: 1,
      }),
    ).toBe(63);
  });

  it('counts a declined answer as a decision that scores nothing', () => {
    expect(
      computeOverallScore(matching, details, {
        total: 2,
        accepted: 0,
        decided: 1,
      }),
    ).toBe(50);
  });

  it('uses the screening alone when the opening has nothing to score the application on', () => {
    expect(
      computeOverallScore(matching, {}, { total: 2, accepted: 1, decided: 2 }),
    ).toBe(50);
  });

  it('is null when neither can be scored', () => {
    expect(computeOverallScore(matching, {}, none)).toBeNull();
  });
});
