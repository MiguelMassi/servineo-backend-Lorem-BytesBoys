import nodemailer, { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { emailConfig } from '../../config/email.config';
import { EmailValidatorService } from './email-validator.service';
import { EmailOptions, SendEmailResponse } from '../types/email.types';

export class EmailService {
  private transporter: Transporter<SMTPTransport.SentMessageInfo>;
  private validator: EmailValidatorService;
  private defaultFrom: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      auth: emailConfig.smtp.auth
    });

    this.validator = new EmailValidatorService();
    this.defaultFrom = emailConfig.from;
  }

  async sendEmail(options: EmailOptions): Promise<SendEmailResponse> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];

      for (const email of recipients) {
        const validation = await this.validator.validate(email);
        if (!validation.isValid) {
          return {
            success: false,
            error: `Email inválido ${email}: ${validation.errors.join(', ')}`
          };
        }
      }

      const mailOptions = {
        from: options.from || this.defaultFrom,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments
      };

      const info = await this.transporter.sendMail(mailOptions);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
