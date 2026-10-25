import type { OpenMailBridge } from './index'

declare global {
  interface Window {
    openmail: OpenMailBridge
    /** @deprecated old name of `openmail` */
    octo: OpenMailBridge
  }
}
export {}
