'use client';

import { useState } from 'react';

export default function EmailForm() {
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);

  const validateEmail = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.to })
      });
      const data = await res.json();
      setValidation(data);
    } catch (error) {
      setValidation({ isValid: false, errors: ['Error al validar'] });
    }
    setLoading(false);
  };

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formData.to,
          subject: formData.subject,
          text: formData.message
        })
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Error al enviar email' });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Enviar Email
        </h2>

        <form onSubmit={sendEmail} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destinatario
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="email@ejemplo.com"
                required
              />
              <button
                type="button"
                onClick={validateEmail}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Validar
              </button>
            </div>
            {validation && (
              <div className={`mt-2 p-3 rounded-lg ${validation.isValid ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {validation.isValid ? '✓ Email válido' : `✗ ${validation.errors?.join(', ')}`}
                {validation.warnings?.length > 0 && (
                  <div className="text-yellow-600 mt-1">
                    ⚠ {validation.warnings.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asunto
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Asunto del mensaje"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32"
              placeholder="Escribe tu mensaje aquí..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Enviando...' : 'Enviar Email'}
          </button>
        </form>

        {result && (
          <div className={`mt-6 p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h3 className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.success ? '✓ Email enviado con éxito' : '✗ Error al enviar'}
            </h3>
            {result.messageId && (
              <p className="text-sm text-gray-600 mt-2">
                ID: {result.messageId}
              </p>
            )}
            {result.error && (
              <p className="text-sm text-red-600 mt-2">
                {result.error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
