import React from 'react'

export const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center' }}>
    <img
      src="/images/knest_logo.png"
      alt="KNEST"
      style={{
        height: '22px',
        width: 'auto',
        objectFit: 'contain',
      }}
    />
  </div>
)

export const Icon = () => (
  <img
    src="/images/knest_icon.png"
    alt="KNEST Icon"
    style={{
      height: '32px',
      width: 'auto',
      objectFit: 'contain',
    }}
  />
)
