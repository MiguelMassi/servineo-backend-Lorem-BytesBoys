import { NextRequest, NextResponse } from 'next/server';
import { EmailValidatorService } from '../lib/services/email-validator.service';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email requerido' },
        { status: 400 }
      );
    }

    const validator = new EmailValidatorService();
    const result = await validator.validate(email);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al validar email' },
      { status: 500 }
    );
  }
}
