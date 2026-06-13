import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', background: '#5b27d6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, fontSize: 20, fontWeight: 800 }}>
      F
    </div>,
    size,
  )
}
