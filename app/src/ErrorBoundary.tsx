import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error("[ErrorBoundary] caught error:", error);
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] componentDidCatch:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#080B14',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', color: '#EF4444', fontFamily: 'monospace',
          padding: 40, zIndex: 9999,
        }}>
          <h1 style={{ fontSize: 24, marginBottom: 16 }}>🔴 React Error Caught</h1>
          <pre style={{
            background: 'rgba(239,68,68,0.1)', padding: 20, borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.3)', maxWidth: '90vw',
            overflow: 'auto', fontSize: 13, color: '#FCA5A5',
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
