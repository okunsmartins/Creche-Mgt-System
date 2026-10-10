import { describe, expect, it } from 'vitest'
import { normaliseSocialUrl, orderSocialLinks } from './links'

describe('normaliseSocialUrl', () => {
  it('treats blank as "remove"', () => {
    expect(normaliseSocialUrl('facebook', '   ')).toEqual({ ok: true, url: null })
  })

  it('accepts full and scheme-less links on the right platform, upgrading to https', () => {
    expect(normaliseSocialUrl('facebook', 'facebook.com/angelsnest')).toEqual({
      ok: true,
      url: 'https://facebook.com/angelsnest',
    })
    expect(normaliseSocialUrl('facebook', 'http://www.facebook.com/angelsnest')).toEqual({
      ok: true,
      url: 'https://www.facebook.com/angelsnest',
    })
    expect(normaliseSocialUrl('youtube', 'https://youtu.be/abc')).toMatchObject({ ok: true })
    expect(normaliseSocialUrl('whatsapp', 'wa.me/353871234567')).toMatchObject({ ok: true })
    expect(normaliseSocialUrl('x', 'https://twitter.com/creche')).toMatchObject({ ok: true })
  })

  it('turns @handles into links for Instagram, TikTok and X', () => {
    expect(normaliseSocialUrl('instagram', '@angels.nest')).toEqual({
      ok: true,
      url: 'https://www.instagram.com/angels.nest',
    })
    expect(normaliseSocialUrl('tiktok', '@angelsnest')).toEqual({
      ok: true,
      url: 'https://www.tiktok.com/@angelsnest',
    })
    expect(normaliseSocialUrl('instagram', '@bad handle!')).toMatchObject({ ok: false })
  })

  it('rejects links to other sites, look-alike hosts and non-web schemes', () => {
    expect(normaliseSocialUrl('facebook', 'https://evil.com/facebook.com')).toMatchObject({
      ok: false,
    })
    expect(normaliseSocialUrl('facebook', 'https://facebook.com.evil.com/x')).toMatchObject({
      ok: false,
    })
    expect(normaliseSocialUrl('instagram', 'javascript:alert(1)')).toMatchObject({ ok: false })
    expect(normaliseSocialUrl('facebook', 'https://user:pw@facebook.com/x')).toMatchObject({
      ok: false,
    })
  })
})

describe('orderSocialLinks', () => {
  it('returns stored links in catalog order and ignores other settings', () => {
    expect(
      orderSocialLinks([
        { key: 'social_youtube', value: 'https://youtube.com/@a' },
        { key: 'currency', value: 'EUR' },
        { key: 'social_facebook', value: 'https://facebook.com/a' },
      ]),
    ).toEqual([
      { key: 'facebook', url: 'https://facebook.com/a' },
      { key: 'youtube', url: 'https://youtube.com/@a' },
    ])
  })
})
