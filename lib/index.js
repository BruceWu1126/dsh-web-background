/**
 * Host half of the dsh-web-background plugin.
 *
 * Registers the durable `web-background` settings namespace so the browser
 * half can persist the user's background choices through the Host settings
 * document (`$DSH_HOME/settings.yaml`). The schema defaults double as the
 * "reset to defaults" target: the client resets by unsetting fields, which
 * re-inherits these defaults.
 */
import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by this plugin. */
export const BACKGROUND_NAMESPACE = 'web-background'

/** Accepted background kinds. */
export const BACKGROUND_MODES = ['color', 'gradient', 'image']

/** Accepted image fit modes. */
export const IMAGE_FITS = ['cover', 'contain', 'tile']

/**
 * Durable background section schema. Every field carries a default so an
 * empty user section still resolves to a complete, valid value on both the
 * Host (resolution) and the browser (wire validation) side.
 */
export const BackgroundSettingsSchema = z.object({
  /** Master switch. Off = the stock theme surface stays untouched. */
  enabled: z.boolean().default(false),
  /** Background kind selected in the settings page. */
  mode: z.union(BACKGROUND_MODES).default('color'),
  /** Solid color for the light palette. */
  colorLight: z.string().default('#f5f6f8'),
  /** Solid color for the dark palette. */
  colorDark: z.string().default('#0e1116'),
  /** Deprecated free-text gradient field — kept so stored sections keep validating; unused by the UI. */
  gradientLight: z.string().default('linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'),
  /** Deprecated free-text gradient field (see gradientLight). */
  gradientDark: z.string().default('linear-gradient(135deg, #0f2027 0%, #2c5364 100%)'),
  /** Gradient direction in degrees (0 = up, 90 = right). */
  gradientAngle: z.number().min(0).max(360).default(135),
  /** Gradient start color for the light palette. */
  gradientLightStart: z.string().default('#f5f7fa'),
  /** Gradient end color for the light palette. */
  gradientLightEnd: z.string().default('#c3cfe2'),
  /** Gradient start color for the dark palette. */
  gradientDarkStart: z.string().default('#0f2027'),
  /** Gradient end color for the dark palette. */
  gradientDarkEnd: z.string().default('#2c5364'),
  /** http(s) URL or data URL of the background image. */
  imageUrl: z.string().default(''),
  /** How the image fills the surface. */
  imageFit: z.union(IMAGE_FITS).default('cover'),
  /** Translucent black overlay over the image (percent, 0-80) for readability. */
  imageOverlay: z.number().min(0).max(80).default(0),
  /** Apply the background to the sidebar fill token as well. */
  applyToSidebar: z.boolean().default(false),
})

/**
 * Host plugin body: register the durable settings section when a settings
 * provider is composed. Without one (no settings service) the plugin is a
 * no-op — the browser half degrades to defaults.
 * @param ctx - Host Cordis context.
 */
export function apply(ctx) {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(BACKGROUND_NAMESPACE, BackgroundSettingsSchema)
  })
}
