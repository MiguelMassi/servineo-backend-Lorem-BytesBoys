import EmailForm from '../components/EmailForm';

export default function TestEmailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          Test Email Service
        </h1>
        <EmailForm />
      </div>
    </div>
  );
}