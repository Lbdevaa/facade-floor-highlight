import {Component, type ErrorInfo, type ReactNode} from 'react'
import {StatusScreen} from '../statusScreen'

interface Props {
  title: string
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Ошибка в сцене не должна оставлять белый экран: кадр и разметка вокруг него
 * продолжают работать, а вместо сцены показывается текст ошибки.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {error: null}

  static getDerivedStateFromError(error: Error): State {
    return {error}
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return <StatusScreen kind='error' title={this.props.title} details={this.state.error.message} />
    }

    return this.props.children
  }
}
