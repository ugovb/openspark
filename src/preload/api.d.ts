import type { OpenMailBridge } from './index'

declare global {
  interface Window {
    openmail: OpenMailBridge
  }
}
