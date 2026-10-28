import { Component, type ReactNode } from 'react';

/** Shows `fallback` instead of a blank page when rendering below it throws */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
