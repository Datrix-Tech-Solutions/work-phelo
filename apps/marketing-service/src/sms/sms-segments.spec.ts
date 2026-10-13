import { estimateSmsSegments } from './sms-segments';

describe('estimateSmsSegments', () => {
  it('counts GSM-7 single-part messages', () => {
    expect(estimateSmsSegments('Hello customer')).toEqual({
      encoding: 'GSM7',
      characterCount: 14,
      segmentCount: 1,
    });
  });

  it('counts GSM-7 extension characters as two septets', () => {
    expect(estimateSmsSegments('Use {code}')).toEqual({
      encoding: 'GSM7',
      characterCount: 12,
      segmentCount: 1,
    });
  });

  it('splits long GSM-7 messages using multipart limits', () => {
    expect(estimateSmsSegments('a'.repeat(161))).toMatchObject({
      encoding: 'GSM7',
      characterCount: 161,
      segmentCount: 2,
    });
  });

  it('uses UCS2 for emoji/unicode and counts code points', () => {
    expect(estimateSmsSegments('Hello 😀')).toEqual({
      encoding: 'UCS2',
      characterCount: 7,
      segmentCount: 1,
    });
  });

  it('splits long UCS2 messages using multipart limits', () => {
    expect(estimateSmsSegments('😀'.repeat(71))).toMatchObject({
      encoding: 'UCS2',
      characterCount: 71,
      segmentCount: 2,
    });
  });
});
