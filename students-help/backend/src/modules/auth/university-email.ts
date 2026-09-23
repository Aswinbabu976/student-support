import { normalizeEmail } from './email.js';

export class UniversityEmailValidator {
  private readonly allowedDomains: Set<string>;

  constructor(allowedDomains: readonly string[]) {
    this.allowedDomains = new Set(
      allowedDomains.map((domain) => domain.trim().toLowerCase()).filter(Boolean),
    );
  }

  normalizeEmail(email: string): string {
    return normalizeEmail(email);
  }

  extractDomain(email: string): string | null {
    const normalized = this.normalizeEmail(email);
    const at = normalized.lastIndexOf('@');
    if (at <= 0 || at === normalized.length - 1) {
      return null;
    }
    return normalized.slice(at + 1);
  }

  isAllowedDomain(email: string): boolean {
    const domain = this.extractDomain(email);
    if (!domain) {
      return false;
    }
    return this.allowedDomains.has(domain);
  }

  listAllowedDomains(): string[] {
    return [...this.allowedDomains];
  }
}
