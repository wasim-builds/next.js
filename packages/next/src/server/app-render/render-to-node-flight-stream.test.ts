import { renderToNodeFlightStream } from './stream-ops.node'
import { ResponseAborted } from '../web/spec-extension/adapters/next-request'

describe('renderToNodeFlightStream', () => {
  it('aborts pipeable with destination error before generic error handler runs', () => {
    let abortedReason: unknown = null
    const abortSpy = jest.fn((reason) => {
      abortedReason = reason
    })

    const mockComponentMod = {
      renderToPipeableStream: jest.fn((_payload, _clientModules, _options) => {
        let aborted = false
        const abort = (reason: unknown) => {
          if (aborted) return
          aborted = true
          abortSpy(reason)
        }
        return {
          pipe: (destination: any) => {
            // Emulate React's destination.on('error') handler
            destination.on('error', () => {
              abort(
                new Error('The destination stream errored while writing data.')
              )
            })
            return destination
          },
          abort,
        }
      }),
    }

    const stream = renderToNodeFlightStream(
      mockComponentMod as any,
      {} as any,
      {} as any,
      {}
    )

    const customError = new Error('client disconnect')
    // Node streams require an error listener or emit('error') throws uncaught
    stream.on('error', () => {})
    stream.emit('error', customError)

    expect(abortSpy).toHaveBeenCalledTimes(1)
    expect(abortedReason).toBe(customError)
  })

  it('aborts pipeable with ResponseAborted when destination stream errors without error value', () => {
    let abortedReason: unknown = null
    const abortSpy = jest.fn((reason) => {
      abortedReason = reason
    })

    const mockComponentMod = {
      renderToPipeableStream: jest.fn((_payload, _clientModules, _options) => {
        let aborted = false
        const abort = (reason: unknown) => {
          if (aborted) return
          aborted = true
          abortSpy(reason)
        }
        return {
          pipe: (destination: any) => {
            destination.on('error', () => {
              abort(
                new Error('The destination stream errored while writing data.')
              )
            })
            return destination
          },
          abort,
        }
      }),
    }

    const stream = renderToNodeFlightStream(
      mockComponentMod as any,
      {} as any,
      {} as any,
      {}
    )

    stream.on('error', () => {})
    stream.emit('error', undefined)

    expect(abortSpy).toHaveBeenCalledTimes(1)
    expect(abortedReason).toBeInstanceOf(ResponseAborted)
  })

  it('aborts pipeable with ResponseAborted on destination close before write ends', () => {
    let abortedReason: unknown = null
    const abortSpy = jest.fn((reason) => {
      abortedReason = reason
    })

    const mockComponentMod = {
      renderToPipeableStream: jest.fn((_payload, _clientModules, _options) => {
        let aborted = false
        const abort = (reason: unknown) => {
          if (aborted) return
          aborted = true
          abortSpy(reason)
        }
        return {
          pipe: (destination: any) => {
            // Emulate React's destination.on('close') handler
            destination.on('close', () => {
              abort(new Error('The destination stream closed early.'))
            })
            return destination
          },
          abort,
        }
      }),
    }

    const stream = renderToNodeFlightStream(
      mockComponentMod as any,
      {} as any,
      {} as any,
      {}
    )

    stream.emit('close')

    expect(abortSpy).toHaveBeenCalledTimes(1)
    expect(abortedReason).toBeInstanceOf(ResponseAborted)
  })

  it('aborts pipeable when signal fires', () => {
    let abortedReason: unknown = null
    const abortSpy = jest.fn((reason) => {
      abortedReason = reason
    })

    const mockComponentMod = {
      renderToPipeableStream: jest.fn((_payload, _clientModules, _options) => {
        let aborted = false
        const abort = (reason: unknown) => {
          if (aborted) return
          aborted = true
          abortSpy(reason)
        }
        return {
          pipe: (destination: any) => destination,
          abort,
        }
      }),
    }

    const controller = new AbortController()
    renderToNodeFlightStream(mockComponentMod as any, {} as any, {} as any, {
      signal: controller.signal,
    })

    const signalReason = new Error('abort reason')
    controller.abort(signalReason)

    expect(abortSpy).toHaveBeenCalledTimes(1)
    expect(abortedReason).toBe(signalReason)
  })
})
