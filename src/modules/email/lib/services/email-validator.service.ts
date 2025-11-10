import dns from 'dns';
import { promisify } from 'util';
import { EmailValidationResult } from '../types/email.types';

const resolveMx = promisify(dns.resolveMx);

export class EmailValidatorService {
  private static readonly EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  private static readonly DISPOSABLE_DOMAINS = [
    'tempmail.com', 'guerrillamail.com', '10minutemail.com',
    'mailinator.com', 'throwaway.email'
  ];

  async validate(email: string): Promise<EmailValidationResult> {
    const result: EmailValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!this.validateFormat(email)) {
      result.isValid = false;
      result.errors.push('Formato de email inválido');
      return result;
    }

    const domain = email.split('@')[1];

    if (this.isDisposableDomain(domain)) {
      result.warnings.push('Email desechable detectado');
    }

    const hasMxRecords = await this.validateDomain(domain);
    if (!hasMxRecords) {
      result.isValid = false;
      result.errors.push('Dominio no tiene registros MX válidos');
    }

    return result;
  }

  validateFormat(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    email = email.trim().toLowerCase();
    if (email.length > 254) return false;
    if (!EmailValidatorService.EMAIL_REGEX.test(email)) return false;

    const [localPart] = email.split('@');
    if (localPart.length > 64) return false;

    return true;
  }

  async validateDomain(domain: string): Promise<boolean> {
    try {
      const addresses = await resolveMx(domain);
      return addresses && addresses.length > 0;
    } catch {
      return false;
    }
  }

  isDisposableDomain(domain: string): boolean {
    return EmailValidatorService.DISPOSABLE_DOMAINS.includes(domain.toLowerCase());
  }

  normalize(email: string): string {
    return email.trim().toLowerCase();
  }
}