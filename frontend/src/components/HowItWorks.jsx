export default function HowItWorks() {
  const steps = [
    {
      id: 1,
      title: 'Create an Account',
      description: 'Sign up as a freelancer to offer your services or as a company to hire talent.',
    },
    {
      id: 2,
      title: 'Find the Perfect Match',
      description: 'Use our powerful search to filter by category, location, and availability.',
    },
    {
      id: 3,
      title: 'Collaborate & Create',
      description: 'Connect directly, finalize terms, and start creating beautiful wedding memories.',
    },
  ];

  return (
    <div className="py-16 sm:py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-brand-dark tracking-tight sm:text-4xl">
            How WedCrew Works
          </h2>
          <p className="mt-4 max-w-2xl text-xl text-brand-textSec mx-auto">
            Seamlessly connecting the wedding industry in three simple steps.
          </p>
        </div>

        <div className="mt-16">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.id} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-brand-blue font-bold text-2xl mb-6 shadow-sm">
                    {step.id}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-brand-textSec">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
