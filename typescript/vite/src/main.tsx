import '@/components/keenicons/assets/styles.css';
import './styles/globals.css';

import axios from 'axios';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { setupAxios } from './auth';
import { ProvidersWrapper } from './providers';
import React from 'react';

/**
 * Global ErrorBoundary to catch and display React rendering errors
 */
class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GlobalErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#fff0f0', minHeight: '100vh' }}>
          <h1 style={{ color: '#c00' }}>Something went wrong</h1>
          <h2 style={{ color: '#333' }}>{this.state.error?.message}</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#666', maxHeight: 400, overflow: 'auto' }}>
            {this.state.error?.stack}
          </pre>
          <h3 style={{ color: '#333', marginTop: 20 }}>Component Stack:</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#666', maxHeight: 400, overflow: 'auto' }}>
            {this.state.errorInfo?.componentStack}
          </pre>
          <button
            style={{ marginTop: 20, padding: '10px 20px', cursor: 'pointer' }}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Inject interceptors for axios.
 *
 * @see https://github.com/axios/axios#interceptors
 */
setupAxios(axios);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <ProvidersWrapper>
        <App />
      </ProvidersWrapper>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
