import { Component, type ReactNode } from "react";
import StartupRecovery from "@/components/StartupRecovery";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <StartupRecovery />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
