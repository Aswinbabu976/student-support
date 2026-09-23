import { describe, expect, it } from 'vitest';
import { UniversityEmailValidator } from './university-email.js';

describe('UniversityEmailValidator', () => {
  const validator = new UniversityEmailValidator(['hs-heilbronn.de', 'TUM.de']);

  it('normalizes whitespace and case', () => {
    expect(validator.normalizeEmail('  Alex@TUM.de ')).toBe('alex@tum.de');
  });

  it('extracts the domain', () => {
    expect(validator.extractDomain('student@hs-heilbronn.de')).toBe('hs-heilbronn.de');
    expect(validator.extractDomain('invalid')).toBeNull();
  });

  it('allows only configured domains', () => {
    expect(validator.isAllowedDomain('a@hs-heilbronn.de')).toBe(true);
    expect(validator.isAllowedDomain('a@tum.de')).toBe(true);
    expect(validator.isAllowedDomain('a@gmail.com')).toBe(false);
    expect(validator.isAllowedDomain('a@mail.hs-heilbronn.de')).toBe(false);
  });
});
