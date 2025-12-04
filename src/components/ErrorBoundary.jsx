import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error){
    return { error }
  }

  componentDidCatch(error, info){
    // Log to console (can be replaced with remote logging)
    console.error('ErrorBoundary caught', error, info)
  }

  render(){
    if(this.state.error){
      return (
        <div style={{padding:20,fontFamily:'Arial, Helvetica, sans-serif'}}>
          <h2>حدث خطأ في التطبيق</h2>
          <p>{this.state.error && this.state.error.message}</p>
          <details style={{whiteSpace:'pre-wrap'}}>
            {this.state.error && this.state.error.stack}
          </details>
        </div>
      )
    }
    return this.props.children
  }
}
