export type SmsEncoding = 'GSM7' | 'UCS2';

export interface SmsSegmentEstimate {
  encoding: SmsEncoding;
  characterCount: number;
  segmentCount: number;
}

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENSION = '^{}\\[~]|€';

const basicChars = new Set([...GSM7_BASIC]);
const extensionChars = new Set([...GSM7_EXTENSION]);

function isGsm7(message: string) {
  return [...message].every(
    (char) => basicChars.has(char) || extensionChars.has(char),
  );
}

function gsm7Length(message: string) {
  return [...message].reduce(
    (total, char) => total + (extensionChars.has(char) ? 2 : 1),
    0,
  );
}

function segments(length: number, singleLimit: number, multipartLimit: number) {
  if (length <= 0) return 0;
  if (length <= singleLimit) return 1;
  return Math.ceil(length / multipartLimit);
}

export function estimateSmsSegments(message: string): SmsSegmentEstimate {
  const text = message ?? '';
  if (isGsm7(text)) {
    const characterCount = gsm7Length(text);
    return {
      encoding: 'GSM7',
      characterCount,
      segmentCount: segments(characterCount, 160, 153),
    };
  }

  const characterCount = [...text].length;
  return {
    encoding: 'UCS2',
    characterCount,
    segmentCount: segments(characterCount, 70, 67),
  };
}

export function campaignSmsText(subject: string, message: string) {
  const cleanSubject = subject.trim();
  return cleanSubject ? `${cleanSubject}\n${message}` : message;
}
