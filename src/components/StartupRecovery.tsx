interface StartupRecoveryProps {
  onRetry?: () => void;
}

const StartupRecovery = ({ onRetry = () => window.location.reload() }: StartupRecoveryProps) => (
  <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-12">
    <section className="w-full max-w-md text-center" role="alert" aria-live="assertive">
      <img
        src="/Circle_USDC_Logo.svg"
        alt="USDC"
        className="mx-auto mb-6 h-14 w-14"
      />
      <h1 className="text-2xl font-bold">USDC Directory couldn’t load</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The connection was interrupted before the directory opened. Your information and payments
        have not been changed.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Try again
      </button>
      <a
        href="/"
        className="mt-4 block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Return to directory
      </a>
    </section>
  </main>
);

export default StartupRecovery;