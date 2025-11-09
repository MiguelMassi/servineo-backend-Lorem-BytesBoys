import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '../lib/services/email.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, text, html } = body;

    if (!to || !subject || (!text && !html)) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const emailService = new EmailService();
    const result = await emailService.sendEmail({
      to,
      subject,
      text,
      html
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId
      });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al enviar email' },
      { status: 500 }
    );
  }
}